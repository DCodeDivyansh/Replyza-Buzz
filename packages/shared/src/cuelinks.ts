/**
 * Validates that a URL string uses strictly http: or https: protocol.
 */
export function isValidHttpUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Detects whether a URL is already a Cuelinks tracking/short link
 * (linksredirect.com or clnk.in) to prevent double-wrapping.
 */
export function isCuelinksUrl(rawUrl: string): boolean {
  if (!isValidHttpUrl(rawUrl)) return false;
  try {
    const hostname = new URL(rawUrl.trim()).hostname.toLowerCase();
    return (
      hostname === "linksredirect.com" ||
      hostname.endsWith(".linksredirect.com") ||
      hostname === "clnk.in" ||
      hostname.endsWith(".clnk.in")
    );
  } catch {
    return false;
  }
}

/**
 * Builds a Cuelinks deep-link wrapper URL:
 * https://linksredirect.com/?pub_id=<PUB_ID>&url=<ENCODED_URL>&subid=<SUBID>
 */
export function buildCuelinksDeepLink(
  publisherId: string,
  targetUrl: string,
  subid?: string
): string {
  const pub = publisherId.trim();
  if (!pub) {
    throw new Error("Cuelinks publisherId is required");
  }
  if (!isValidHttpUrl(targetUrl)) {
    throw new Error("Target URL must be a valid http(s) URL");
  }
  const cleanTarget = targetUrl.trim();
  const cleanSubid = (subid?.trim() || "replyza").slice(0, 100);

  const params = new URLSearchParams({
    pub_id: pub,
    url: cleanTarget,
    subid: cleanSubid,
  });

  return `https://linksredirect.com/?${params.toString()}`;
}
