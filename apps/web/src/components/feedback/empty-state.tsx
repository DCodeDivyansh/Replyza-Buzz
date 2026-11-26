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
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-[#D1CFC9] bg-[#FFFFFF]",
        className
      )}
    >
      {icon && (
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg bg-[#FAF9F6] border border-[#E6E5E1] text-[#5C5B57]">
          {icon}
        </div>
      )}
      <h3 className="font-display text-sm font-semibold text-[#141413]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-[#5C5B57] leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
