
import type { RequestHandler } from "express";
import { env } from "../config/env";
import { createInstagramOAuthState } from "../utils/instagram-oauth-state";

export const startInstagramOAuth: RequestHandler = (req, res) => {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });
    return;
  }

  const state = createInstagramOAuthState(req.user.id);

  res.status(200).json({
    success: true,
    message: "OAuth test session created",
    data: {
      testPageUrl:
        `${env.META_REDIRECT_URI.replace(
          "/api/v1/instagram/oauth/callback",
          "/api/v1/instagram/oauth/test"
        )}?state=${encodeURIComponent(state)}`
    }
  });
};
