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

export interface Automation {
  id: string;
  instagramAccountId: string;
  name: string;
  mediaId: string;
  mediaPermalink: string | null;
  mediaType: MediaType | null;
  triggerType: AutomationTrigger;
  keywords: string[];
  publicReplyText: string;
  dmMessageText: string;
  dmLink: string | null;
  followRequired: boolean;
  followInstructionText: string | null;
  followSuccessText: string | null;
  followFallbackText: string | null;
  templateId: string | null;
  status: AutomationStatus;
  createdAt: string;
  updatedAt: string;
  instagramAccount?: InstagramAccountInfo;
}

export interface CreateAutomationPayload {
  instagramAccountId: string;
  name: string;
  mediaId: string;
  mediaPermalink?: string;
  mediaType?: MediaType;
  triggerType: AutomationTrigger;
  keywords: string[];
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string;
  followRequired?: boolean;
  followInstructionText?: string;
  followSuccessText?: string;
  followFallbackText?: string;
  templateId?: string;
}

export interface UpdateAutomationPayload {
  name?: string;
  triggerType?: AutomationTrigger;
  keywords?: string[];
  publicReplyText?: string;
  dmMessageText?: string;
  dmLink?: string | null;
  followRequired?: boolean;
  followInstructionText?: string | null;
  followSuccessText?: string | null;
  followFallbackText?: string | null;
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

export interface ExecutionRecord {
  id: string;
  automationId: string;
  status: ExecutionStatusType;
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
  automation: {
    id: string;
    name: string;
    mediaId: string;
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
