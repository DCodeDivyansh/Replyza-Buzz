import { describe, it, expect } from "vitest";
import {
  buildCuelinksDeepLink,
  isCuelinksUrl,
  isValidHttpUrl,
} from "@replyza/shared";

describe("Cuelinks shared helpers", () => {
  it("validates http(s) URLs and rejects javascript:/data:/malformed URLs", () => {
    expect(isValidHttpUrl("https://www.amazon.in/dp/B09G9BL5CP")).toBe(true);
    expect(isValidHttpUrl("http://flipkart.com/item?id=1")).toBe(true);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });

  it("detects Cuelinks URLs (linksredirect.com and clnk.in) and ignores normal/lookalike domains", () => {
    expect(isCuelinksUrl("https://linksredirect.com/?pub_id=123&url=https%3A%2F%2Famazon.in")).toBe(true);
    expect(isCuelinksUrl("https://clnk.in/abc123")).toBe(true);
    expect(isCuelinksUrl("https://www.amazon.in/dp/B09G9BL5CP")).toBe(false);
    expect(isCuelinksUrl("https://evil-linksredirect.com/?pub_id=123")).toBe(false);
  });

  it("builds deep-link URL with encoded target URL and subid", () => {
    const link = buildCuelinksDeepLink(
      "98765",
      "https://www.myntra.com/shoes?utm_source=ig&ref=1",
      "reel 42"
    );
    const parsed = new URL(link);
    expect(parsed.origin).toBe("https://linksredirect.com");
    expect(parsed.searchParams.get("pub_id")).toBe("98765");
    expect(parsed.searchParams.get("url")).toBe(
      "https://www.myntra.com/shoes?utm_source=ig&ref=1"
    );
    expect(parsed.searchParams.get("subid")).toBe("reel 42");
  });

  it("defaults subid to replyza and throws on invalid input", () => {
    const link = buildCuelinksDeepLink("98765", "https://ajio.com/p/1");
    expect(new URL(link).searchParams.get("subid")).toBe("replyza");
    expect(() => buildCuelinksDeepLink("", "https://ajio.com/p/1")).toThrow();
    expect(() => buildCuelinksDeepLink("98765", "javascript:alert(1)")).toThrow();
  });
});
