import React from "react";
import {
  MessageCircle,
  Filter,
  MessageSquare,
  Send,
  UserCheck,
  CheckCircle2,
  ArrowDown,
} from "lucide-react";

interface WorkflowDiagramProps {
  triggerType: "ANY_COMMENT" | "KEYWORD";
  keywords: string[];
  publicReplyText: string;
  dmMessageText: string;
  dmLink?: string | null;
  followRequired?: boolean;
  followSuccessText?: string | null;
}

export function WorkflowDiagram({
  triggerType,
  keywords,
  publicReplyText,
  dmMessageText,
  dmLink,
  followRequired = false,
  followSuccessText,
}: WorkflowDiagramProps) {
  const nodes = [
    {
      icon: MessageCircle,
      title: "Instagram Comment",
      detail: "Meta delivers signed comment webhook",
      accent: "bg-[#833AB4]/10 text-[#833AB4]",
    },
    {
      icon: Filter,
      title: "Trigger Matching",
      detail:
        triggerType === "ANY_COMMENT"
          ? "Matches every incoming comment"
          : `Matches keywords: ${keywords.length > 0 ? keywords.join(", ") : "—"}`,
      accent: "bg-[#E1306C]/10 text-[#E1306C]",
    },
    {
      icon: MessageSquare,
      title: "Public Comment Reply",
      detail: publicReplyText || "Configured public reply",
      accent: "bg-[#F77737]/10 text-[#F77737]",
    },
    {
      icon: Send,
      title: followRequired ? "Private DM + Follow Prompt" : "Private Direct Message",
      detail: followRequired
        ? "Sends instruction DM with \"I've followed!\" Quick Reply"
        : `${dmMessageText}${dmLink ? ` (${dmLink})` : ""}`,
      accent: "bg-[#17131D] text-[#FFFDFB]",
    },
  ];

  if (followRequired) {
    nodes.push({
      icon: UserCheck,
      title: "Follow Verification",
      detail: "Checks Meta User Profile API (is_user_follow_business) on button tap",
      accent: "bg-[#833AB4]/10 text-[#833AB4]",
    });
    nodes.push({
      icon: CheckCircle2,
      title: "Success Link / Fallback",
      detail: followSuccessText || "Sends final link once verified, or fallback prompt",
      accent: "bg-emerald-50 text-emerald-700",
    });
  }

  return (
    <div className="space-y-2">
      {nodes.map((node, idx) => {
        const Icon = node.icon;
        return (
          <React.Fragment key={node.title}>
            <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-[#17131D]/8 bg-[#FFFDFB]">
              <div
                className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${node.accent}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xs font-semibold text-[#17131D]">
                  {node.title}
                </p>
                <p className="text-[11px] text-[#827D87] mt-0.5 break-words line-clamp-2">
                  {node.detail}
                </p>
              </div>
            </div>
            {idx < nodes.length - 1 && (
              <div className="flex justify-center">
                <ArrowDown className="h-3.5 w-3.5 text-[#827D87]/60" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
