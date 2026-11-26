"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  UserCheck,
} from "lucide-react";
import { interpolateVariables } from "@replyza/shared";
import {
  AutomationProductItem,
  DeliveryMode,
  ProductDeliveryMode,
} from "@/types/automation";

export type PreviewStage = "comment" | "follow" | "dm";

export interface LivePreviewProps {
  accountUsername?: string;
  publicReplyEnabled?: boolean;
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string | null;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
  deliveryMode?: DeliveryMode;
  buttonLabel?: string | null;
  followRequired?: boolean;
  followInstructionText?: string | null;
  followSuccessText?: string | null;
  followUpEnabled?: boolean;
  followUpText?: string | null;
  products?: AutomationProductItem[];
  productDeliveryMode?: ProductDeliveryMode;
  productIntroText?: string | null;
  productClosingText?: string | null;
  mediaThumbnailUrl?: string;
}

const PREVIEW_STAGES: { id: PreviewStage; label: string }[] = [
  { id: "comment", label: "1. Comment Reply" },
  { id: "follow", label: "2. Follow Gate" },
  { id: "dm", label: "3. Product DM" },
];

export function LivePreview({
  accountUsername = "shre_yadayal",
  publicReplyEnabled = true,
  publicReplyText,
  dmMessageText,
  dmLink,
  triggerType,
  keywords,
  deliveryMode = "DIRECT",
  buttonLabel = "Send me the links",
  followRequired = false,
  followInstructionText,
  followSuccessText,
  followUpEnabled = false,
  followUpText,
  products = [],
  productIntroText,
  productClosingText,
  mediaThumbnailUrl,
}: LivePreviewProps) {
  const [stage, setStage] = useState<PreviewStage>("dm");
  const [productIndex, setProductIndex] = useState(0);

  const safeHandle = accountUsername.replace(/^@/, "") || "shre_yadayal";
  const sampleCommenter = "maya.creates";
  const sampleKeyword = keywords.length > 0 ? keywords[0] : "LINK";
  const sampleUserComment =
    triggerType === "KEYWORD"
      ? `${sampleKeyword}! Need that link ✨`
      : "Love this! Where is it from? ✨";

  const clampedIndex =
    products.length > 0 ? Math.min(productIndex, products.length - 1) : 0;
  const activeProduct = products[clampedIndex];

  const context = {
    firstName: "Maya",
    username: sampleCommenter,
    keyword: sampleKeyword,
    link: activeProduct?.affiliateUrl || dmLink || "https://replyza.buzz/p/serum",
    productName: activeProduct?.name || "Glow Barrier Serum",
    productUrl:
      activeProduct?.affiliateUrl || dmLink || "https://replyza.buzz/p/serum",
    couponCode: activeProduct?.couponCode || "MAYA20",
    productPrice:
      activeProduct?.discountPrice || activeProduct?.price || "₹699",
    brand: activeProduct?.brand || safeHandle,
  };

  const previewPublicReply = interpolateVariables(
    publicReplyText || "Sent it to your DMs @maya.creates ✨",
    context
  );
  const previewDm = interpolateVariables(
    dmMessageText ||
      "Hey Maya! Thanks for commenting. Tap below for your curated links:",
    context
  );
  const previewFollowInstruction = interpolateVariables(
    followInstructionText ||
      "Hey Maya! Quick check — follow my page and tap below to unlock your links instantly 👇",
    context
  );
  const previewFollowSuccess = interpolateVariables(
    followSuccessText || "You're all set! Unlocking your links now ✨",
    context
  );
  const previewIntro = productIntroText
    ? interpolateVariables(productIntroText, context)
    : "";
  const previewClosing = productClosingText
    ? interpolateVariables(productClosingText, context)
    : "";
  const previewFollowUp =
    followUpEnabled && followUpText
      ? interpolateVariables(followUpText, context)
      : "";

  const formatRupee = (val?: string | null) => {
    if (!val) return "";
    const trimmed = val.trim();
    return trimmed.startsWith("₹") || trimmed.startsWith("$")
      ? trimmed
      : `₹${trimmed}`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* 3-State Interactive Stage Switcher */}
      <div
        role="tablist"
        aria-label="Phone preview stage"
        className="mb-4 inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-[#E6DFD8] bg-[#F2EBE4] p-1"
      >
        {PREVIEW_STAGES.map((tab) => {
          const isActive = stage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setStage(tab.id)}
              className={`relative rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                isActive ? "text-white" : "text-[#6E655F] hover:text-[#161413]"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="preview-stage-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[#161413]"
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Realistic iPhone 16 Pro Frame */}
      <div className="relative mx-auto w-[310px] sm:w-[330px]">
        {/* Side Hardware Buttons */}
        <div className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l-sm bg-[#2A2624]" />
        <div className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l-sm bg-[#2A2624]" />
        <div className="absolute -left-[3px] top-52 h-12 w-[3px] rounded-l-sm bg-[#2A2624]" />
        <div className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r-sm bg-[#2A2624]" />

        <div className="relative overflow-hidden rounded-[44px] border-[10px] border-[#161413] bg-white shadow-[0_32px_64px_-16px_rgba(22,20,19,0.22)] ring-1 ring-white/15">
          {/* Status Bar + Dynamic Island */}
          <div className="relative flex items-center justify-between bg-white px-6 pt-3 pb-2 text-[11px] font-semibold text-[#161413]">
            <span>9:41</span>
            <div className="absolute left-1/2 top-2.5 flex h-[22px] w-[88px] -translate-x-1/2 items-center justify-end rounded-full bg-[#161413] px-2.5">
              <span className="h-2 w-2 rounded-full bg-[#2C2826] ring-1 ring-white/10" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-end gap-[1.5px]">
                <span className="h-1.5 w-[2px] rounded-full bg-[#161413]" />
                <span className="h-2 w-[2px] rounded-full bg-[#161413]" />
                <span className="h-2.5 w-[2px] rounded-full bg-[#161413]" />
                <span className="h-3 w-[2px] rounded-full bg-[#161413]" />
              </div>
              <div className="h-2.5 w-4 rounded-[3px] border border-[#161413] p-[1px]">
                <div className="h-full w-3 rounded-[1px] bg-[#161413]" />
              </div>
            </div>
          </div>

          {/* Screen Body */}
          <div className="flex h-[515px] flex-col justify-between bg-white">
            <AnimatePresence mode="wait">
              {stage === "comment" ? (
                <motion.div
                  key="stage-comment"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-1 flex-col overflow-hidden"
                >
                  {/* IG Post / Reel Preview */}
                  <div className="relative h-52 w-full bg-[#161413] overflow-hidden">
                    {mediaThumbnailUrl ? (
                      <img
                        src={mediaThumbnailUrl}
                        alt="Selected Instagram post"
                        className="h-full w-full object-cover opacity-90"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#2B2125] via-[#161413] to-[#3B1E28] text-white/80">
                        <ImageIcon className="h-7 w-7 mb-1.5 text-[#F77737]" />
                        <span className="text-[11px] font-medium">
                          Selected Post / Reel
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent p-3">
                      <img
                        src="/images/shreya-avatar.jpg"
                        alt={safeHandle}
                        className="h-7 w-7 rounded-full object-cover ring-1 ring-white/40"
                      />
                      <span className="text-xs font-semibold text-white">
                        @{safeHandle}
                      </span>
                      <BadgeCheck className="h-3.5 w-3.5 text-[#3897F0]" />
                    </div>
                  </div>

                  {/* Comment Sheet */}
                  <div className="flex-1 space-y-3.5 overflow-y-auto bg-white p-4">
                    <div className="mx-auto h-1 w-9 rounded-full bg-[#E6DFD8]" />
                    <p className="text-center text-xs font-bold text-[#161413]">
                      Comments
                    </p>

                    {/* Follower Comment */}
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FCE8EC] text-[10px] font-bold text-[#E1306C]">
                        MC
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] leading-snug text-[#161413]">
                          <span className="font-bold mr-1.5">
                            {sampleCommenter}
                          </span>
                          {sampleUserComment}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-[#6E655F]">
                          <span>Just now</span>
                          <span>Reply</span>
                        </div>
                      </div>
                      <Heart className="mt-1 h-3.5 w-3.5 text-[#E1306C] fill-[#E1306C]" />
                    </div>

                    {/* Creator Public Reply */}
                    {publicReplyEnabled ? (
                      <div className="ml-8 flex items-start gap-2 rounded-xl border border-[#E6DFD8] bg-[#F7F1EC]/70 p-2.5">
                        <img
                          src="/images/shreya-avatar.jpg"
                          alt={safeHandle}
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-[#161413]">
                              {safeHandle}
                            </span>
                            <BadgeCheck className="h-3 w-3 text-[#3897F0]" />
                            <span className="rounded bg-[#FCE8EC] px-1 py-0.5 text-[9px] font-semibold text-[#E1306C]">
                              Auto
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-[#161413]">
                            {previewPublicReply}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-8 rounded-xl border border-dashed border-[#E6DFD8] px-3 py-2 text-[11px] text-[#6E655F]">
                        Public comment reply is turned off.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setStage(followRequired ? "follow" : "dm")}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#E6DFD8] bg-[#F7F1EC] py-2 text-[11px] font-semibold text-[#161413] hover:bg-[#EDE4DD] cursor-pointer"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#E1306C]" />
                      {followRequired
                        ? "Next: See Follow Gate DM →"
                        : "Next: See Product DM →"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`stage-${stage}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-1 flex-col overflow-hidden"
                >
                  {/* Clean IG DM Header (Right Below Dynamic Island) */}
                  <div className="flex items-center justify-between border-b border-[#E6DFD8] px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ArrowLeft className="h-4 w-4 text-[#161413]" />
                      <div className="rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] p-[2px]">
                        <img
                          src="/images/shreya-avatar.jpg"
                          alt={safeHandle}
                          className="h-8 w-8 rounded-full border-[1.5px] border-white object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-[#161413]">
                            {safeHandle}
                          </span>
                          <BadgeCheck className="h-3.5 w-3.5 text-[#3897F0]" />
                        </div>
                        <p className="text-[10px] text-[#6E655F]">Active now</p>
                      </div>
                    </div>
                  </div>

                  {/* DM Conversation Area */}
                  <div className="flex-1 space-y-3 overflow-y-auto bg-[#FBF9F7] p-3.5">
                    {stage === "follow" ? (
                      <>
                        <div className="text-center text-[10px] font-medium text-[#6E655F]">
                          Today 9:41 AM
                        </div>

                        {!followRequired && (
                          <div className="rounded-xl border border-[#E6DFD8] bg-[#FCE8EC]/50 px-3 py-2 text-[10px] text-[#6E655F]">
                            Follow Gate is currently <strong>OFF</strong>. Enable
                            it in Step 2 to require a follow before unlocking.
                          </div>
                        )}

                        <div className="flex items-end gap-2">
                          <img
                            src="/images/shreya-avatar.jpg"
                            alt={safeHandle}
                            className="h-6 w-6 shrink-0 rounded-full object-cover"
                          />
                          <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border border-[#E6DFD8] bg-white p-3 text-xs leading-relaxed text-[#161413] shadow-xs">
                            <p>{previewFollowInstruction}</p>
                            <div className="flex flex-col gap-1.5 pt-1">
                              <span className="inline-flex items-center justify-center rounded-xl border border-[#E6DFD8] bg-[#F7F1EC] px-3 py-1.5 text-[11px] font-semibold text-[#161413]">
                                View Profile
                              </span>
                              <button
                                type="button"
                                onClick={() => setStage("dm")}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E1306C] px-3 py-1.5 text-[11px] font-semibold text-white transition-transform active:scale-95 cursor-pointer"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                I&apos;ve followed! ✓
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {followRequired && (
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#E6DFD8] bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#161413]">
                              <Sparkles className="h-2.5 w-2.5 text-[#E1306C]" />
                              {previewFollowSuccess}
                            </span>
                          </div>
                        )}

                        {/* Main DM Bubble */}
                        <div className="flex items-end gap-2">
                          <img
                            src="/images/shreya-avatar.jpg"
                            alt={safeHandle}
                            className="h-6 w-6 shrink-0 rounded-full object-cover"
                          />
                          <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border border-[#E6DFD8] bg-white p-3 text-xs leading-relaxed text-[#161413] shadow-xs">
                            {previewIntro && (
                              <p className="text-[11px] text-[#6E655F]">
                                {previewIntro}
                              </p>
                            )}
                            <p>{previewDm}</p>
                            {deliveryMode === "BUTTON" && (
                              <div className="pt-1">
                                <span className="inline-flex w-full items-center justify-center rounded-xl bg-[#161413] px-3 py-2 text-[11px] font-semibold text-white">
                                  {buttonLabel || "Send me the links"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Swipeable Multi-Product Card */}
                        {products.length > 0 ? (
                          <div className="pl-8 space-y-2">
                            <motion.div
                              key={activeProduct?.id || clampedIndex}
                              drag={products.length > 1 ? "x" : false}
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={0.2}
                              onDragEnd={(_, info) => {
                                if (products.length <= 1) return;
                                if (info.offset.x < -35) {
                                  setProductIndex(
                                    (prev) => (prev + 1) % products.length
                                  );
                                } else if (info.offset.x > 35) {
                                  setProductIndex(
                                    (prev) =>
                                      (prev - 1 + products.length) %
                                      products.length
                                  );
                                }
                              }}
                              className="overflow-hidden rounded-2xl border border-[#E6DFD8] bg-white shadow-xs"
                            >
                              <div className="relative h-28 w-full bg-[#F7F1EC]">
                                {activeProduct?.imageUrl ? (
                                  <img
                                    src={activeProduct.imageUrl}
                                    alt={activeProduct.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[#6E655F]">
                                    <ShoppingBag className="h-7 w-7 text-[#E1306C]/60" />
                                  </div>
                                )}
                                {activeProduct?.couponCode && (
                                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#161413]/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                                    <Tag className="h-2.5 w-2.5 text-[#F77737]" />
                                    {activeProduct.couponCode}
                                  </span>
                                )}
                              </div>
                              <div className="p-2.5 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-1 text-xs font-bold text-[#161413]">
                                    {activeProduct?.name}
                                  </p>
                                  {(activeProduct?.discountPrice ||
                                    activeProduct?.price) && (
                                    <span className="shrink-0 font-mono text-xs font-bold text-[#E1306C]">
                                      {formatRupee(
                                        activeProduct.discountPrice ||
                                          activeProduct.price
                                      )}
                                    </span>
                                  )}
                                </div>
                                <span className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#161413] px-3 py-1.5 text-[11px] font-semibold text-white">
                                  Shop Now
                                  <ExternalLink className="h-3 w-3" />
                                </span>
                              </div>
                            </motion.div>

                            {products.length > 1 && (
                              <div className="flex items-center justify-between px-1">
                                <button
                                  type="button"
                                  aria-label="Previous product"
                                  onClick={() =>
                                    setProductIndex(
                                      (prev) =>
                                        (prev - 1 + products.length) %
                                        products.length
                                    )
                                  }
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E6DFD8] bg-white text-[#161413] hover:bg-[#F7F1EC] cursor-pointer"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <div className="flex items-center gap-1">
                                  {products.map((p, idx) => (
                                    <span
                                      key={p.id || idx}
                                      className={`h-1.5 rounded-full transition-all ${
                                        idx === clampedIndex
                                          ? "w-4 bg-[#E1306C]"
                                          : "w-1.5 bg-[#E6DFD8]"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  aria-label="Next product"
                                  onClick={() =>
                                    setProductIndex(
                                      (prev) => (prev + 1) % products.length
                                    )
                                  }
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E6DFD8] bg-white text-[#161413] hover:bg-[#F7F1EC] cursor-pointer"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          dmLink && (
                            <div className="pl-8">
                              <div className="flex items-center justify-between rounded-xl border border-[#E6DFD8] bg-white px-3 py-2 text-[11px] font-semibold text-[#161413]">
                                <span className="truncate">{dmLink}</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#E1306C]" />
                              </div>
                            </div>
                          )
                        )}

                        {previewClosing && (
                          <div className="pl-8">
                            <div className="rounded-2xl rounded-bl-sm border border-[#E6DFD8] bg-white px-3 py-2 text-[11px] text-[#6E655F]">
                              {previewClosing}
                            </div>
                          </div>
                        )}

                        {previewFollowUp && (
                          <div className="pl-8">
                            <div className="rounded-2xl rounded-bl-sm border border-[#E6DFD8] bg-[#FCE8EC]/50 px-3 py-2 text-[11px] text-[#161413]">
                              {previewFollowUp}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom IG Composer + Home Indicator */}
            <div className="border-t border-[#E6DFD8] bg-white px-3 pt-2 pb-2">
              <div className="flex items-center gap-2 rounded-full border border-[#E6DFD8] bg-[#F7F1EC]/70 px-3 py-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E1306C] text-white">
                  <Camera className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-[11px] text-[#6E655F]">
                  Message...
                </span>
                <Mic className="h-3.5 w-3.5 text-[#6E655F]" />
                <Send className="h-3.5 w-3.5 text-[#161413]" />
              </div>
              <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-[#161413]/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
