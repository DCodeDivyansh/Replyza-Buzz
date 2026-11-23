import React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50",
        className
      )}
    >
      {icon && (
        <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-500 shadow-2xs">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-zinc-500 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
