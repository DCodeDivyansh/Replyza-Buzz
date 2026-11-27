export type TargetModeType =
  | "SPECIFIC_POST"
  | "ALL_POSTS"
  | "NEXT_POST"
  | "SCHEDULED_TIME";

export type MediaTypeFilterType = "ANY" | "REELS" | "FEED";

export interface BindableMediaCandidate {
  id: string;
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  timestamp?: string;
  caption?: string;
}

export interface ScheduledBindingRule {
  targetMode: TargetModeType;
  scheduledActivateAt?: Date | string | null;
  bindingWindowEndAt?: Date | string | null;
  mediaTypeFilter?: MediaTypeFilterType | null;
  captionKeywordFilter?: string | null;
  createdAt?: Date | string;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Checks whether an Instagram media item satisfies a SCHEDULED_TIME or NEXT_POST
 * automation's time window, media type filter, and optional caption keyword filter.
 */
export function matchesScheduledMediaFilters(
  media: BindableMediaCandidate,
  rule: ScheduledBindingRule,
  now: Date = new Date()
): boolean {
  // 1. Media type filter
  const filter = rule.mediaTypeFilter ?? "ANY";
  if (filter === "REELS") {
    const isReel = media.media_product_type
      ? media.media_product_type === "REELS"
      : media.media_type === "VIDEO";
    if (!isReel) return false;
  } else if (filter === "FEED") {
    const isFeed = media.media_product_type
      ? media.media_product_type === "FEED"
      : media.media_type === "IMAGE" || media.media_type === "CAROUSEL_ALBUM";
    if (!isFeed) return false;
  }

  // 2. Caption keyword filter (case-insensitive substring match)
  const captionFilter = rule.captionKeywordFilter?.trim();
  if (captionFilter) {
    const caption = (media.caption ?? "").toLowerCase();
    if (!caption.includes(captionFilter.toLowerCase())) {
      return false;
    }
  }

  // 3. Time-window check
  if (rule.targetMode === "SCHEDULED_TIME") {
    if (!rule.scheduledActivateAt) return false;
    const activateMs = new Date(rule.scheduledActivateAt).getTime();
    const minMediaTimeMs = activateMs - FIVE_MINUTES_MS;
    const endMs = rule.bindingWindowEndAt
      ? new Date(rule.bindingWindowEndAt).getTime()
      : activateMs + 30 * 60 * 1000;

    if (now.getTime() < minMediaTimeMs || now.getTime() > endMs) {
      return false;
    }

    if (media.timestamp) {
      const mediaTs = new Date(media.timestamp).getTime();
      if (Number.isFinite(mediaTs) && mediaTs < minMediaTimeMs) {
        return false;
      }
    }
  } else if (rule.targetMode === "NEXT_POST") {
    // For NEXT_POST, only bind posts published after (automation.createdAt - 5m)
    if (rule.createdAt && media.timestamp) {
      const createdMs = new Date(rule.createdAt).getTime();
      const mediaTs = new Date(media.timestamp).getTime();
      if (Number.isFinite(mediaTs) && mediaTs < createdMs - FIVE_MINUTES_MS) {
        return false;
      }
    }
  }

  return true;
}
