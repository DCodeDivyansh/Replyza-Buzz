const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

const FRONTEND_ORIGIN =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://replyza.buzz"
    : "http://localhost:3000");

async function forwardRequest(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const pathString = path.join("/");
  const url = new URL(req.url);
  const targetUrl = `${BACKEND_URL}/api/v1/${pathString}${url.search}`;

  const forwardHeaders = new Headers();

  // Forward critical client headers
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    forwardHeaders.set("authorization", authHeader);
  }

  const contentType = req.headers.get("content-type");
  if (contentType) {
    forwardHeaders.set("content-type", contentType);
  }

  const cookie = req.headers.get("cookie");
  if (cookie) {
    forwardHeaders.set("cookie", cookie);
  }

  // Set CSRF header and Origin expected by backend csrf.middleware
  const csrf = req.headers.get("x-csrf-protection");
  if (csrf) {
    forwardHeaders.set("x-csrf-protection", csrf);
  } else if (pathString.startsWith("auth/refresh") || pathString.startsWith("auth/logout")) {
    forwardHeaders.set("x-csrf-protection", "1");
  }

  // Forward client IP and proxy shared secret for secure rate limiting
  const proxySecret = process.env.PROXY_SHARED_SECRET || "replyza_default_proxy_secret_for_local_dev_123456789";
  forwardHeaders.set("x-replyza-proxy-secret", proxySecret);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (clientIp) {
    forwardHeaders.set("x-forwarded-for", clientIp);
  }

  forwardHeaders.set("origin", FRONTEND_ORIGIN);

  let body: BodyInit | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const contentTypeRes = backendRes.headers.get("content-type");
    if (contentTypeRes) {
      responseHeaders.set("content-type", contentTypeRes);
    }

    // Forward Set-Cookie headers, adjusting Path to root so the frontend domain retains it
    // getSetCookie returns an array of individual set-cookie header strings
    const setCookieHeaders =
      typeof backendRes.headers.getSetCookie === "function"
        ? backendRes.headers.getSetCookie()
        : backendRes.headers.get("set-cookie")
        ? [backendRes.headers.get("set-cookie")!]
        : [];

    for (const cookieStr of setCookieHeaders) {
      // Rewrite Path=/api/v1/auth to Path=/
      const modifiedCookie = cookieStr.replace(/Path=\/api\/v1\/auth/i, "Path=/");
      responseHeaders.append("set-cookie", modifiedCookie);
    }

    const responseBody = await backendRes.arrayBuffer();
    return new Response(responseBody, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Proxy Error] Failed to forward request to ${targetUrl}:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unable to connect to Replyza API server. Please ensure the backend is running.",
      }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(req, context);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(req, context);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(req, context);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(req, context);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(req, context);
}
