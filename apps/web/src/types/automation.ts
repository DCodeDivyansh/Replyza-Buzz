export type AutomationTrigger = "ANY_COMMENT" | "KEYWORD";
export type AutomationStatus = "DRAFT" | "ACTIVE" | "PAUSED";
export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";

export interface InstagramAccountInfo {
  id: string;
  username: string | null;
  instagramUserId: string;
  status?: "ACTIVE" | "NEEDS_RECONNECT";
  webhookSubscribed?: boolean;
  webhookSubscribedAt?: string | null;
  webhookSubscriptionError?: string | null;
  tokenExpiresAt?: string | null;
}

export type KeywordMatchMode = "CONTAINS" | "EXACT" | "ANY";
export type KeywordMatchLogic = "ANY_KEYWORD" | "ALL_KEYWORDS";
export type DeliveryMode = "DIRECT" | "BUTTON";
export type ProductDeliveryMode =
  | "SINGLE_MESSAGE"
  | "SEPARATE_MESSAGES"
  | "GENERIC_CARDS"
  | "SELECTION_PROMPT";
export type ProductStatus = "ACTIVE" | "ARCHIVED";

export interface AffiliateProduct {
  id: string;
  userId: string;
  name: string;
  brand: string | null;
  description: string | null;
  imageUrl: string | null;
  affiliateUrl: string;
  originalUrl: string | null;
  price: string | null;
  discountPrice: string | null;
  discountInfo: string | null;
  couponCode: string | null;
  affiliatePartner: string | null;
  category: string | null;
  ctaLabel: string;
  notes: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationProductItem {
  id?: string;
  affiliateProductId?: string | null;
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  productUrl?: string | null;
  affiliateUrl: string;
  originalUrl?: string | null;
  price?: string | null;
  discountPrice?: string | null;
  category?: string | null;
  ctaLabel?: string;
  customMessage?: string | null;
  couponCode?: string | null;
  brand?: string | null;
  sortOrder?: number;
}

export interface Automation {
  id: string;
  instagramAccountId: string;
  name: string;
  mediaId: string | null;
  mediaPermalink: string | null;
  mediaType: MediaType | null;
  triggerType: AutomationTrigger;
  keywordMatchMode?: KeywordMatchMode;
  keywordMatchLogic?: KeywordMatchLogic;
  keywords: string[];
  publicReplyEnabled?: boolean;
  publicReplyText: string;
  publicReplyVariations?: string[];
  dmMessageText: string;
  dmLink: string | null;
  productDeliveryMode?: ProductDeliveryMode;
  productIntroText?: string | null;
  productClosingText?: string | null;
  products?: AutomationProductItem[];
  deliveryMode?: DeliveryMode;
  buttonLabel?: string | null;
  cooldownSeconds?: number;
  dmMeFallbackEnabled?: boolean;
  followRequired: boolean;
  followInstructionText: string | null;
  followSuccessText: string | null;
  followFallbackText: string | null;
  followUpEnabled?: boolean;
  followUpText?: string | null;
  templateId: string | null;
  status: AutomationStatus;
  createdAt: string;
  updatedAt: string;
  instagramAccount?: InstagramAccountInfo;
}

export interface CreateAutomationPayload {
  instagramAccountId: string;
  name: string;
  mediaId?: string | null;
  mediaPermalink?: string | null;
  mediaType?: MediaType | null;
  triggerType: AutomationTrigger;
  keywordMatchMode?: KeywordMatchMode;
  keywordMatchLogic?: KeywordMatchLogic;
  keywords: string[];
  publicReplyEnabled?: boolean;
  publicReplyText: string;
  publicReplyVariations?: string[];
  dmMessageText: string;
  dmLink?: string | null;
  productDeliveryMode?: ProductDeliveryMode;
  productIntroText?: string | null;
  productClosingText?: string | null;
  products?: AutomationProductItem[];
  deliveryMode?: DeliveryMode;
  buttonLabel?: string | null;
  cooldownSeconds?: number;
  dmMeFallbackEnabled?: boolean;
  followRequired?: boolean;
  followInstructionText?: string | null;
  followSuccessText?: string | null;
  followFallbackText?: string | null;
  followUpEnabled?: boolean;
  followUpText?: string | null;
  templateId?: string | null;
}

export interface UpdateAutomationPayload {
  name?: string;
  mediaId?: string | null;
  triggerType?: AutomationTrigger;
  keywordMatchMode?: KeywordMatchMode;
  keywordMatchLogic?: KeywordMatchLogic;
  keywords?: string[];
  publicReplyEnabled?: boolean;
  publicReplyText?: string;
  publicReplyVariations?: string[];
  dmMessageText?: string;
  dmLink?: string | null;
  productDeliveryMode?: ProductDeliveryMode;
  productIntroText?: string | null;
  productClosingText?: string | null;
  products?: AutomationProductItem[];
  deliveryMode?: DeliveryMode;
  buttonLabel?: string | null;
  cooldownSeconds?: number;
  dmMeFallbackEnabled?: boolean;
  followRequired?: boolean;
  followInstructionText?: string | null;
  followSuccessText?: string | null;
  followFallbackText?: string | null;
  followUpEnabled?: boolean;
  followUpText?: string | null;
  templateId?: string | null;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  triggerType: AutomationTrigger;
  keywords: string[];
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string | null;
  followRequired: boolean;
  followInstructionText?: string | null;
  followSuccessText?: string | null;
  followFallbackText?: string | null;
  isSystem: boolean;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  thumbnail_url?: string;
  media_url?: string;
  permalink?: string;
  timestamp: string;
}

export type ExecutionStatusType =
  | "PENDING"
  | "PROCESSING"
  | "RETRY_PENDING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export type ActionStatusType =
  | "PENDING"
  | "PROCESSING"
  | "RETRY_PENDING"
  | "SUCCESS"
  | "FAILED"
  | "UNKNOWN"
  | "SKIPPED"
  | "CANCELLED";

export type ConversationStateType =
  | "HOOK_SENT"
  | "AWAITING_TAP"
  | "TAPPED"
  | "FOLLOW_CHECKING"
  | "AWAITING_FOLLOW"
  | "COMPLETED"
  | "EXPIRED_WINDOW"
  | "FAILED"
  | "NEEDS_RECONNECT";

export type DeliveryActionType =
  | "PUBLIC_REPLY"
  | "HOOK_DM"
  | "REWARD_DM"
  | "FOLLOW_PROMPT"
  | "FOLLOW_SUCCESS_DM"
  | "FOLLOW_RETRY_DM"
  | "FOLLOW_FALLBACK_DM";

export type DeliveryActionStatusType =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "RETRY_SCHEDULED"
  | "NEEDS_REVIEW"
  | "SKIPPED"
  | "CANCELLED";

export interface DeliveryActionRecord {
  id: string;
  actionType: DeliveryActionType;
  status: DeliveryActionStatusType;
  attempts: number;
  metaId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  sentAt: string | null;
}

export interface ExecutionRecord {
  id: string;
  automationId: string;
  status: ExecutionStatusType;
  conversationState?: ConversationStateType;
  publicReplyStatus: ActionStatusType;
  privateReplyStatus: ActionStatusType;
  metaReplyId: string | null;
  metaPrivateReplyId: string | null;
  errorMessage: string | null;
  retryCount: number;
  lastAttemptAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  followCheckStatus: ActionStatusType | null;
  followCheckSentAt: string | null;
  followCheckVerifiedAt: string | null;
  followCheckRetryCount: number;
  metaFollowCheckReplyId: string | null;
  followVerificationOutcome: string | null;
  followCheckError: string | null;
  deliveryActions?: DeliveryActionRecord[];
  automation: {
    id: string;
    name: string;
    mediaId: string | null;
    triggerType: AutomationTrigger;
    followRequired: boolean;
    instagramAccount: {
      id: string;
      username: string | null;
      instagramUserId: string;
    };
  };
  webhookEvent: {
    id: string;
    commentId: string;
    mediaId: string;
    commenterUsername: string | null;
    commentText: string;
    status: string;
    receivedAt: string;
    processedAt: string | null;
  };
  messagingEvents?: Array<{
    id: string;
    providerEventId: string;
    status: string;
    receivedAt: string;
    processedAt: string | null;
  }>;
}

export interface ExecutionListResponse {
  items: ExecutionRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
