export interface InterpolationContext {
  firstName?: string | null;
  username?: string | null;
  keyword?: string | null;
  link?: string | null;
  productName?: string | null;
  productUrl?: string | null;
  couponCode?: string | null;
  productPrice?: string | null;
  brand?: string | null;
}

export const SUPPORTED_TEMPLATE_VARIABLES = [
  "first_name",
  "username",
  "keyword",
  "link",
  "product_name",
  "product_url",
  "coupon_code",
  "product_price",
  "brand",
] as const;

export type SupportedTemplateVariable = (typeof SUPPORTED_TEMPLATE_VARIABLES)[number];

export interface VariableValidationResult {
  valid: boolean;
  unsupportedVariables: string[];
  usedVariables: string[];
}

/**
 * Extracts `{{variable}}` tokens and validates that every placeholder is
 * in the supported execution context list.
 */
export function validateTemplateVariables(
  text: string,
  allowedVariables: readonly string[] = SUPPORTED_TEMPLATE_VARIABLES
): VariableValidationResult {
  if (!text) {
    return { valid: true, unsupportedVariables: [], usedVariables: [] };
  }

  const allowedSet = new Set(allowedVariables.map((v) => v.toLowerCase()));
  const used = new Set<string>();
  const unsupported = new Set<string>();

  const regex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawName = match[1].trim().toLowerCase();
    used.add(rawName);
    if (!allowedSet.has(rawName)) {
      unsupported.add(rawName);
    }
  }

  return {
    valid: unsupported.size === 0,
    unsupportedVariables: Array.from(unsupported),
    usedVariables: Array.from(used),
  };
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
  const link = context.link ?? context.productUrl ?? "";
  const productName = context.productName ?? "";
  const productUrl = context.productUrl ?? context.link ?? "";
  const couponCode = context.couponCode ?? "";
  const productPrice = context.productPrice ?? "";
  const brand = context.brand ?? "";

  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, name)
    .replace(/@?\{\{\s*username\s*\}\}/gi, `@${cleanUsername}`)
    .replace(/\{\{\s*keyword\s*\}\}/gi, keyword)
    .replace(/\{\{\s*link\s*\}\}/gi, link)
    .replace(/\{\{\s*product_name\s*\}\}/gi, productName)
    .replace(/\{\{\s*product_url\s*\}\}/gi, productUrl)
    .replace(/\{\{\s*coupon_code\s*\}\}/gi, couponCode)
    .replace(/\{\{\s*product_price\s*\}\}/gi, productPrice)
    .replace(/\{\{\s*brand\s*\}\}/gi, brand);
}
