
import type { RequestHandler } from "express";
import { env } from "../config/env";
import { verifyInstagramOAuthState } from "../utils/instagram-oauth-state";

export const instagramOAuthTestPage: RequestHandler = (req, res) => {
    const state = req.query.state;

    if (typeof state !== "string" || !verifyInstagramOAuthState(state)) {
        res.status(400).send("Invalid or expired OAuth test session");
        return;
    }

    const safeState = JSON.stringify(state);

    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Replyza Instagram Connection Test</title>
</head>
<body>
  <h2>Connect Instagram to Replyza</h2>
  <p id="status">Loading Meta login...</p>
  <button id="connect" disabled>Connect Instagram</button>

  <script nonce="${res.locals.cspNonce}">
    const APP_ID = ${JSON.stringify(env.META_APP_ID)};
    const CONFIG_ID = ${JSON.stringify(env.META_LOGIN_CONFIG_ID)};
    const STATE = ${safeState};
    const CALLBACK_URL = ${JSON.stringify(env.META_REDIRECT_URI)};
    const statusEl = document.getElementById("status");

    window.fbAsyncInit = function () {
      FB.init({
        appId: APP_ID,
        cookie: true,
        xfbml: false,
        version: ${JSON.stringify(env.META_GRAPH_API_VERSION)}
      });

      document.getElementById("status").textContent =
        "Meta login is ready.";
      document.getElementById("connect").disabled = false;
    };

    const sdk = document.createElement("script");
    sdk.src = "https://connect.facebook.net/en_US/sdk.js";
    sdk.async = true;
    sdk.defer = true;
    document.head.appendChild(sdk);

    document.getElementById("connect").addEventListener("click", function () {
      document.getElementById("status").textContent =
        "Waiting for Meta authorization...";

      
FB.login(function(response) {
  console.log("Meta login callback received:", {
    status: response.status,
    hasAuthResponse: Boolean(response.authResponse),
    hasCode: Boolean(response.authResponse && response.authResponse.code)
  });

  const code = response.authResponse && response.authResponse.code;

  if (!code) {
    statusEl.textContent =
      "Authorization cancelled or Meta did not return an authorization code.";

    console.error("Meta authorization response:", response);
    return;
  }

  statusEl.textContent = "Authorization received. Connecting account...";

  fetch(CALLBACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code: code,
      state: STATE
    })
  })
    .then(function(result) {
      return result.json().then(function(data) {
        return {
          ok: result.ok,
          status: result.status,
          data: data
        };
      });
    })
    .then(function(result) {
      console.log("Replyza OAuth callback result:", {
        httpStatus: result.status,
        success: result.data.success,
        message: result.data.message
      });

      statusEl.textContent =
        result.data.message ||
        (result.ok ? "Connection completed." : "Connection failed.");
    })
    .catch(function(error) {
      console.error("OAuth callback request failed:", error);
      statusEl.textContent = "Callback request failed. Check API logs.";
    });

}, {
  config_id: CONFIG_ID,
  response_type: "code",
  override_default_response_type: true,
  extras: {
    setup: {}
  }
});
    });
  </script>
</body>
</html>`);
};
