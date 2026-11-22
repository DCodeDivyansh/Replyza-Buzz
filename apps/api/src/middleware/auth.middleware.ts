import type { RequestHandler } from "express";
import { prisma } from "@replyza/database";
import { verifyAccessToken } from "../utils/jwt";

export const authenticate: RequestHandler = async (
  req,
  res,
  next
) => {
  // 1. Read Authorization header.
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });
    return;
  }

  // 2. Extract Bearer token.
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    res.status(401).json({
      success: false,
      message: "Invalid authorization format"
    });
    return;
  }

  // 3. Verify JWT signature and payload.
  let payload;

  try {
    payload = verifyAccessToken(match[1]);
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired access token"
    });
    return;
  }

  // 4. Verify that this session family is still active.
  try {
    const activeSession = await prisma.refreshToken.findFirst({
      where: {
        userId: payload.userId,
        familyId: payload.familyId,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true
      }
    });

    // 5. Reject tokens belonging to revoked sessions.
    if (!activeSession) {
      res.status(401).json({
        success: false,
        message: "Session expired or revoked. Please log in again."
      });
      return;
    }

    // 6. Attach authenticated user information.
    req.user = {
      id: payload.userId,
      familyId: payload.familyId
    };

    next();
  } catch (error) {
    // Database failure must not authenticate the request.
    next(error);
  }
};