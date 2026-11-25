"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Package,
  ExternalLink,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";
import { interpolateVariables } from "@replyza/shared";
import {
  AutomationProductItem,
  DeliveryMode,
  ProductDeliveryMode,
} from "@/types/automation";

interface LivePreviewProps {
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

export function LivePreview({
  accountUsername = "your_brand",
  publicReplyEnabled = true,
  publicReplyText,
  dmMessageText,
  dmLink,
  triggerType,
  keywords,
  deliveryMode = "DIRECT",
  buttonLabel = "Send me the link",
  followRequired = false,
  followInstructionText,
  followSuccessText,
  followUpEnabled = false,
  followUpText,
  products = [],
  productDeliveryMode = "SINGLE_MESSAGE",
  productIntroText,
  productClosingText,
  mediaThumbnailUrl,
}: LivePreviewProps) {
  const [activeTab, setActiveTab] = useState<"comment" | "dm">("dm");

  const sampleCommenter = "alex_creator";
  const sampleKeyword = keywords.length > 0 ? keywords[0] : "LINK";
  const sampleUserComment =
    triggerType === "KEYWORD"
      ? `${sampleKeyword} please! 🙌`
      : "This looks super helpful, need details! 🔥";

  const firstProduct = products[0];
  const context = {
    firstName: "Alex",
    username: sampleCommenter,
    keyword: sampleKeyword,
    link: firstProduct?.affiliateUrl || dmLink || "https://example.com/link",
    productName: firstProduct?.name || "Featured Product",
    productUrl: firstProduct?.affiliateUrl || dmLink || "https://example.com/link",
    couponCode: firstProduct?.couponCode || "SAVE20",
    productPrice: firstProduct?.discountPrice || firstProduct?.price || "$29",
    brand: firstProduct?.brand || accountUsername,
  };

  const previewPublicReply = interpolateVariables(
    publicReplyText || "Check your DMs @alex_creator! Sent it your way 🔥",
    context
  );

  const previewDm = interpolateVariables(
    dmMessageText || "Hey Alex! Thanks for reaching out. Here is your link:",
    context
  );

  const previewFollowInstruction = interpolateVariables(
    followInstructionText ||
      "Hey Alex! Thanks for commenting. Follow our page and tap the button below to get your link instantly! 👇",
    context
  );

  const previewFollowSuccess = interpolateVariables(
    followSuccessText || "Woohoo! Thanks for following Alex 🎉 Here is your link:",
    context
  );

  const isTwoStep = followRequired || deliveryMode === "BUTTON";
  const effectiveButtonLabel =
    buttonLabel || (followRequired ? "I've followed! ✅" : "Send me the links");

  return (
    <div className="flex flex-col rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] shadow-xs overflow-hidden">
      {/* Header with Simulator Tabs */}
      <div className="flex items-center justify-between border-b border-[#17131D]/8 px-4 py-2.5 bg-[#F8F5F8]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#17131D]">
          <InstagramIcon className="h-4 w-4 text-pink-600" />
          <span>Live DM Simulator</span>
        </div>

        <div className="flex rounded-lg bg-[#17131D]/6 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("comment")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === "comment"
                ? "bg-white text-[#17131D] shadow-2xs font-semibold"
                : "text-[#827D87] hover:text-[#17131D]"
            }`}
          >
            <MessageSquare className="h-3 w-3" /> Comment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dm")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === "dm"
                ? "bg-white text-[#17131D] shadow-2xs font-semibold"
                : "text-[#827D87] hover:text-[#17131D]"
            }`}
          >
            <Send className="h-3 w-3 text-indigo-600" /> DM Flow
          </button>
        </div>
      </div>

      {/* Phone Mock */}
      <div className="p-4 bg-[#F8F5F8]/70 flex justify-center">
        <div className="w-full max-w-[340px] rounded-[24px] border border-[#17131D]/15 bg-white shadow-sm overflow-hidden text-xs">
          {/* Top Phone Bar */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/90 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-linear-to-tr from-amber-400 via-rose-500 to-purple-600 p-[1.5px]">
                <div className="h-full w-full rounded-full bg-white flex items-center justify-center font-bold text-[9px] text-zinc-700">
                  {accountUsername.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-zinc-900 text-[11px] flex items-center gap-1">
                  {accountUsername}
                  <ShieldCheck className="h-3 w-3 text-blue-500" />
                </span>
                <span className="text-[9px] text-zinc-400">Instagram</span>
              </div>
            </div>
            {mediaThumbnailUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mediaThumbnailUrl}
                alt="Post"
                className="h-6 w-6 rounded-md object-cover border border-zinc-200"
              />
            )}
          </div>

          {/* TAB 1: Public Comment */}
          {activeTab === "comment" && (
            <div className="p-3.5 space-y-3.5 min-h-[280px]">
              <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                Post Comments
              </div>
              <div className="flex items-start gap-2.5">
                <div className="h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-[10px] text-zinc-600 shrink-0">
                  A
                </div>
                <div className="flex-1">
                  <div className="rounded-xl bg-zinc-100 px-3 py-2 text-zinc-800">
                    <span className="font-semibold text-[11px] mr-1.5 text-zinc-900">
                      {sampleCommenter}
                    </span>
                    {sampleUserComment}
                  </div>
                </div>
              </div>

              {publicReplyEnabled ? (
                <div className="flex items-start gap-2.5 pl-6">
                  <div className="h-6 w-6 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                    {accountUsername.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="rounded-xl bg-[#F8F5F8] border border-[#17131D]/10 px-3 py-2 text-zinc-900">
                      <span className="font-semibold text-[11px] mr-1.5">
                        {accountUsername}
                      </span>
                      {previewPublicReply}
                    </div>
                    <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5 mt-1 ml-1">
                      <Sparkles className="h-2.5 w-2.5" /> Automated Reply
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 p-3 text-center text-[11px] text-zinc-400">
                  Public comment reply is turned off. Replyza will send a Private DM directly.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Private DM Flow */}
          {activeTab === "dm" && (
            <div className="p-3.5 space-y-2.5 min-h-[280px] max-h-[420px] overflow-y-auto bg-zinc-50/30">
              <div className="text-center text-[10px] text-zinc-400 py-0.5">
                Direct Message · @{accountUsername}
              </div>

              {/* Opening DM / Button Prompt */}
              {isTwoStep && (
                <>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                      {accountUsername.charAt(0).toUpperCase()}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px] leading-relaxed whitespace-pre-wrap">
                      {followRequired ? previewFollowInstruction : previewDm}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="flex items-center gap-1 rounded-full border border-indigo-600 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                      {followRequired && <UserCheck className="h-3 w-3" />}
                      {effectiveButtonLabel}
                    </div>
                  </div>
                </>
              )}

              {/* Product Delivery Preview */}
              {products.length > 0 ? (
                productDeliveryMode === "GENERIC_CARDS" && isTwoStep ? (
                  <div className="space-y-2">
                    {(productIntroText || !isTwoStep) && (
                      <div className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                          {accountUsername.charAt(0).toUpperCase()}
                        </div>
                        <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px]">
                          {interpolateVariables(productIntroText || previewDm, context)}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 overflow-x-auto pb-1 pl-7">
                      {products.map((p, i) => (
                        <div
                          key={i}
                          className="w-44 shrink-0 rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xs"
                        >
                          <div className="h-24 bg-zinc-100 flex items-center justify-center overflow-hidden">
                            {p.imageUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-zinc-300" />
                            )}
                          </div>
                          <div className="p-2.5 space-y-1">
                            <p className="font-semibold text-[11px] text-zinc-900 truncate">
                              {p.name}
                            </p>
                            {(p.discountPrice || p.price) && (
                              <p className="text-[10px] font-semibold text-emerald-700">
                                {p.discountPrice || p.price}{" "}
                                {p.discountPrice && p.price && (
                                  <span className="line-through text-zinc-400 font-normal">
                                    {p.price}
                                  </span>
                                )}
                              </p>
                            )}
                            <div className="pt-1 border-t border-zinc-100 text-center text-[10px] font-semibold text-indigo-600">
                              {p.ctaLabel || "Shop Now"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : productDeliveryMode === "SEPARATE_MESSAGES" && isTwoStep ? (
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                        {accountUsername.charAt(0).toUpperCase()}
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px]">
                        {interpolateVariables(
                          productIntroText || (followRequired ? previewFollowSuccess : previewDm),
                          context
                        )}
                      </div>
                    </div>
                    {products.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 pl-7">
                        <div className="max-w-[90%] rounded-2xl rounded-tl-xs bg-indigo-600 text-white px-3 py-2 text-[11px] space-y-0.5">
                          <p className="font-semibold">{p.name}</p>
                          {(p.discountPrice || p.price) && (
                            <p className="text-[10px] text-white/85">
                              {p.discountPrice || p.price}
                            </p>
                          )}
                          <p className="underline text-[10px] break-all flex items-center gap-1">
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            {p.affiliateUrl}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : productDeliveryMode === "SELECTION_PROMPT" && products.length > 1 ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                        {accountUsername.charAt(0).toUpperCase()}
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px]">
                        {interpolateVariables(
                          productIntroText || "Which product link would you like? Tap below 👇",
                          context
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {products.slice(0, 4).map((p, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-indigo-600 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700"
                        >
                          {p.name.slice(0, 20)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* SINGLE_MESSAGE (or Direct fallback) */
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                      {accountUsername.charAt(0).toUpperCase()}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px] leading-relaxed space-y-1.5">
                      <p className="whitespace-pre-wrap">
                        {interpolateVariables(
                          productIntroText || (followRequired ? previewFollowSuccess : previewDm),
                          context
                        )}
                      </p>
                      {products.map((p, idx) => (
                        <div key={idx} className="pt-1 border-t border-zinc-200/70">
                          <p className="font-semibold text-zinc-900">
                            {products.length > 1 ? `${idx + 1}. ` : ""}
                            {p.name}{" "}
                            {(p.discountPrice || p.price) && (
                              <span className="text-emerald-700 font-medium">
                                ({p.discountPrice || p.price})
                              </span>
                            )}
                          </p>
                          <p className="text-indigo-600 underline break-all text-[10px]">
                            {p.affiliateUrl}
                          </p>
                        </div>
                      ))}
                      {productClosingText && (
                        <p className="pt-1 text-zinc-700">{productClosingText}</p>
                      )}
                    </div>
                  </div>
                )
              ) : (
                /* Legacy single dmLink fallback */
                <div className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                    {accountUsername.charAt(0).toUpperCase()}
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px] leading-relaxed">
                    <p className="whitespace-pre-wrap">
                      {followRequired ? previewFollowSuccess : previewDm}
                    </p>
                    {dmLink && (
                      <p className="mt-1 text-indigo-600 font-semibold underline break-all text-[10px]">
                        {dmLink}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Follow-up Message */}
              {followUpEnabled && followUpText && (
                <div className="flex items-start gap-2 pt-1">
                  <div className="h-5 w-5 rounded-full bg-[#17131D] text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                    {accountUsername.charAt(0).toUpperCase()}
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px] leading-relaxed">
                    {interpolateVariables(followUpText, context)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-[#F8F5F8] border-t border-[#17131D]/8 flex items-center justify-between text-[11px] text-[#827D87]">
        <span>Live preview</span>
        <span className="font-mono text-[10px]">Instagram Messaging API</span>
      </div>
    </div>
  );
}
