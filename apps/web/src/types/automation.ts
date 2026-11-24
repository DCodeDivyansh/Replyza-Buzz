export type AutomationTrigger = "ANY_COMMENT" | "KEYWORD";
export type AutomationStatus = "DRAFT" | "ACTIVE" | "PAUSED";
export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";

export interface InstagramAccountInfo {
  id: string;
  username: string | null;
  instagramUserId: string;
  status?: "ACTIVE" | "NEEDS_RECONNECT";
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
}

export interface UpdateAutomationPayload {
  name?: string;
  triggerType?: AutomationTrigger;
  keywords?: string[];
  publicReplyText?: string;
  dmMessageText?: string;
  dmLink?: string | null;
}
