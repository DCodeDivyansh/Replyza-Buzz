export interface InterpolationContext {
  firstName?: string | null;
  username?: string | null;
  keyword?: string | null;
  link?: string | null;
}

export function interpolateVariables(
  text: string,
  context: InterpolationContext
): string {
  if (!text) return "";

  const cleanUsername = context.username
    ? context.username.replace(/^@/, "")
    : "user";

  const name =
    context.firstName && context.firstName.trim().length > 0
      ? context.firstName.trim()
      : context.username
      ? `@${cleanUsername}`
      : "there";

  const keyword = context.keyword ?? "";
  const link = context.link ?? "";

  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, name)
    .replace(/@?\{\{\s*username\s*\}\}/gi, `@${cleanUsername}`)
    .replace(/\{\{\s*keyword\s*\}\}/gi, keyword)
    .replace(/\{\{\s*link\s*\}\}/gi, link);
}
