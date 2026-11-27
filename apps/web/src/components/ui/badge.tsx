import React from "react";
import { cn } from "@/lib/utils";
import { AutomationStatus } from "@/types/automation";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "active"
    | "scheduled"
    | "expired"
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
    else if (status === "SCHEDULED") resolvedVariant = "scheduled";
    else if (status === "EXPIRED") resolvedVariant = "expired";
    else if (status === "DRAFT") resolvedVariant = "draft";
    else if (status === "PAUSED") resolvedVariant = "paused";
  }

  const variantStyles = {
    default: "bg-[#F3F2EE] text-[#141413] border-[#E6E5E1]",
    active: "bg-[#ECF7F3] text-[#0D7A5F] border-[#0D7A5F]/20",
    scheduled: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    expired: "bg-zinc-100 text-zinc-600 border-zinc-200",
    draft: "bg-[#F3F2EE] text-[#5C5B57] border-[#E6E5E1]",
    paused: "bg-amber-50 text-amber-800 border-amber-200/80",
    indigo: "bg-[#FDF2EE] text-[#D94E28] border-[#D94E28]/20",
    danger: "bg-red-50 text-[#C81E1E] border-red-200/80",
    purple: "bg-[#FDF2EE] text-[#D94E28] border-[#D94E28]/20",
    blue: "bg-[#F3F2EE] text-[#141413] border-[#E6E5E1]",
    gray: "bg-[#F3F2EE] text-[#5C5B57] border-[#E6E5E1]",
    green: "bg-[#ECF7F3] text-[#0D7A5F] border-[#0D7A5F]/20",
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
      {status === "SCHEDULED" && (
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
      )}
      {status === "PAUSED" && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
      {(status === "DRAFT" || status === "EXPIRED") && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#827D87]" />
      )}
      {children || status}
    </span>
  );
}
