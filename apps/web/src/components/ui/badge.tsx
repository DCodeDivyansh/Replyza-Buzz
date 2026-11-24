import React from "react";
import { cn } from "@/lib/utils";
import { AutomationStatus } from "@/types/automation";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "active"
    | "draft"
    | "paused"
    | "indigo"
    | "danger"
    | "purple"
    | "blue"
    | "gray"
    | "green";
  status?: AutomationStatus;
}

export function Badge({
  className,
  variant = "default",
  status,
  children,
  ...props
}: BadgeProps) {
  let resolvedVariant = variant;
  if (status) {
    if (status === "ACTIVE") resolvedVariant = "active";
    else if (status === "DRAFT") resolvedVariant = "draft";
    else if (status === "PAUSED") resolvedVariant = "paused";
  }

  const variantStyles = {
    default: "bg-[#F8F5F8] text-[#17131D] border-[#17131D]/10",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    draft: "bg-[#F8F5F8] text-[#827D87] border-[#17131D]/10",
    paused: "bg-amber-50 text-amber-800 border-amber-200/80",
    indigo: "bg-[#833AB4]/10 text-[#833AB4] border-[#833AB4]/20",
    danger: "bg-red-50 text-red-700 border-red-200/80",
    purple: "bg-[#E1306C]/10 text-[#E1306C] border-[#E1306C]/20",
    blue: "bg-sky-50 text-sky-700 border-sky-200/80",
    gray: "bg-[#F8F5F8] text-[#827D87] border-[#17131D]/10",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border select-none",
        variantStyles[resolvedVariant],
        className
      )}
      {...props}
    >
      {status === "ACTIVE" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {status === "PAUSED" && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
      {status === "DRAFT" && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#827D87]" />
      )}
      {children || status}
    </span>
  );
}
