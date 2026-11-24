"use client";

import React, { useState } from "react";
import { MessageSquare, Send, Sparkles, UserCheck, ShieldCheck } from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";
import { interpolateVariables } from "@replyza/shared";

interface LivePreviewProps {
  accountUsername?: string;
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string | null;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
  followRequired?: boolean;
  followInstructionText?: string | null;
  followSuccessText?: string | null;
  followFallbackText?: string | null;
  mediaThumbnailUrl?: string;
}

export function LivePreview({
  accountUsername = "your_brand",
  publicReplyText,
  dmMessageText,
  dmLink,
  triggerType,
  keywords,
  followRequired = false,
  followInstructionText,
  followSuccessText,
  mediaThumbnailUrl,
}: LivePreviewProps) {
  const [activeTab, setActiveTab] = useState<"comment" | "dm">("dm");

  const sampleCommenter = "alex_creator";
  const sampleKeyword = keywords.length > 0 ? keywords[0] : "LINK";
  const sampleUserComment =
    triggerType === "KEYWORD"
      ? `${sampleKeyword} please! 🙌`
      : "This looks super helpful, need details! 🔥";

  const context = {
    firstName: "Alex",
    username: sampleCommenter,
    keyword: sampleKeyword,
    link: dmLink || "https://example.com/link",
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

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200/90 bg-white shadow-xs overflow-hidden">
      {/* Header with Simulator Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-150 px-4 py-2.5 bg-zinc-50/80">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
          <InstagramIcon className="h-4 w-4 text-pink-600" />
          <span>Live Instagram Simulator</span>
        </div>

        <div className="flex rounded-lg bg-zinc-200/60 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("comment")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "comment"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <MessageSquare className="h-3 w-3" /> Public Reply
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dm")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "dm"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Send className="h-3 w-3 text-indigo-600" /> Private DM
          </button>
        </div>
      </div>

      {/* Simulator Screen */}
      <div className="p-4 bg-zinc-100/60 flex justify-center">
        <div className="w-full max-w-[340px] rounded-2xl border border-zinc-300 bg-white shadow-sm overflow-hidden text-xs">
          {/* Top Phone Mock Bar */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/90 px-3.5 py-2">
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

          {/* TAB 1: Public Comment Section */}
          {activeTab === "comment" && (
            <div className="p-3.5 space-y-3.5 min-h-[260px]">
              <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                Post Comments
              </div>

              {/* Commenter */}
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
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-1 ml-1">
                    <span>Just now</span>
                    <span className="font-semibold text-zinc-500 cursor-pointer">Reply</span>
                  </div>
                </div>
              </div>

              {/* Automated Public Reply */}
              <div className="flex items-start gap-2.5 pl-6">
                <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[9px] shrink-0 shadow-2xs">
                  {accountUsername.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2 text-zinc-900">
                    <span className="font-semibold text-[11px] mr-1.5 text-indigo-900">
                      {accountUsername}
                    </span>
                    {previewPublicReply}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1 ml-1">
                    <span className="text-indigo-600 font-medium flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5" /> Automated by Replyza
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Private DM Chat Simulator */}
          {activeTab === "dm" && (
            <div className="p-3.5 space-y-3 min-h-[260px] bg-zinc-50/30">
              <div className="text-center text-[10px] text-zinc-400 py-1">
                Direct Message from @{accountUsername}
              </div>

              {/* Follow-Gated Flow Simulation */}
              {followRequired ? (
                <>
                  {/* Step 1: Instruction DM */}
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                      {accountUsername.charAt(0).toUpperCase()}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px] leading-relaxed">
                      {previewFollowInstruction}
                    </div>
                  </div>

                  {/* Step 2: Quick Reply Button */}
                  <div className="flex justify-end pt-0.5">
                    <div className="flex items-center gap-1 rounded-full border border-indigo-600 bg-indigo-50/80 px-3 py-1 text-[11px] font-semibold text-indigo-700 shadow-2xs">
                      <UserCheck className="h-3 w-3" />
                      I&apos;ve followed! ✅
                    </div>
                  </div>

                  {/* Step 3: Success DM after consent & follow verified */}
                  <div className="flex items-start gap-2 pt-1">
                    <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                      {accountUsername.charAt(0).toUpperCase()}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-indigo-600 text-white px-3 py-2 text-[11px] leading-relaxed shadow-2xs">
                      <p>{previewFollowSuccess}</p>
                      {dmLink && (
                        <a
                          href={dmLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 block underline font-medium break-all text-white/95 text-[10px]"
                        >
                          {dmLink}
                        </a>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Standard DM Flow */
                <div className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[8px] shrink-0 mt-1">
                    {accountUsername.charAt(0).toUpperCase()}
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 px-3 py-2 text-zinc-800 text-[11px] leading-relaxed">
                    <p>{previewDm}</p>
                    {dmLink && (
                      <a
                        href={dmLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 block text-indigo-600 font-semibold underline break-all text-[10px]"
                      >
                        {dmLink}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Simulator Footer Notes */}
      <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-150 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Updates live as you type</span>
        <span className="font-mono text-[10px]">Meta Graph API v27.0 compliant</span>
      </div>
    </div>
  );
}
