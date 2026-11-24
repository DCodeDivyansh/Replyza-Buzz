
import process from "node:process";

const required = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_LOGIN_CONFIG_ID",
  "META_REDIRECT_URI",
  "META_GRAPH_API_VERSION"
];

let failures = 0;

function report(name, passed, details = "") {
  console.log(
    `${passed ? "PASS" : "FAIL"} | ${name}${details ? " | " + details : ""}`
  );

  if (!passed) failures++;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000)
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { response, data };
}

function describeMetaError(data) {
  const error = data?.error;

  if (!error) return "No Meta error returned";

  return [
    `code=${error.code ?? "unknown"}`,
    `subcode=${error.error_subcode ?? "none"}`,
    `type=${error.type ?? "unknown"}`,
    `message=${error.message ?? "unknown"}`
  ].join(", ");
}

async function main() {
  console.log("\n========== REPLYZA META API DIAGNOSTICS ==========\n");

  // 1. Environment configuration
  const missing = required.filter(
    key => !process.env[key] || !process.env[key].trim()
  );

  report(
    "Environment configuration",
    missing.length === 0,
    missing.length ? `Missing: ${missing.join(", ")}` : "Required variables present"
  );

  if (missing.length) {
    console.log("\nCannot continue without required configuration.");
    process.exitCode = 1;
    return;
  }

  const appId = process.env.META_APP_ID.trim();
  const appSecret = process.env.META_APP_SECRET.trim();
  const configId = process.env.META_LOGIN_CONFIG_ID.trim();
  const redirectUri = process.env.META_REDIRECT_URI.trim();
  const version = process.env.META_GRAPH_API_VERSION.trim();

  if (!/^v\d+\.\d+$/.test(version)) {
    report("Graph API version format", false, version);
    process.exitCode = 1;
    return;
  }

  report("Meta App ID format", /^\d+$/.test(appId));
  report("Login configuration ID present", /^\d+$/.test(configId));
  report("Redirect URI format", redirectUri.startsWith("https://"));

  const redirect = new URL(redirectUri);
  const graphBase = `https://graph.facebook.com/${version}`;

  // 2. Local Replyza API
  try {
    const { response, data } = await requestJson(
      "http://localhost:4000/api/v1/health"
    );

    report(
      "Local Replyza API health",
      response.ok,
      `HTTP ${response.status}, ${data.status ?? "response received"}`
    );
  } catch (error) {
    report("Local Replyza API health", false, error.message);
  }

  // 3. Cloudflare tunnel
  try {
    const healthUrl = `${redirect.origin}/api/v1/health`;
    const { response, data } = await requestJson(healthUrl);

    report(
      "Cloudflare tunnel health",
      response.ok,
      `HTTP ${response.status}, ${data.status ?? "response received"}`
    );
  } catch (error) {
    report("Cloudflare tunnel health", false, error.message);
  }

  // 4. Meta Graph API connectivity
  const appAccessToken = `${appId}|${appSecret}`;

  try {
    const url = `${graphBase}/${appId}?fields=id,name`;

    const { response, data } = await requestJson(url, {
      headers: {
        Authorization: `Bearer ${appAccessToken}`
      }
    });

    const valid =
      response.ok &&
      !data.error &&
      String(data.id) === appId;

    report(
      "Meta app metadata API",
      valid,
      valid
        ? `App name: ${data.name}, App ID: ${data.id}`
        : `HTTP ${response.status}, ${describeMetaError(data)}`
    );
  } catch (error) {
    report("Meta app metadata API", false, error.message);
  }

  // 5. Meta token debugging API
  try {
    const url = new URL(`${graphBase}/debug_token`);
    url.searchParams.set("input_token", appAccessToken);

    const { response, data } = await requestJson(url, {
      headers: {
        Authorization: `Bearer ${appAccessToken}`
      }
    });

    const tokenData = data.data;
    const valid =
      response.ok &&
      !data.error &&
      tokenData?.is_valid === true &&
      String(tokenData.app_id) === appId;

    report(
      "Meta debug_token API",
      valid,
      valid
        ? `Valid app token, type=${tokenData.type ?? "unknown"}`
        : `HTTP ${response.status}, ${describeMetaError(data)}`
    );
  } catch (error) {
    report("Meta debug_token API", false, error.message);
  }

  // 6. Configuration diagnostics (presence only)
  console.log("\n========== CONFIGURATION ==========");
  console.log("Graph API version:", version);
  console.log("App ID:", appId);
  console.log("Login configuration ID:", configId);
  console.log("Redirect host:", redirect.host);
  console.log("App secret:", "[HIDDEN]");
  console.log("App access token:", "[HIDDEN]");

  console.log("\n========== SUMMARY ==========");
  console.log("Failed checks:", failures);
  console.log("Completed.");

  if (failures > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error("Diagnostic script crashed:", error.message);
  process.exitCode = 1;
});
