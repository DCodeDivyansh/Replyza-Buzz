"use client";

import React from "react";
import Link from "next/link";
import { Template } from "@/types/automation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Send, Sparkles, UserCheck } from "lucide-react";

interface TemplateCardProps {
  template: Template;
  onSelect?: (template: Template) => void;
  isSelected?: boolean;
}

export function TemplateCard({
  template,
  onSelect,
  isSelected,
}: TemplateCardProps) {
  const categoryVariant =
    template.category === "Growth"
      ? "purple"
      : template.category === "Sales"
      ? "green"
      : template.category === "Lead Magnet"
      ? "blue"
      : "gray";

  const builderUrl = `/automations/new?templateId=${template.id}`;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md ${
        isSelected
          ? "border-indigo-600 ring-2 ring-indigo-500/20"
          : "border-zinc-200/80 hover:border-zinc-300"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
            {template.name}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            {template.description}
          </p>
        </div>
        <Badge variant={categoryVariant} className="text-[10px] shrink-0 font-medium">
          {template.category}
        </Badge>
      </div>

      {/* Triggers & Features Badge Row */}
      <div className="flex flex-wrap items-center gap-1.5 my-3">
        {template.triggerType === "KEYWORD" && template.keywords.length > 0 ? (
          <div className="flex items-center gap-1 text-[11px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md">
            Trigger: {template.keywords.map((k) => `"${k}"`).join(", ")}
          </div>
        ) : (
          <div className="text-[11px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
            Any Comment
          </div>
        )}

        {template.followRequired && (
          <div className="flex items-center gap-1 text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-md">
            <UserCheck className="h-3 w-3" /> Follow-to-Get-Link
          </div>
        )}
      </div>

      {/* Response Preview Box */}
      <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 mb-4 border border-zinc-150 flex-1">
        <div className="flex items-start gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
          <p className="line-clamp-2">
            <span className="font-medium text-zinc-700">Public: </span>
            {template.publicReplyText}
          </p>
        </div>
        <div className="flex items-start gap-1.5">
          <Send className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
          <p className="line-clamp-2">
            <span className="font-medium text-zinc-700">DM: </span>
            {template.dmMessageText}
          </p>
        </div>
      </div>

      {/* Action */}
      {onSelect ? (
        <Button
          type="button"
          size="sm"
          variant={isSelected ? "primary" : "secondary"}
          onClick={() => onSelect(template)}
          className="w-full justify-center text-xs font-medium"
        >
          {isSelected ? "Selected Template" : "Choose Template"}
        </Button>
      ) : (
        <Link href={builderUrl} className="w-full">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full justify-center gap-1.5 text-xs font-medium group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Use Template
            <ArrowRight className="h-3 w-3 ml-0.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}
