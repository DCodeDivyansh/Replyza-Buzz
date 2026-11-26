"use client";

import { ArrowRight, Clock, MessageCircle, Rocket, Save, ShieldAlert } from "lucide-react";
import { WorkflowDiagram } from "../workflow-diagram";

export interface StepReviewProps {
  name: string;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
  publicReplyEnabled: boolean;
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string;
  productCount: number;
  followRequired: boolean;
  followSuccessText: string;
  cooldownMinutes: number;
  onChangeCooldownMinutes: (val: number) => void;
  dmMeFallbackEnabled: boolean;
  onChangeDmMeFallbackEnabled: (val: boolean) => void;
  dmMeFallbackKeyword: string;
  onChangeDmMeFallbackKeyword: (val: string) => void;
  isEditMode: boolean;
  saving: boolean;
  onSaveDraft: () => void;
  onActivate: () => void;
}

export function StepReview({
  name,
  triggerType,
  keywords,
  publicReplyEnabled,
  publicReplyText,
  dmMessageText,
  dmLink,
  productCount,
  followRequired,
  followSuccessText,
  cooldownMinutes,
  onChangeCooldownMinutes,
  dmMeFallbackEnabled,
  onChangeDmMeFallbackEnabled,
  dmMeFallbackKeyword,
  onChangeDmMeFallbackKeyword,
  isEditMode,
  saving,
  onSaveDraft,
  onActivate,
}: StepReviewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E6DFD8] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655F]">
              Flow Blueprint
            </p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[#161413]">
              {name.trim() || "Untitled Automation"}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DFD8] bg-[#F7F1EC] px-3 py-1 font-mono text-[11px] font-semibold text-[#161413]">
            {productCount} {productCount === 1 ? "Product" : "Products"}
          </span>
        </div>

        <WorkflowDiagram
          triggerType={triggerType}
          keywords={keywords}
          publicReplyEnabled={publicReplyEnabled}
          publicReplyText={publicReplyText}
          dmMessageText={dmMessageText}
          dmLink={dmLink}
          productCount={productCount}
          followRequired={followRequired}
          followSuccessText={followSuccessText}
        />
      </div>

      <div className="rounded-2xl border border-[#E6DFD8] bg-white p-5 sm:p-6 space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655F]">
            Delivery Guardrails
          </p>
          <h3 className="mt-0.5 text-base font-bold tracking-tight text-[#161413]">
            Rate-Limit &amp; Fallback Safety
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E6DFD8] bg-[#F7F1EC]/50 p-4 space-y-2">
            <label
              htmlFor="builder-cooldown"
              className="flex items-center gap-2 text-xs font-semibold text-[#161413]"
            >
              <Clock className="h-3.5 w-3.5 text-[#E1306C]" />
              Per-User Cooldown (minutes)
            </label>
            <input
              id="builder-cooldown"
              type="number"
              min={0}
              max={10080}
              value={cooldownMinutes}
              onChange={(e) =>
                onChangeCooldownMinutes(Math.max(0, Number(e.target.value) || 0))
              }
              className="w-full rounded-xl border border-[#E6DFD8] bg-white px-3 py-2 font-mono text-sm text-[#161413] focus:border-[#161413] focus:outline-none"
            />
            <p className="text-[11px] text-[#6E655F]">
              Prevents duplicate DMs if the same follower comments multiple times.
            </p>
          </div>

          <div className="rounded-xl border border-[#E6DFD8] bg-[#F7F1EC]/50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold text-[#161413]">
                  <MessageCircle className="h-3.5 w-3.5 text-[#F77737]" />
                  DM-Me Fallback
                </p>
                <p className="mt-0.5 text-[11px] text-[#6E655F]">
                  Trigger DM if user messages keyword directly.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dmMeFallbackEnabled}
                onClick={() => onChangeDmMeFallbackEnabled(!dmMeFallbackEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  dmMeFallbackEnabled ? "bg-[#E1306C]" : "bg-[#E6DFD8]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                    dmMeFallbackEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {dmMeFallbackEnabled && (
              <div>
                <input
                  type="text"
                  value={dmMeFallbackKeyword}
                  onChange={(e) => onChangeDmMeFallbackKeyword(e.target.value)}
                  placeholder="Fallback keyword (e.g. LINK)"
                  className="w-full rounded-xl border border-[#E6DFD8] bg-white px-3 py-2 text-xs font-medium text-[#161413] placeholder:text-[#6E655F]/60 focus:border-[#161413] focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-[#E6DFD8] bg-[#FCE8EC]/40 px-3.5 py-2.5 text-xs text-[#6E655F]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#E1306C]" />
          <span>
            Replies are dispatched sequentially via official Meta Graph API webhooks with built-in anti-spam pacing.
          </span>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E6DFD8] bg-white p-4 sm:p-5">
        <button
          type="button"
          disabled={saving}
          onClick={onSaveDraft}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E6DFD8] bg-[#F7F1EC] px-5 py-2.5 text-xs font-semibold text-[#161413] transition-colors hover:bg-[#EDE4DD] disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {isEditMode ? "Save Changes" : "Save Draft"}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={onActivate}
          className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#161413] pl-5 pr-2 py-2 text-xs font-semibold text-white transition-all hover:bg-[#2A2624] disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <Rocket className="h-3.5 w-3.5 text-[#F77737]" />
            {saving
              ? "Saving..."
              : isEditMode
                ? "Update & Activate"
                : "Activate Automation"}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 group-hover:rotate-45">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
}
