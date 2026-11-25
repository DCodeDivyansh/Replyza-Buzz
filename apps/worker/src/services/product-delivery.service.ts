import { interpolateVariables, type InterpolationContext } from "@replyza/shared";
import {
  sendDirectMessage,
  sendGenericTemplateMessage,
  sendPrivateReply,
  sendPrivateReplyWithQuickReply,
  type GenericTemplateElement,
  type QuickReplyOption,
} from "./instagram-graph.service";

export interface DeliverableProduct {
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  affiliateUrl: string;
  price?: string | null;
  discountPrice?: string | null;
  ctaLabel?: string | null;
  customMessage?: string | null;
  couponCode?: string | null;
  brand?: string | null;
}

export type ProductDeliveryModeType =
  | "SINGLE_MESSAGE"
  | "SEPARATE_MESSAGES"
  | "GENERIC_CARDS"
  | "SELECTION_PROMPT";

export interface DeliverProductsParams {
  executionId: string;
  instagramUserId: string;
  accessToken: string;
  isPrivateReply: boolean;
  commentId?: string;
  recipientIgsid?: string;
  baseText: string;
  dmLink?: string | null;
  products: DeliverableProduct[];
  productDeliveryMode: ProductDeliveryModeType;
  productIntroText?: string | null;
  productClosingText?: string | null;
  followUpEnabled?: boolean;
  followUpText?: string | null;
  selectedProductIndex?: number;
  baseContext: Omit<
    InterpolationContext,
    "productName" | "productUrl" | "couponCode" | "productPrice" | "brand"
  >;
}

function buildProductContext(
  baseContext: DeliverProductsParams["baseContext"],
  product?: DeliverableProduct,
  fallbackLink?: string | null
): InterpolationContext {
  return {
    ...baseContext,
    link: product?.affiliateUrl || fallbackLink || undefined,
    productName: product?.name ?? undefined,
    productUrl: product?.affiliateUrl || fallbackLink || undefined,
    couponCode: product?.couponCode ?? undefined,
    productPrice: product?.discountPrice || product?.price || undefined,
    brand: product?.brand ?? undefined,
  };
}

function formatProductLine(p: DeliverableProduct, index: number, numbered: boolean): string {
  const prefix = numbered ? `${index + 1}. ` : "";
  const priceTag = p.discountPrice
    ? p.price
      ? ` (${p.discountPrice} — was ${p.price})`
      : ` (${p.discountPrice})`
    : p.price
    ? ` (${p.price})`
    : "";
  const coupon = p.couponCode ? `\n   Code: ${p.couponCode}` : "";
  const custom = p.customMessage ? `\n   ${p.customMessage}` : "";
  return `${prefix}${p.name}${priceTag}${custom}${coupon}\n${p.affiliateUrl}`;
}

function formatSingleMessageText(params: DeliverProductsParams): string {
  const firstProduct = params.products[0];
  const ctx = buildProductContext(params.baseContext, firstProduct, params.dmLink);

  const intro = interpolateVariables(
    params.productIntroText || params.baseText,
    ctx
  );

  if (params.products.length === 0) {
    return params.dmLink ? `${intro}\n${params.dmLink}` : intro;
  }

  const numbered = params.products.length > 1;
  const productLines = params.products
    .map((p, i) => formatProductLine(p, i, numbered))
    .join("\n\n");

  const closing = params.productClosingText
    ? `\n\n${interpolateVariables(params.productClosingText, ctx)}`
    : "";

  return `${intro}\n\n${productLines}${closing}`.slice(0, 1000);
}

/**
 * Delivers single or multiple product links via Instagram's official Messaging API,
 * respecting Meta's Private Reply vs. 24-hour IGSID messaging constraints.
 */
export async function deliverProducts(params: DeliverProductsParams): Promise<string> {
  const {
    executionId,
    instagramUserId,
    accessToken,
    isPrivateReply,
    commentId,
    recipientIgsid,
    products,
    productDeliveryMode,
    selectedProductIndex,
  } = params;

  // 1. Private Reply path (recipient: { comment_id })
  // Meta allows only ONE private reply per comment and only text or text + quick_replies.
  if (isPrivateReply) {
    if (!commentId) {
      throw new Error("commentId is required for private reply delivery");
    }

    if (productDeliveryMode === "SELECTION_PROMPT" && products.length > 1) {
      const ctx = buildProductContext(params.baseContext, products[0], params.dmLink);
      const promptText = interpolateVariables(
        params.productIntroText || params.baseText || "Which product link would you like? Tap below 👇",
        ctx
      );
      const quickReplies: QuickReplyOption[] = products.slice(0, 13).map((p, idx) => ({
        content_type: "text",
        title: p.name.slice(0, 20),
        payload: `PRODUCT_SELECT:${executionId}:${idx}`,
      }));

      return sendPrivateReplyWithQuickReply(
        instagramUserId,
        commentId,
        promptText,
        quickReplies,
        accessToken
      );
    }

    // For SINGLE_MESSAGE, SEPARATE_MESSAGES, or GENERIC_CARDS in Direct Private Reply mode,
    // Meta's comment_id endpoint only accepts 1 text message, so we send the formatted text list.
    const messageText = formatSingleMessageText(params);
    return sendPrivateReply(instagramUserId, commentId, messageText, accessToken);
  }

  // 2. Standard 24-hour DM path (recipient: { id: IGSID })
  if (!recipientIgsid) {
    throw new Error("recipientIgsid is required for standard DM delivery");
  }

  // If user selected a specific product from SELECTION_PROMPT
  if (
    productDeliveryMode === "SELECTION_PROMPT" &&
    selectedProductIndex !== undefined &&
    products[selectedProductIndex]
  ) {
    const chosen = products[selectedProductIndex];
    const ctx = buildProductContext(params.baseContext, chosen, params.dmLink);
    const intro = chosen.customMessage
      ? interpolateVariables(chosen.customMessage, ctx)
      : interpolateVariables(
          `Here is ${chosen.name}!`,
          ctx
        );
    const msg = `${intro}\n${formatProductLine(chosen, 0, false)}`.slice(0, 1000);
    const msgId = await sendDirectMessage(instagramUserId, recipientIgsid, msg, accessToken);

    if (params.followUpEnabled && params.followUpText) {
      const followUp = interpolateVariables(params.followUpText, ctx).slice(0, 1000);
      await sendDirectMessage(instagramUserId, recipientIgsid, followUp, accessToken).catch(() => {});
    }
    return msgId;
  }

  let primaryMessageId: string;

  if (productDeliveryMode === "GENERIC_CARDS" && products.length > 0) {
    const validElements: GenericTemplateElement[] = products
      .filter((p) => p.affiliateUrl.startsWith("https://") || p.affiliateUrl.startsWith("http://"))
      .slice(0, 10)
      .map((p) => {
        const subtitleParts = [
          p.brand,
          p.discountPrice ? `${p.discountPrice}${p.price ? ` (was ${p.price})` : ""}` : p.price,
          p.couponCode ? `Code: ${p.couponCode}` : null,
          p.description,
        ].filter(Boolean);

        return {
          title: p.name.slice(0, 80),
          subtitle: subtitleParts.join(" · ").slice(0, 80) || undefined,
          image_url:
            p.imageUrl && p.imageUrl.startsWith("https://")
              ? p.imageUrl
              : undefined,
          default_action: {
            type: "web_url" as const,
            url: p.affiliateUrl,
          },
          buttons: [
            {
              type: "web_url" as const,
              url: p.affiliateUrl,
              title: (p.ctaLabel || "Shop Now").slice(0, 20),
            },
          ],
        };
      });

    if (validElements.length > 0) {
      const ctx = buildProductContext(params.baseContext, products[0], params.dmLink);
      if (params.productIntroText || params.baseText) {
        const intro = interpolateVariables(
          params.productIntroText || params.baseText,
          ctx
        ).slice(0, 1000);
        await sendDirectMessage(instagramUserId, recipientIgsid, intro, accessToken).catch(() => {});
      }

      try {
        primaryMessageId = await sendGenericTemplateMessage(
          instagramUserId,
          recipientIgsid,
          validElements,
          accessToken
        );
      } catch {
        // Fallback to formatted text if Meta rejects generic template for this account/payload
        primaryMessageId = await sendDirectMessage(
          instagramUserId,
          recipientIgsid,
          formatSingleMessageText(params),
          accessToken
        );
      }
    } else {
      primaryMessageId = await sendDirectMessage(
        instagramUserId,
        recipientIgsid,
        formatSingleMessageText(params),
        accessToken
      );
    }
  } else if (productDeliveryMode === "SEPARATE_MESSAGES" && products.length > 1) {
    const firstCtx = buildProductContext(params.baseContext, products[0], params.dmLink);
    const introText = interpolateVariables(
      params.productIntroText || params.baseText,
      firstCtx
    ).slice(0, 1000);
    primaryMessageId = await sendDirectMessage(
      instagramUserId,
      recipientIgsid,
      introText,
      accessToken
    );

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const msg = formatProductLine(p, i, false).slice(0, 1000);
      primaryMessageId = await sendDirectMessage(
        instagramUserId,
        recipientIgsid,
        msg,
        accessToken
      );
    }

    if (params.productClosingText) {
      const closing = interpolateVariables(params.productClosingText, firstCtx).slice(0, 1000);
      await sendDirectMessage(instagramUserId, recipientIgsid, closing, accessToken).catch(() => {});
    }
  } else if (productDeliveryMode === "SELECTION_PROMPT" && products.length > 1) {
    const ctx = buildProductContext(params.baseContext, products[0], params.dmLink);
    const promptText = interpolateVariables(
      params.productIntroText || params.baseText || "Tap a product below to get its link 👇",
      ctx
    ).slice(0, 1000);
    const quickReplies: QuickReplyOption[] = products.slice(0, 13).map((p, idx) => ({
      content_type: "text",
      title: p.name.slice(0, 20),
      payload: `PRODUCT_SELECT:${executionId}:${idx}`,
    }));
    return sendDirectMessage(
      instagramUserId,
      recipientIgsid,
      promptText,
      accessToken,
      quickReplies
    );
  } else {
    primaryMessageId = await sendDirectMessage(
      instagramUserId,
      recipientIgsid,
      formatSingleMessageText(params),
      accessToken
    );
  }

  // Send optional policy-compliant follow-up within the active 24h window
  if (params.followUpEnabled && params.followUpText) {
    const ctx = buildProductContext(params.baseContext, products[0], params.dmLink);
    const followUp = interpolateVariables(params.followUpText, ctx).slice(0, 1000);
    await sendDirectMessage(instagramUserId, recipientIgsid, followUp, accessToken).catch(() => {});
  }

  return primaryMessageId;
}
