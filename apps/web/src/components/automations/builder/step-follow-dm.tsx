"use client";

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Template } from "@/types/automation";
import { validateTemplateVariables } from "@replyza/shared";
import { DmTemplatePicker } from "./dm-template-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { AlertTriangle, LayoutTemplate, UserCheck } from "lucide-react";

const VARIABLES = [
  { label: "{first_name}", token: "{{first_name}}" },
  { label: "{username}", token: "{{username}}" },
  { label: "{product_name}", token: "{{product_name}}" },
  { label: "{product_url}", token: "{{product_url}}" },
  { label: "{coupon_code}", token: "{{coupon_code}}" },
];

interface StepFollowDmProps {
  followRequired: boolean;
  onChangeFollowRequired: (v: boolean) => void;
  followInstructionText: string;
  onChangeFollowInstructionText: (v: string) => void;
  followSuccessText: string;
  onChangeFollowSuccessText: (v: string) => void;
  followFallbackText: string;
  onChangeFollowFallbackText: (v: string) => void;
  buttonLabel: string;
  onChangeButtonLabel: (v: string) => void;
  deliveryMode: "DIRECT" | "BUTTON";
  onChangeDeliveryMode: (v: "DIRECT" | "BUTTON") => void;
  dmMessageText: string;
  onChangeDmMessageText: (v: string) => void;
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (t: Template) => void;
  onTemplateCreated: (t: Template) => void;
  publicReplyText: string;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
}

export function StepFollowDm({
  followRequired,
  onChangeFollowRequired,
  followInstructionText,
  onChangeFollowInstructionText,
  followSuccessText,
  onChangeFollowSuccessText,
  followFallbackText,
  onChangeFollowFallbackText,
  buttonLabel,
  onChangeButtonLabel,
  deliveryMode,
  onChangeDeliveryMode,
  dmMessageText,
  onChangeDmMessageText,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onTemplateCreated,
  publicReplyText,
  triggerType,
  keywords,
}: StepFollowDmProps) {
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const varCheck = validateTemplateVariables(dmMessageText);

  const insertAtCursor = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChangeDmMessageText(`${dmMessageText} ${token}`);
      return;
    }
    const start = el.selectionStart ?? dmMessageText.length;
    const end = el.selectionEnd ?? dmMessageText.length;
    const next =
      dmMessageText.slice(0, start) + token + dmMessageText.slice(end);
    onChangeDmMessageText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] p-5 sm:p-6 space-y-6">
      {/* Follow-Gate Toggle Card */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
          followRequired
            ? "bg-[#FCE8EC]/40 border-[#E1306C]"
            : "bg-[#F7F1EC] border-[#E6DFD8]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                followRequired
                  ? "bg-[#E1306C] text-white"
                  : "bg-[#FFFFFF] text-[#161413] border border-[#E6DFD8]"
              }`}
            >
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#161413]">
                Require Follow Before Unlocking
              </h3>
              <p className="text-xs text-[#6E655F] mt-0.5">
                Sends a Quick Reply gate first and verifies follow status via Meta where supported.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={followRequired}
            onClick={() => {
              const next = !followRequired;
              onChangeFollowRequired(next);
              if (next) onChangeDeliveryMode("BUTTON");
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
              followRequired ? "bg-[#E1306C]" : "bg-[#D5CCC3]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                followRequired ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {followRequired && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-[#E1306C]/20 space-y-3">
                <Input
                  label="Quick Reply Button Label (max 20 chars)"
                  value={buttonLabel}
                  onChange={(e) => onChangeButtonLabel(e.target.value)}
                  maxLength={20}
                  placeholder="I've followed! ✓"
                />
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#161413]">
                    Follow-Gate Prompt DM
                  </label>
                  <textarea
                    value={followInstructionText}
                    onChange={(e) => onChangeFollowInstructionText(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-[#E6DFD8] bg-[#FFFFFF] px-3.5 py-2 text-xs text-[#161413] focus:border-[#E1306C] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Follow Verified Intro"
                    value={followSuccessText}
                    onChange={(e) => onChangeFollowSuccessText(e.target.value)}
                  />
                  <Input
                    label="Not Following Fallback"
                    value={followFallbackText}
                    onChange={(e) => onChangeFollowFallbackText(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interaction Mode when Follow Gate is off */}
      {!followRequired && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6DFD8] bg-[#FAF9F6] px-4 py-3">
          <div className="text-xs">
            <span className="font-semibold text-[#161413]">Delivery Trigger: </span>
            <span className="text-[#6E655F]">
              {deliveryMode === "BUTTON"
                ? "Interactive Quick Reply button before products"
                : "Send links immediately in Private Reply"}
            </span>
          </div>
          <div className="inline-flex rounded-full border border-[#E6DFD8] bg-[#FFFFFF] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => onChangeDeliveryMode("DIRECT")}
              className={`rounded-full px-3 py-1 font-semibold cursor-pointer ${
                deliveryMode === "DIRECT"
                  ? "bg-[#161413] text-[#F7F1EC]"
                  : "text-[#6E655F]"
              }`}
            >
              Direct DM
            </button>
            <button
              type="button"
              onClick={() => onChangeDeliveryMode("BUTTON")}
              className={`rounded-full px-3 py-1 font-semibold cursor-pointer ${
                deliveryMode === "BUTTON"
                  ? "bg-[#161413] text-[#F7F1EC]"
                  : "text-[#6E655F]"
              }`}
            >
              2-Step Button
            </button>
          </div>
        </div>
      )}

      {/* DM Message Composer + Template Picker Trigger */}
      <div className="space-y-2.5 pt-2 border-t border-[#E6DFD8]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-[#161413]">
              DM Message Copy
            </h3>
            <p className="text-xs text-[#6E655F]">
              Personalize with creator variables or load a saved template.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTemplateDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DFD8] bg-[#F7F1EC] px-3.5 py-1.5 text-xs font-semibold text-[#161413] hover:border-[#E1306C] hover:text-[#E1306C] transition-colors cursor-pointer"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Browse Templates ({templates.length})
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={dmMessageText}
          onChange={(e) => onChangeDmMessageText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Hey {{first_name}}! Thanks for commenting. Here is what you asked for:"
          className="w-full rounded-xl border border-[#E6DFD8] bg-[#FAF9F6] px-3.5 py-2.5 text-sm text-[#161413] placeholder:text-[#8C8A84] focus:border-[#E1306C] focus:outline-none"
        />

        {!varCheck.valid && (
          <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Unsupported variable(s):{" "}
              {varCheck.unsupportedVariables.map((v) => `{{${v}}}`).join(", ")}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertAtCursor(v.token)}
                className="rounded-full border border-[#E6DFD8] bg-[#F7F1EC] px-2.5 py-1 font-mono-num text-[11px] font-medium text-[#161413] hover:bg-[#FCE8EC] hover:text-[#E1306C] hover:border-[#E1306C]/30 transition-colors cursor-pointer"
              >
                {v.label}
              </button>
            ))}
          </div>
          <span className="font-mono-num text-[11px] text-[#6E655F]">
            {dmMessageText.length} / 2000
          </span>
        </div>
      </div>

      {/* Template Picker Modal Drawer */}
      <Modal
        isOpen={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        title="DM Template Library"
        description="Select a template to populate your DM message, or save your current copy."
        className="max-w-2xl"
      >
        <DmTemplatePicker
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={(t) => {
            onSelectTemplate(t);
            setTemplateDrawerOpen(false);
          }}
          onTemplateCreated={onTemplateCreated}
          dmMessageText={dmMessageText}
          onChangeDmMessageText={onChangeDmMessageText}
          publicReplyText={publicReplyText}
          triggerType={triggerType}
          keywords={keywords}
        />
      </Modal>
    </div>
  );
}
