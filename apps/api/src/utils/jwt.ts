import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  userId: string;
}

export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { userId },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "15m",
      issuer: "replyza-api",
      audience: "replyza-web"
    }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "replyza-api",
    audience: "replyza-web"
  });

  if (
    typeof payload === "string" ||
    typeof payload.userId !== "string"
  ) {
    throw new Error("Invalid access token payload");
  }

  return { userId: payload.userId };
}