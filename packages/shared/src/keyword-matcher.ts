export type KeywordMatchModeType = "CONTAINS" | "EXACT" | "ANY";
export type KeywordMatchLogicType = "ANY_KEYWORD" | "ALL_KEYWORDS";

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

function doesSingleKeywordMatch(
  normalizedComment: string,
  normalizedKeyword: string,
  mode: KeywordMatchModeType
): boolean {
  if (mode === "EXACT") {
    return normalizedComment === normalizedKeyword;
  }

  // CONTAINS mode: match whole token/phrase boundaries when alphanumeric,
  // or direct substring when keyword contains non-word symbols/emojis.
  const hasWordChars = /[\p{L}\p{N}]/u.test(normalizedKeyword);
  if (hasWordChars) {
    const pattern = new RegExp(
      `(?:^|\\s)${escapeRegex(normalizedKeyword)}(?:$|\\s)`,
      "u"
    );
    return pattern.test(normalizedComment);
  }
  return normalizedComment.includes(normalizedKeyword);
}

export function matchCommentKeywords(
  commentText: string,
  mode: KeywordMatchModeType,
  keywords: string[],
  matchLogic: KeywordMatchLogicType = "ANY_KEYWORD"
): { matched: boolean; matchedKeyword: string | null } {
  if (mode === "ANY") {
    return { matched: true, matchedKeyword: null };
  }

  const normalizedComment = normalizeForMatching(commentText);
  if (!normalizedComment) {
    return { matched: false, matchedKeyword: null };
  }

  const validKeywords = keywords
    .map((raw) => ({ raw: raw.trim(), normalized: normalizeForMatching(raw) }))
    .filter((k) => k.normalized.length > 0);

  if (validKeywords.length === 0) {
    return { matched: false, matchedKeyword: null };
  }

  if (matchLogic === "ALL_KEYWORDS") {
    for (const kw of validKeywords) {
      if (!doesSingleKeywordMatch(normalizedComment, kw.normalized, mode)) {
        return { matched: false, matchedKeyword: null };
      }
    }
    return { matched: true, matchedKeyword: validKeywords[0].raw };
  }

  for (const kw of validKeywords) {
    if (doesSingleKeywordMatch(normalizedComment, kw.normalized, mode)) {
      return { matched: true, matchedKeyword: kw.raw };
    }
  }

  return { matched: false, matchedKeyword: null };
}
