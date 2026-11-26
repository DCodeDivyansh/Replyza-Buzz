import React from "react";
import {
  MessageCircle,
  Filter,
  MessageSquare,
  Send,
  UserCheck,
  CheckCircle2,
  ShoppingBag,
} from "lucide-react";

interface WorkflowDiagramProps {
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
  publicReplyEnabled?: boolean;
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string | null;
  productCount?: number;
  followRequired?: boolean;
  followSuccessText?: string | null;
}

export function WorkflowDiagram({
  triggerType,
  keywords,
  publicReplyEnabled = true,
  publicReplyText,
  dmMessageText,
  dmLink,
  productCount = 0,
  followRequired = false,
  followSuccessText,
}: WorkflowDiagramProps) {
  const nodes = [
    {
      icon: MessageCircle,
      title: "1. Instagram Comment Trigger",
      detail:
        triggerType === "ANY_COMMENT"
          ? "Matches every incoming comment"
          : `Matches keywords: ${keywords.length > 0 ? keywords.join(", ") : "—"}`,
      accent: "bg-[#FCE8EC] text-[#E1306C]",
    },
    ...(publicReplyEnabled
      ? [
          {
            icon: MessageSquare,
            title: "2. Public Comment Reply",
            detail: publicReplyText || "Configured public reply",
            accent: "bg-[#FDF2EE] text-[#F77737]",
          },
        ]
      : []),
    {
      icon: followRequired ? UserCheck : Send,
      title: followRequired ? "3. Follow-Gate Prompt DM" : "3. Opening Direct Message",
      detail: followRequired
        ? "Sends follow prompt DM with \"I've followed!\" Quick Reply"
        : dmMessageText,
      accent: "bg-[#161413] text-[#F7F1EC]",
    },
    {
      icon: productCount > 0 ? ShoppingBag : CheckCircle2,
      title: "4. Product Delivery",
      detail:
        productCount > 0
          ? `${productCount} affiliate product(s) attached`
          : followSuccessText || dmLink || "Direct DM link delivery",
      accent: "bg-[#ECF7F3] text-[#0D7A5F]",
    },
  ];

  // Keep Filter imported cleanly if unused? Let's use Filter for step 1 if needed, or remove unused.
  void Filter;

  return (
    <div className="relative pl-6 space-y-3">
      <div
        aria-hidden="true"
        className="absolute left-[15px] top-4 bottom-4 w-[1.5px] bg-[#E1306C]/35"
      />
      {nodes.map((node) => {
        const Icon = node.icon;
        return (
          <div
            key={node.title}
            className="relative flex items-start gap-3 p-3.5 rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF]"
          >
            <div
              className={`-ml-8 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-[#FFFFFF] ${node.accent}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs font-bold text-[#161413]">
                {node.title}
              </p>
              <p className="text-[11px] text-[#6E655F] mt-0.5 break-words line-clamp-2">
                {node.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
