
import argon2 from "argon2";
import { prisma } from "@replyza/database";
import type { RegisterInput } from "../validators/auth.validator";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function registerUser(input: RegisterInput) {
  const email = input.email;

  // 1. Hash the password before storing it.
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  try {
    // 2. Create the user in PostgreSQL.
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

    // 3. Return only safe user information.
    return user;
  } catch (error: unknown) {
    // 4. Handle duplicate email addresses.
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
