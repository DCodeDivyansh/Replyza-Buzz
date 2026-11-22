
import argon2 from "argon2";
import { prisma } from "@replyza/database";

import type {
  RegisterInput,
  LoginInput
} from "../validators/auth.validator";

import { generateAccessToken } from "../utils/jwt";

import {
  generateRefreshToken,
  hashRefreshToken,
  generateTokenFamilyId
} from "../utils/refresh-token";

import { authConfig } from "../config/auth.config";

// Custom authentication error.
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ==========================================
// REGISTER USER
// ==========================================

export async function registerUser(input: RegisterInput) {
  const email = input.email;

  // 1. Hash password using Argon2id.
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  try {
    // 2. Create user in PostgreSQL.
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    // 3. Return safe user information.
    return user;

  } catch (error: unknown) {

    // 4. Handle duplicate email.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AuthError(
        "An account with this email already exists",
        409
      );
    }

    throw error;
  }
}

// ==========================================
// LOGIN USER
// ==========================================

export async function loginUser(input: LoginInput) {

  // 1. Find user by email.
  const user = await prisma.user.findUnique({
    where: {
      email: input.email
    }
  });

  // 2. Reject unknown email.
  if (!user) {
    throw new AuthError(
      "Invalid email or password",
      401
    );
  }

  // 3. Verify password.
  const passwordMatches = await argon2.verify(
    user.passwordHash,
    input.password
  );

  if (!passwordMatches) {
    throw new AuthError(
      "Invalid email or password",
      401
    );
  }

  // 4. Generate access token.
  const accessToken = generateAccessToken(user.id);

  // 5. Generate refresh token.
  const { token, tokenHash } = generateRefreshToken();

  // 6. Create a unique session family.
  const familyId = generateTokenFamilyId();

  // 7. Calculate expiration date.
  const expiresAt = new Date(
    Date.now() + authConfig.refreshTokenLifetimeMs
  );

  // 8. Store refresh token hash in PostgreSQL.
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt
    }
  });

  // 9. Return token and safe user information.
  // The raw refresh token will be placed in an HttpOnly cookie
  // by the login controller, not returned in the JSON response.
  return {
    accessToken,
    refreshToken: token,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt
    }
  };
}





export async function refreshUserSession(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Find the refresh token.
    const existingToken = await tx.refreshToken.findUnique({
      where: { tokenHash }
    });

    if (!existingToken) {
      return {
        success: false as const,
        message: "Invalid refresh token"
      };
    }

    // 2. Detect reuse of a revoked token.
    if (existingToken.revokedAt) {
      await tx.refreshToken.updateMany({
        where: {
          familyId: existingToken.familyId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      return {
        success: false as const,
        message: "Refresh token reuse detected"
      };
    }

    // 3. Check expiration.
    if (existingToken.expiresAt <= new Date()) {
      await tx.refreshToken.updateMany({
        where: {
          id: existingToken.id,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      return {
        success: false as const,
        message: "Refresh token expired"
      };
    }

    // 4. Atomically claim the existing token.
    const claimedToken = await tx.refreshToken.updateMany({
      where: {
        id: existingToken.id,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: {
        revokedAt: new Date()
      }
    });

    // 5. If another request already consumed it,
    // revoke the entire session family.
    if (claimedToken.count !== 1) {
      await tx.refreshToken.updateMany({
        where: {
          familyId: existingToken.familyId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      return {
        success: false as const,
        message: "Refresh token reuse detected"
      };
    }

    // 6. Generate replacement token.
    const { token, tokenHash: newTokenHash } =
      generateRefreshToken();

    const expiresAt = new Date(
      Date.now() + authConfig.refreshTokenLifetimeMs
    );

    // 7. Store replacement token in the same transaction.
    await tx.refreshToken.create({
      data: {
        userId: existingToken.userId,
        tokenHash: newTokenHash,
        familyId: existingToken.familyId,
        expiresAt
      }
    });

    // 8. Generate new access token.
    const accessToken = generateAccessToken(
      existingToken.userId
    );

    return {
      success: true as const,
      accessToken,
      refreshToken: token
    };
  });

  // Throw only AFTER the transaction commits.
  if (!result.success) {
    throw new AuthError(result.message, 401);
  }

  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  };
}



export async function logoutUser(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);

  // Find the session associated with this refresh token.
  const existingToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash
    },
    select: {
      familyId: true
    }
  });

  // Revoke all active tokens belonging to this session.
  if (existingToken) {
    await prisma.refreshToken.updateMany({
      where: {
        familyId: existingToken.familyId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }
}

