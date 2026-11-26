import { prisma } from "@replyza/database";

export interface TemplateData {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string | null;
  followRequired: boolean;
  followInstructionText?: string | null;
  followSuccessText?: string | null;
  followFallbackText?: string | null;
  isSystem: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SYSTEM_TEMPLATES: TemplateData[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "Friendly Link Delivery",
    category: "Friendly",
    description: "Warm, approachable comment-to-DM reply for everyday creator recommendations.",
    triggerType: "KEYWORD",
    keywords: ["LINK"],
    publicReplyText: "Check your DMs {{username}}! Sent it your way 😊",
    dmMessageText: "Hey {{first_name}}! 😊 Thanks for commenting! Here's the link you asked for: {{product_url}}",
    dmLink: "https://example.com/resource",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    name: "Professional Product Details",
    category: "Professional",
    description: "Polished, brand-safe response ideal for B2B, SaaS, and premium product launches.",
    triggerType: "KEYWORD",
    keywords: ["DETAILS", "INFO"],
    publicReplyText: "Thank you for your interest {{username}} — we've sent the details to your inbox.",
    dmMessageText: "Thank you for your interest, {{first_name}}. You can find the details for {{product_name}} below: {{product_url}}",
    dmLink: "https://example.com/product",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    name: "Creator Hype Reply",
    category: "Influencer",
    description: "High-energy creator tone that feels personal and drives quick link taps.",
    triggerType: "KEYWORD",
    keywords: ["SEND", "NEED"],
    publicReplyText: "Sent it to you!! Check your DMs ❤️",
    dmMessageText: "Heyyy {{first_name}}! ❤️ You asked for the {{product_name}} link, so here it is: {{product_url}}",
    dmLink: "https://example.com/creator-pick",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    name: "Flash Offer & Promo",
    category: "Promotional",
    description: "Urgency-focused promotional DM for limited-time sales and drops.",
    triggerType: "KEYWORD",
    keywords: ["SHOP", "BUY"],
    publicReplyText: "Sent you the offer link before it ends! 🔥",
    dmMessageText: "Here's {{product_name}} you've been looking for! Check it out before the offer ends 🔥 {{product_url}}",
    dmLink: "https://example.com/shop",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    name: "Exclusive Coupon Deal",
    category: "Exclusive Offer",
    description: "Deliver a tracked affiliate link paired with an exclusive coupon code.",
    triggerType: "KEYWORD",
    keywords: ["DEAL", "CODE"],
    publicReplyText: "Sent your exclusive code in DMs! 🎁",
    dmMessageText: "Here's your exclusive deal, {{first_name}}! Use code {{coupon_code}} and tap below to claim: {{product_url}}",
    dmLink: "https://example.com/deal",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000006",
    name: "Minimal Direct Link",
    category: "Minimal",
    description: "Short, zero-fluff DM that puts the link front and center.",
    triggerType: "KEYWORD",
    keywords: ["LINK"],
    publicReplyText: "Sent! 👇",
    dmMessageText: "Here is your link 👇",
    dmLink: "https://example.com/link",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000007",
    name: "Multi-Product Roundup",
    category: "Multiple Products",
    description: "Share multiple featured products from a haul, tutorial, or outfit reel.",
    triggerType: "KEYWORD",
    keywords: ["LINKS", "OUTFIT", "HAUL"],
    publicReplyText: "Sent all the product links to your DMs! 🛍️",
    dmMessageText: "Here are all the products you asked about, {{first_name}}! Take a look and find your favorite:",
    dmLink: null,
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000008",
    name: "Affiliate Favorites Collection",
    category: "Affiliate Collection",
    description: "Curated affiliate product collection with brand tags and tracking links preserved.",
    triggerType: "KEYWORD",
    keywords: ["RECOMMEND", "FAVES", "SHOP"],
    publicReplyText: "Sent my curated picks to your DMs ✨",
    dmMessageText: "These are my recommended products! I've added all the links below so you can check them out:",
    dmLink: null,
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000009",
    name: "Follow-to-Get-Link",
    category: "Custom",
    description: "Grow your follower count by requiring followership before delivering your product links.",
    triggerType: "KEYWORD",
    keywords: ["VIP"],
    publicReplyText: "Check your DMs to unlock VIP access! ✨",
    dmMessageText: "Hey {{first_name}}! Thanks for commenting. Follow our page and tap the button below to get your link instantly! 👇",
    dmLink: "https://example.com/vip",
    followRequired: true,
    followInstructionText: "Hey {{first_name}}! Thanks for commenting. Make sure to follow our page, then tap the button below to get your link! 👇",
    followSuccessText: "Woohoo! Thanks for following {{first_name}} 🎉 Here is your link:",
    followFallbackText: "Looks like you aren't following us yet! Please follow our profile and tap the button below to get your link.",
    isSystem: true,
  },
];

function mapTemplateRow(t: {
  id: string;
  name: string;
  category: string;
  description: string | null;
  triggerType: string;
  keywords: string[];
  publicReplyText: string;
  dmMessageText: string;
  dmLink: string | null;
  followRequired: boolean;
  followInstructionText: string | null;
  followSuccessText: string | null;
  followFallbackText: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TemplateData {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    triggerType: t.triggerType as "ANY_COMMENT" | "KEYWORD",
    keywords: t.keywords,
    publicReplyText: t.publicReplyText,
    dmMessageText: t.dmMessageText,
    dmLink: t.dmLink,
    followRequired: t.followRequired,
    followInstructionText: t.followInstructionText,
    followSuccessText: t.followSuccessText,
    followFallbackText: t.followFallbackText,
    isSystem: false,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export async function listTemplates(userId: string): Promise<TemplateData[]> {
  const customTemplates = await prisma.automationTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return [...SYSTEM_TEMPLATES, ...customTemplates.map(mapTemplateRow)];
}

export async function getTemplateById(
  userId: string,
  templateId: string
): Promise<TemplateData | null> {
  const system = SYSTEM_TEMPLATES.find((t) => t.id === templateId);
  if (system) return system;

  const custom = await prisma.automationTemplate.findFirst({
    where: { id: templateId, userId },
  });

  return custom ? mapTemplateRow(custom) : null;
}

export interface CreateTemplateInput {
  name: string;
  category?: string;
  description?: string;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords?: string[];
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string;
  followRequired?: boolean;
  followInstructionText?: string;
  followSuccessText?: string;
  followFallbackText?: string;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export async function createCustomTemplate(
  userId: string,
  input: CreateTemplateInput
): Promise<TemplateData> {
  const created = await prisma.automationTemplate.create({
    data: {
      userId,
      name: input.name,
      category: input.category || "Custom",
      description: input.description,
      triggerType: input.triggerType,
      keywords: input.keywords || [],
      publicReplyText: input.publicReplyText,
      dmMessageText: input.dmMessageText,
      dmLink: input.dmLink,
      followRequired: input.followRequired ?? false,
      followInstructionText: input.followInstructionText,
      followSuccessText: input.followSuccessText,
      followFallbackText: input.followFallbackText,
      isSystem: false,
    },
  });

  return mapTemplateRow(created);
}

export async function updateCustomTemplate(
  userId: string,
  templateId: string,
  input: UpdateTemplateInput
): Promise<TemplateData | null> {
  const existing = await prisma.automationTemplate.findFirst({
    where: { id: templateId, userId },
  });
  if (!existing) return null;

  const updated = await prisma.automationTemplate.update({
    where: { id: templateId },
    data: input,
  });

  return mapTemplateRow(updated);
}

export async function duplicateTemplate(
  userId: string,
  templateId: string
): Promise<TemplateData | null> {
  const source = await getTemplateById(userId, templateId);
  if (!source) return null;

  return createCustomTemplate(userId, {
    name: `${source.name} (Copy)`.slice(0, 100),
    category: source.category || "Custom",
    description: source.description ?? undefined,
    triggerType: source.triggerType,
    keywords: source.keywords,
    publicReplyText: source.publicReplyText,
    dmMessageText: source.dmMessageText,
    dmLink: source.dmLink ?? undefined,
    followRequired: source.followRequired,
    followInstructionText: source.followInstructionText ?? undefined,
    followSuccessText: source.followSuccessText ?? undefined,
    followFallbackText: source.followFallbackText ?? undefined,
  });
}

export async function deleteCustomTemplate(
  userId: string,
  templateId: string
): Promise<boolean> {
  const existing = await prisma.automationTemplate.findFirst({
    where: { id: templateId, userId },
  });

  if (!existing) return false;

  await prisma.automationTemplate.delete({
    where: { id: templateId },
  });

  return true;
}
