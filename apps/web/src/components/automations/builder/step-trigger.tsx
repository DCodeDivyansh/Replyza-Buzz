"use client";

import React, { useState } from "react";
import {
  InstagramAccountInfo,
  InstagramMedia,
  KeywordMatchLogic,
  KeywordMatchMode,
  MediaTypeFilter,
  TargetMode,
} from "@/types/automation";
import { MediaGrid } from "@/components/media/media-grid";
import { CalendarClock, Plus, Sparkles, Trash2, X } from "lucide-react";

interface StepTriggerProps {
  name: string;
  onChangeName: (v: string) => void;
  accountId: string;
  onChangeAccountId: (v: string) => void;
  discoveredAccounts: InstagramAccountInfo[];
  isEditMode: boolean;
  targetMode: TargetMode;
  onChangeTargetMode: (v: TargetMode) => void;
  scheduledActivateAtLocal: string;
  onChangeScheduledActivateAtLocal: (v: string) => void;
  bindingWindowMinutes: number;
  onChangeBindingWindowMinutes: (v: number) => void;
  mediaTypeFilter: MediaTypeFilter;
  onChangeMediaTypeFilter: (v: MediaTypeFilter) => void;
  captionKeywordFilter: string;
  onChangeCaptionKeywordFilter: (v: string) => void;
  mediaId: string;
  onSelectMedia: (m: InstagramMedia) => void;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  onChangeTriggerType: (v: "ANY_COMMENT" | "KEYWORD") => void;
  keywords: string[];
  onChangeKeywords: (next: string[]) => void;
  keywordMatchMode: KeywordMatchMode;
  onChangeKeywordMatchMode: (v: KeywordMatchMode) => void;
  keywordMatchLogic: KeywordMatchLogic;
  onChangeKeywordMatchLogic: (v: KeywordMatchLogic) => void;
  publicReplyEnabled: boolean;
  onChangePublicReplyEnabled: (v: boolean) => void;
  publicReplyText: string;
  onChangePublicReplyText: (v: string) => void;
  publicReplyVariations: string[];
  onChangePublicReplyVariations: (v: string[]) => void;
}

export function StepTrigger({
  name,
  onChangeName,
  accountId,
  onChangeAccountId,
  discoveredAccounts,
  isEditMode,
  targetMode,
  onChangeTargetMode,
  scheduledActivateAtLocal,
  onChangeScheduledActivateAtLocal,
  bindingWindowMinutes,
  onChangeBindingWindowMinutes,
  mediaTypeFilter,
  onChangeMediaTypeFilter,
  captionKeywordFilter,
  onChangeCaptionKeywordFilter,
  mediaId,
  onSelectMedia,
  triggerType,
  onChangeTriggerType,
  keywords,
  onChangeKeywords,
  keywordMatchMode,
  onChangeKeywordMatchMode,
  keywordMatchLogic,
  onChangeKeywordMatchLogic,
  publicReplyEnabled,
  onChangePublicReplyEnabled,
  publicReplyText,
  onChangePublicReplyText,
  publicReplyVariations,
  onChangePublicReplyVariations,
}: StepTriggerProps) {
  const [keywordInput, setKeywordInput] = useState("");

  const addKeywordToken = (raw: string) => {
    const clean = raw.replace(/,/g, "").trim();
    if (!clean) return;
    if (!keywords.includes(clean)) {
      onChangeKeywords([...keywords, clean]);
    }
    setKeywordInput("");
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeywordToken(keywordInput);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] p-5 sm:p-6 space-y-6">
      {/* Editorial Underlined Title Input + Account */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <label
              htmlFor="builder-auto-name"
              className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E655F] block mb-1"
            >
              Automation Name
            </label>
            <input
              id="builder-auto-name"
              aria-label="Automation name"
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="e.g. Morning Glow Serum Links"
              className="w-full border-0 border-b border-[#E6DFD8] bg-transparent pb-2 text-lg sm:text-xl font-bold text-[#161413] placeholder:text-[#8C8A84]/60 focus:border-[#E1306C] focus:outline-none transition-colors"
            />
          </div>

          {discoveredAccounts.length > 0 && (
            <div className="sm:w-52">
              <label className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E655F] block mb-1">
                Instagram Account
              </label>
              <select
                value={accountId}
                onChange={(e) => onChangeAccountId(e.target.value)}
                disabled={isEditMode}
                className="w-full rounded-xl border border-[#E6DFD8] bg-[#F7F1EC] px-3 py-2 text-xs font-semibold text-[#161413] focus:border-[#E1306C] focus:outline-none disabled:opacity-60"
              >
                {discoveredAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username || acc.instagramUserId}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Target Post / Reel Selector */}
      <div className="space-y-3 pt-2 border-t border-[#E6DFD8]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-[#161413]">
              Target Post or Reel
            </h3>
            <p className="text-xs text-[#6E655F]">
              Choose a specific post/Reel or match comments across all posts.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[#E6DFD8] bg-[#F7F1EC] p-1 self-start">
            {(
              [
                { id: "SPECIFIC_POST", label: "Specific Post / Reel" },
                { id: "ALL_POSTS", label: "All Posts & Reels" },
                { id: "SCHEDULED_TIME", label: "Schedule Upcoming" },
                { id: "NEXT_POST", label: "Next Post / Reel" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={isEditMode && targetMode !== "SCHEDULED_TIME"}
                onClick={() => onChangeTargetMode(opt.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                  targetMode === opt.id
                    ? "bg-[#161413] text-[#F7F1EC]"
                    : "text-[#6E655F] hover:text-[#161413]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {targetMode === "SPECIFIC_POST" && accountId && !isEditMode && (
          <MediaGrid
            initialAccountId={accountId}
            selectedMediaId={mediaId}
            onSelectForAutomation={onSelectMedia}
          />
        )}

        {(targetMode === "SCHEDULED_TIME" || targetMode === "NEXT_POST") && (
          <div className="rounded-xl border border-[#E6DFD8] bg-[#F7F1EC]/70 p-4 space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FCE8EC] text-[#E1306C]">
                {targetMode === "SCHEDULED_TIME" ? (
                  <CalendarClock className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-[#161413]">
                  {targetMode === "SCHEDULED_TIME"
                    ? "Schedule for Upcoming Post or Reel"
                    : "Bind to Your Next Published Post or Reel"}
                </p>
                <p className="text-[11px] text-[#6E655F]">
                  {targetMode === "SCHEDULED_TIME"
                    ? "Publish your post natively on Instagram at the scheduled time. Replyza will automatically bind and reply from the very first comment."
                    : "Replyza will automatically bind to the very next post or Reel you publish on Instagram."}
                </p>
              </div>
            </div>

            {targetMode === "SCHEDULED_TIME" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E655F] block mb-1">
                    Scheduled Publish Time (Local)
                  </label>
                  <input
                    type="datetime-local"
                    aria-label="Scheduled publish time"
                    value={scheduledActivateAtLocal}
                    onChange={(e) => onChangeScheduledActivateAtLocal(e.target.value)}
                    className="w-full rounded-xl border border-[#E6DFD8] bg-white px-3 py-2 text-xs font-semibold text-[#161413] focus:border-[#E1306C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E655F] block mb-1">
                    Binding Window
                  </label>
                  <select
                    aria-label="Binding window duration"
                    value={bindingWindowMinutes}
                    onChange={(e) => onChangeBindingWindowMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#E6DFD8] bg-white px-3 py-2 text-xs font-semibold text-[#161413] focus:border-[#E1306C] focus:outline-none"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes (recommended)</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E655F] block mb-1">
                  Media Type Filter
                </label>
                <select
                  aria-label="Media type filter"
                  value={mediaTypeFilter}
                  onChange={(e) => onChangeMediaTypeFilter(e.target.value as MediaTypeFilter)}
                  className="w-full rounded-xl border border-[#E6DFD8] bg-white px-3 py-2 text-xs font-semibold text-[#161413] focus:border-[#E1306C] focus:outline-none"
                >
                  <option value="ANY">Any Post or Reel</option>
                  <option value="REELS">Reels Only</option>
                  <option value="FEED">Feed Posts Only</option>
                </select>
              </div>
              <div>
                <label className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E655F] block mb-1">
                  Caption Keyword Filter (Optional)
                </label>
                <input
                  type="text"
                  aria-label="Caption keyword filter"
                  value={captionKeywordFilter}
                  onChange={(e) => onChangeCaptionKeywordFilter(e.target.value)}
                  placeholder="e.g. #summerdrop"
                  className="w-full rounded-xl border border-[#E6DFD8] bg-white px-3 py-2 text-xs text-[#161413] placeholder:text-[#8C8A84] focus:border-[#E1306C] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {isEditMode && targetMode !== "SCHEDULED_TIME" && (
          <div className="rounded-xl bg-[#F7F1EC] border border-[#E6DFD8] px-3.5 py-2.5 text-xs text-[#6E655F]">
            Target locked:{" "}
            <strong className="text-[#161413]">
              {targetMode === "ALL_POSTS"
                ? "All Posts & Reels"
                : targetMode === "NEXT_POST"
                  ? "Next Post / Reel"
                  : `Media ID ${mediaId}`}
            </strong>
          </div>
        )}
      </div>

      {/* Comment Keywords */}
      <div className="space-y-3 pt-2 border-t border-[#E6DFD8]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-[#161413]">
              Comment Triggers
            </h3>
            <p className="text-xs text-[#6E655F]">
              Type a keyword and press Enter or comma to add.
            </p>
          </div>

          <div className="inline-flex rounded-full border border-[#E6DFD8] bg-[#F7F1EC] p-1 self-start">
            <button
              type="button"
              onClick={() => onChangeTriggerType("KEYWORD")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                triggerType === "KEYWORD"
                  ? "bg-[#E1306C] text-white"
                  : "text-[#6E655F]"
              }`}
            >
              Keywords
            </button>
            <button
              type="button"
              onClick={() => onChangeTriggerType("ANY_COMMENT")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                triggerType === "ANY_COMMENT"
                  ? "bg-[#E1306C] text-white"
                  : "text-[#6E655F]"
              }`}
            >
              Any Comment
            </button>
          </div>
        </div>

        {triggerType === "KEYWORD" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E6DFD8] bg-[#FAF9F6] p-2.5 focus-within:border-[#E1306C]">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#FCE8EC] text-[#E1306C] px-3 py-1 font-mono-num text-xs font-bold"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() =>
                      onChangeKeywords(keywords.filter((k) => k !== kw))
                    }
                    className="hover:text-[#161413] cursor-pointer"
                    aria-label={`Remove ${kw}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                onBlur={() => addKeywordToken(keywordInput)}
                placeholder="Type LINK, GUIDE, OUTFIT + Enter..."
                className="flex-1 min-w-[160px] bg-transparent text-xs text-[#161413] placeholder:text-[#8C8A84] focus:outline-none py-1 px-1"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-[#E6DFD8] bg-[#F7F1EC] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onChangeKeywordMatchMode("CONTAINS")}
                  className={`rounded-full px-3 py-1 font-semibold cursor-pointer ${
                    keywordMatchMode === "CONTAINS"
                      ? "bg-[#FFFFFF] text-[#161413] shadow-2xs"
                      : "text-[#6E655F]"
                  }`}
                >
                  Contains Word
                </button>
                <button
                  type="button"
                  onClick={() => onChangeKeywordMatchMode("EXACT")}
                  className={`rounded-full px-3 py-1 font-semibold cursor-pointer ${
                    keywordMatchMode === "EXACT"
                      ? "bg-[#FFFFFF] text-[#161413] shadow-2xs"
                      : "text-[#6E655F]"
                  }`}
                >
                  Exact Match
                </button>
              </div>

              <select
                value={keywordMatchLogic}
                onChange={(e) =>
                  onChangeKeywordMatchLogic(e.target.value as KeywordMatchLogic)
                }
                className="rounded-full border border-[#E6DFD8] bg-[#FFFFFF] px-3 py-1 text-[11px] font-semibold text-[#161413]"
              >
                <option value="ANY_KEYWORD">Match ANY keyword</option>
                <option value="ALL_KEYWORDS">Match ALL keywords</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Rotating Public Comment Replies */}
      <div className="space-y-3 pt-2 border-t border-[#E6DFD8]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-[#161413]">
              Public Comment Replies
            </h3>
            <p className="text-xs text-[#6E655F]">
              Rotate replies under comments to stay natural.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#161413] cursor-pointer">
            <input
              type="checkbox"
              checked={publicReplyEnabled}
              onChange={(e) => onChangePublicReplyEnabled(e.target.checked)}
              className="accent-[#E1306C]"
            />
            Enabled
          </label>
        </div>

        {publicReplyEnabled && (
          <div className="space-y-2">
            <input
              value={publicReplyText}
              onChange={(e) => onChangePublicReplyText(e.target.value)}
              placeholder="Sent to your DMs! ✨"
              className="w-full rounded-xl border border-[#E6DFD8] bg-[#FAF9F6] px-3.5 py-2 text-xs text-[#161413] focus:border-[#E1306C] focus:outline-none"
            />
            {publicReplyVariations.map((v, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={v}
                  onChange={(e) => {
                    const next = [...publicReplyVariations];
                    next[idx] = e.target.value;
                    onChangePublicReplyVariations(next);
                  }}
                  placeholder="Check your inbox 💌"
                  className="flex-1 rounded-xl border border-[#E6DFD8] bg-[#FAF9F6] px-3.5 py-2 text-xs text-[#161413] focus:border-[#E1306C] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChangePublicReplyVariations(
                      publicReplyVariations.filter((_, i) => i !== idx)
                    )
                  }
                  className="p-2 rounded-xl text-[#6E655F] hover:text-[#E1306C] hover:bg-[#FCE8EC] cursor-pointer"
                  aria-label="Remove reply variation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {publicReplyVariations.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  onChangePublicReplyVariations([
                    ...publicReplyVariations,
                    "Check your inbox {{username}}! 💌",
                  ])
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E1306C] hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add reply variation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
