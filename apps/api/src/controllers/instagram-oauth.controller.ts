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

  const authUrl = new URL(
    `https://www.facebook.com/${env.META_GRAPH_API_VERSION}/dialog/oauth`
  );
  authUrl.searchParams.set("client_id", env.META_APP_ID);
  authUrl.searchParams.set("config_id", env.META_LOGIN_CONFIG_ID);
  authUrl.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("override_default_response_type", "true");
  authUrl.searchParams.set("state", state);

  res.status(200).json({
    success: true,
    message: "OAuth test session created",
    data: {
      authUrl: authUrl.toString(),
      testPageUrl:
        `${env.META_REDIRECT_URI.replace(
          "/api/v1/instagram/oauth/callback",
          "/api/v1/instagram/oauth/test"
        )}?state=${encodeURIComponent(state)}`
    }
  });
};