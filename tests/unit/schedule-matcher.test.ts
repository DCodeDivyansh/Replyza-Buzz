import { describe, it, expect } from "vitest";
import { matchesScheduledMediaFilters } from "@replyza/shared";

describe("matchesScheduledMediaFilters", () => {
  const baseTime = new Date("2026-11-28T11:00:00.000Z");

  it("matches a post published within [scheduledActivateAt - 5m, bindingWindowEndAt]", () => {
    const ok = matchesScheduledMediaFilters(
      {
        id: "m_1",
        media_type: "VIDEO",
        media_product_type: "REELS",
        timestamp: "2026-11-28T10:57:00.000Z",
        caption: "New drop #summer",
      },
      {
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: baseTime,
        bindingWindowEndAt: new Date("2026-11-28T11:30:00.000Z"),
        mediaTypeFilter: "REELS",
        captionKeywordFilter: "#summer",
      },
      new Date("2026-11-28T11:02:00.000Z")
    );
    expect(ok).toBe(true);
  });

  it("rejects posts published before scheduledActivateAt - 5m", () => {
    const ok = matchesScheduledMediaFilters(
      {
        id: "m_old",
        media_type: "IMAGE",
        media_product_type: "FEED",
        timestamp: "2026-11-28T10:50:00.000Z",
      },
      {
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: baseTime,
        bindingWindowEndAt: new Date("2026-11-28T11:30:00.000Z"),
        mediaTypeFilter: "ANY",
      },
      new Date("2026-11-28T11:02:00.000Z")
    );
    expect(ok).toBe(false);
  });

  it("rejects wrong mediaTypeFilter (FEED and STORY posts when REELS required)", () => {
    const feedOk = matchesScheduledMediaFilters(
      {
        id: "m_feed",
        media_type: "IMAGE",
        media_product_type: "FEED",
        timestamp: "2026-11-28T11:01:00.000Z",
      },
      {
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: baseTime,
        bindingWindowEndAt: new Date("2026-11-28T11:30:00.000Z"),
        mediaTypeFilter: "REELS",
      },
      new Date("2026-11-28T11:02:00.000Z")
    );
    const storyOk = matchesScheduledMediaFilters(
      {
        id: "m_story",
        media_type: "VIDEO",
        media_product_type: "STORY",
        timestamp: "2026-11-28T11:01:00.000Z",
      },
      {
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: baseTime,
        bindingWindowEndAt: new Date("2026-11-28T11:30:00.000Z"),
        mediaTypeFilter: "REELS",
      },
      new Date("2026-11-28T11:02:00.000Z")
    );
    expect(feedOk).toBe(false);
    expect(storyOk).toBe(false);
  });

  it("rejects captionKeywordFilter when caption is empty or missing", () => {
    const ok = matchesScheduledMediaFilters(
      {
        id: "m_empty_cap",
        media_type: "VIDEO",
        media_product_type: "REELS",
        timestamp: "2026-11-28T11:01:00.000Z",
      },
      {
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: baseTime,
        bindingWindowEndAt: new Date("2026-11-28T11:30:00.000Z"),
        mediaTypeFilter: "REELS",
        captionKeywordFilter: "#summer",
      },
      new Date("2026-11-28T11:02:00.000Z")
    );
    expect(ok).toBe(false);
  });

  it("NEXT_POST ignores posts published before createdAt - 5m and matches newer posts", () => {
    const createdAt = new Date("2026-11-28T12:00:00.000Z");
    const oldPost = matchesScheduledMediaFilters(
      {
        id: "m_before",
        media_type: "IMAGE",
        media_product_type: "FEED",
        timestamp: "2026-11-28T11:50:00.000Z",
      },
      { targetMode: "NEXT_POST", createdAt, mediaTypeFilter: "ANY" },
      new Date("2026-11-28T12:05:00.000Z")
    );
    const newPost = matchesScheduledMediaFilters(
      {
        id: "m_after",
        media_type: "IMAGE",
        media_product_type: "FEED",
        timestamp: "2026-11-28T12:02:00.000Z",
      },
      { targetMode: "NEXT_POST", createdAt, mediaTypeFilter: "ANY" },
      new Date("2026-11-28T12:05:00.000Z")
    );
    expect(oldPost).toBe(false);
    expect(newPost).toBe(true);
  });

  it("rejects captionKeywordFilter mismatch (case-insensitive)", () => {
    const ok = matchesScheduledMediaFilters(
      {
        id: "m_cap",
        media_type: "VIDEO",
        media_product_type: "REELS",
        timestamp: "2026-11-28T11:01:00.000Z",
        caption: "Check out our winter sale",
      },
      {
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: baseTime,
        bindingWindowEndAt: new Date("2026-11-28T11:30:00.000Z"),
        mediaTypeFilter: "REELS",
        captionKeywordFilter: "#SUMMER",
      },
      new Date("2026-11-28T11:02:00.000Z")
    );
    expect(ok).toBe(false);
  });

  it("rejects when current time is past bindingWindowEndAt", () => {
    const ok = matchesScheduledMediaFilters(
      {
        id: "m_late",
        media_type: "IMAGE",
        media_product_type: "FEED",
        timestamp: "2026-11-28T11:01:00.000Z",
      },
      {
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: baseTime,
        bindingWindowEndAt: new Date("2026-11-28T11:30:00.000Z"),
        mediaTypeFilter: "ANY",
      },
      new Date("2026-11-28T11:31:00.000Z")
    );
    expect(ok).toBe(false);
  });
});
