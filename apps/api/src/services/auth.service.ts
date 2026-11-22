
import argon2 from "argon2";
import { prisma } from "@replyza/database";

import type {
  RegisterInput,
  LoginInput
} from "../validators/auth.validator";

import { generateAccessToken } from "../utils/jwt";

import {
  generateRefreshToken,
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
