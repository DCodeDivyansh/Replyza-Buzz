export type KeywordMatchModeType = "CONTAINS" | "EXACT" | "ANY";

/**
 * Normalizes comment or keyword text for Unicode/punctuation/case-insensitive matching
 * while preserving letters, numbers, and emoji characters.
 */
export function normalizeForMatching(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    // Replace standard punctuation (ASCII & Unicode punctuation) with spaces, keeping letters, numbers, and symbols/emojis
    .replace(/[\p{P}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchCommentKeywords(
  commentText: string,
  mode: KeywordMatchModeType,
  keywords: string[]
): { matched: boolean; matchedKeyword: string | null } {
  if (mode === "ANY") {
    return { matched: true, matchedKeyword: null };
  }

  const normalizedComment = normalizeForMatching(commentText);
  if (!normalizedComment) {
    return { matched: false, matchedKeyword: null };
  }

  for (const rawKeyword of keywords) {
    const normalizedKeyword = normalizeForMatching(rawKeyword);
    if (!normalizedKeyword) continue;

    if (mode === "EXACT") {
      if (normalizedComment === normalizedKeyword) {
        return { matched: true, matchedKeyword: rawKeyword.trim() };
      }
      continue;
    }

    // CONTAINS mode: match whole token/phrase boundaries when alphanumeric,
    // or direct substring when keyword contains non-word symbols/emojis.
    const hasWordChars = /[\p{L}\p{N}]/u.test(normalizedKeyword);
    if (hasWordChars) {
      const pattern = new RegExp(
        `(?:^|\\s)${escapeRegex(normalizedKeyword)}(?:$|\\s)`,
        "u"
      );
      if (pattern.test(normalizedComment)) {
        return { matched: true, matchedKeyword: rawKeyword.trim() };
      }
    } else if (normalizedComment.includes(normalizedKeyword)) {
      return { matched: true, matchedKeyword: rawKeyword.trim() };
    }
  }

  return { matched: false, matchedKeyword: null };
}
