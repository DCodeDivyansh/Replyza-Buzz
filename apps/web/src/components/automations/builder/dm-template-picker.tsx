"use client";

import React, { useState } from "react";
import { Template } from "@/types/automation";
import { validateTemplateVariables } from "@replyza/shared";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";
import { BookmarkPlus, Check, AlertTriangle, Sparkles } from "lucide-react";

const VARIABLE_CHIPS = [
  { label: "First Name", token: "{{first_name}}" },
  { label: "Username", token: "{{username}}" },
  { label: "Product Name", token: "{{product_name}}" },
  { label: "Product URL", token: "{{product_url}}" },
  { label: "Coupon Code", token: "{{coupon_code}}" },
  { label: "Price", token: "{{product_price}}" },
];

const QUICK_EMOJIS = ["😊", "❤️", "🔥", "👇", "✨", "🛍️", "🎁", "🙌"];

interface DmTemplatePickerProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (template: Template) => void;
  onTemplateCreated: (template: Template) => void;
  dmMessageText: string;
  onChangeDmMessageText: (val: string) => void;
  publicReplyText: string;
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
}

export function DmTemplatePicker({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onTemplateCreated,
  dmMessageText,
  onChangeDmMessageText,
  publicReplyText,
  triggerType,
  keywords,
}: DmTemplatePickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const categories = ["ALL", ...Array.from(new Set(templates.map((t) => t.category)))];
  const visibleTemplates =
    activeCategory === "ALL"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  const varCheck = validateTemplateVariables(dmMessageText);

  const insertToken = (token: string) => {
    const needsSpace = dmMessageText.length > 0 && !dmMessageText.endsWith(" ") && !dmMessageText.endsWith("\n");
    onChangeDmMessageText(`${dmMessageText}${needsSpace ? " " : ""}${token}`);
  };

  const handleSaveAsTemplate = async () => {
    if (!dmMessageText.trim()) return;
    if (!varCheck.valid) {
      toast.error("Fix unsupported variables before saving as a template.");
      return;
    }
    const templateName = window.prompt("Name for your new DM template:", "My Custom DM");
    if (!templateName?.trim()) return;

    setSavingTemplate(true);
    try {
      const res = await apiRequest<Template>("/templates", {
        method: "POST",
        body: JSON.stringify({
          name: templateName.trim(),
          category: "Custom",
          triggerType,
          keywords,
          publicReplyText: publicReplyText || "Check your DMs {{username}}!",
          dmMessageText: dmMessageText.trim(),
          followRequired: false,
        }),
      });
      if (res.data) {
        onTemplateCreated(res.data);
        toast.success("Saved to DM Template Library");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to save template."
      );
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeCategory === cat
                ? "bg-[#17131D] text-white"
                : "bg-[#F8F5F8] text-[#827D87] hover:text-[#17131D]"
            }`}
          >
            {cat === "ALL" ? "All Templates" : cat}
          </button>
        ))}
      </div>

      {/* Template Selector Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
        {visibleTemplates.map((tmpl) => {
          const isSelected = selectedTemplateId === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectTemplate(tmpl)}
              className={`text-left rounded-xl border p-2.5 transition-all cursor-pointer ${
                isSelected
                  ? "border-[#17131D] bg-[#F8F5F8] ring-1 ring-[#17131D]/15"
                  : "border-[#17131D]/10 bg-white hover:border-[#17131D]/25"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#17131D] truncate">
                  {tmpl.name}
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#17131D] shrink-0" />}
              </div>
              <p className="text-[10px] text-[#827D87] mt-0.5 line-clamp-1">
                {tmpl.category} · {tmpl.dmMessageText}
              </p>
            </button>
          );
        })}
      </div>

      {/* Message Textarea + Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#17131D] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#E1306C]" />
            Opening / Delivery Message
          </label>
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={savingTemplate}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer disabled:opacity-50"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save as Template
          </button>
        </div>

        <textarea
          value={dmMessageText}
          onChange={(e) => onChangeDmMessageText(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Hey {{first_name}}! Thanks for commenting. Here is what you asked for:"
          className="w-full rounded-xl border border-[#17131D]/15 bg-[#FFFDFB] px-3.5 py-2.5 text-sm text-[#17131D] placeholder:text-[#827D87]/60 focus:border-[#17131D] focus:outline-none focus:ring-2 focus:ring-[#17131D]/10"
        />

        {!varCheck.valid && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Unsupported variable(s):{" "}
              {varCheck.unsupportedVariables.map((v) => `{{${v}}}`).join(", ")}
            </span>
          </div>
        )}

        {/* Variable Chips + Emoji Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1">
            {VARIABLE_CHIPS.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertToken(v.token)}
                className="rounded-md border border-[#17131D]/10 bg-[#F8F5F8] px-2 py-0.5 text-[10px] font-mono text-[#17131D] hover:bg-[#17131D] hover:text-white transition-colors cursor-pointer"
              >
                {v.token}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertToken(emoji)}
                className="rounded-md px-1.5 py-0.5 text-xs hover:bg-[#F8F5F8] cursor-pointer"
                title={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
