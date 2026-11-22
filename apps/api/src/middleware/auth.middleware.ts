import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt";

export const authenticate: RequestHandler = (
  req,
  res,
  next
) => {
  try {
    const authorization = req.headers.authorization;

    // Check whether the Authorization header exists.
    if (!authorization) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    // Extract Bearer token.
    const match = authorization.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      res.status(401).json({
        success: false,
        message: "Invalid authorization format"
      });
      return;
    }

    // Verify JWT signature, issuer, audience and expiry.
    const payload = verifyAccessToken(match[1]);

    // Attach authenticated user to request.
    req.user = {
      id: payload.userId
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired access token"
    });
  }
};