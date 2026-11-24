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
  // If status is provided, resolve the corresponding variant
  let resolvedVariant = variant;
  if (status) {
    if (status === "ACTIVE") resolvedVariant = "active";
    else if (status === "DRAFT") resolvedVariant = "draft";
    else if (status === "PAUSED") resolvedVariant = "paused";
  }

  const variantStyles = {
    default: "bg-zinc-100 text-zinc-700 border-zinc-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200/80",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    danger: "bg-red-50 text-red-700 border-red-200/80",
    purple: "bg-purple-50 text-purple-700 border-purple-200/80",
    blue: "bg-sky-50 text-sky-700 border-sky-200/80",
    gray: "bg-zinc-100 text-zinc-600 border-zinc-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border select-none",
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
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      )}
      {children || status}
    </span>
  );
}
