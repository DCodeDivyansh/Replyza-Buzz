import { describe, it, expect } from "vitest";
import { matchCommentKeywords } from "@replyza/shared";

describe("Keyword Matcher", () => {
  it("matches ANY_KEYWORD when at least one keyword is present", () => {
    const res = matchCommentKeywords("Send me the LINK please!", "CONTAINS", ["LINK", "SHOP"], "ANY_KEYWORD");
    expect(res.matched).toBe(true);
    expect(res.matchedKeyword).toBe("LINK");
  });

  it("requires all keywords when matchLogic is ALL_KEYWORDS", () => {
    const miss = matchCommentKeywords("Send me the LINK please!", "CONTAINS", ["LINK", "PRICE"], "ALL_KEYWORDS");
    expect(miss.matched).toBe(false);

    const hit = matchCommentKeywords("Send me the PRICE and LINK please!", "CONTAINS", ["LINK", "PRICE"], "ALL_KEYWORDS");
    expect(hit.matched).toBe(true);
  });
});
