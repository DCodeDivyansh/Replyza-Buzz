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
    name: "Get Link",
    category: "Delivery",
    description: "Automatically delivers your resource link when someone comments with your keyword.",
    triggerType: "KEYWORD",
    keywords: ["LINK"],
    publicReplyText: "Check your DMs {{username}}! Sent it your way 🔥",
    dmMessageText: "Hey {{first_name}}! Thanks for asking for the link. Here is what you requested:",
    dmLink: "https://example.com/resource",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    name: "Product Promotion",
    category: "Sales",
    description: "Reward interested commenters with an exclusive discount code and link to buy.",
    triggerType: "KEYWORD",
    keywords: ["DEAL", "DISCOUNT"],
    publicReplyText: "Sent you the exclusive discount code in your DMs! 🎁",
    dmMessageText: "Hey {{first_name}}! Use code SAVE20 at checkout for 20% off. Shop the collection here:",
    dmLink: "https://example.com/shop",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    name: "Free Resource Guide",
    category: "Lead Magnet",
    description: "Deliver a free guide, checklist, or cheatsheet directly to your audience's inbox.",
    triggerType: "KEYWORD",
    keywords: ["GUIDE"],
    publicReplyText: "Sent the free guide to your inbox! Check your DMs 📩",
    dmMessageText: "Hey {{first_name}}! Here is your free guide download. Enjoy the insights!",
    dmLink: "https://example.com/guide.pdf",
    followRequired: false,
    isSystem: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    name: "Follow-to-Get-Link",
    category: "Growth",
    description: "Grow your follower count by requiring followership before delivering access.",
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
  {
    id: "a0000000-0000-4000-8000-000000000005",
    name: "Custom Automation",
    category: "Custom",
    description: "Start from a clean slate with your own custom triggers and responses.",
    triggerType: "KEYWORD",
    keywords: ["INFO"],
    publicReplyText: "Check your DMs {{username}}! 💬",
    dmMessageText: "Hey {{first_name}}! Thanks for reaching out. Here is more information:",
    dmLink: "https://example.com",
    followRequired: false,
    isSystem: true,
  },
];

export async function listTemplates(userId: string): Promise<TemplateData[]> {
  const customTemplates = await prisma.automationTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return [
    ...SYSTEM_TEMPLATES,
    ...customTemplates.map((t) => ({
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
    })),
  ];
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

  if (!custom) return null;

  return {
    id: custom.id,
    name: custom.name,
    category: custom.category,
    description: custom.description,
    triggerType: custom.triggerType as "ANY_COMMENT" | "KEYWORD",
    keywords: custom.keywords,
    publicReplyText: custom.publicReplyText,
    dmMessageText: custom.dmMessageText,
    dmLink: custom.dmLink,
    followRequired: custom.followRequired,
    followInstructionText: custom.followInstructionText,
    followSuccessText: custom.followSuccessText,
    followFallbackText: custom.followFallbackText,
    isSystem: false,
    createdAt: custom.createdAt,
    updatedAt: custom.updatedAt,
  };
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

  return {
    id: created.id,
    name: created.name,
    category: created.category,
    description: created.description,
    triggerType: created.triggerType as "ANY_COMMENT" | "KEYWORD",
    keywords: created.keywords,
    publicReplyText: created.publicReplyText,
    dmMessageText: created.dmMessageText,
    dmLink: created.dmLink,
    followRequired: created.followRequired,
    followInstructionText: created.followInstructionText,
    followSuccessText: created.followSuccessText,
    followFallbackText: created.followFallbackText,
    isSystem: false,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
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
