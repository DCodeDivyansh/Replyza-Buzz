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
        "flex flex-col items-center justify-center text-center p-8 sm:p-10 rounded-2xl border border-dashed border-[#D5CCC3] bg-[#F7F1EC]/60",
        className
      )}
    >
      {icon && (
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#FCE8EC] border border-[#E1306C]/20 text-[#E1306C]">
          {icon}
        </div>
      )}
      <h3 className="font-display text-sm sm:text-base font-bold text-[#161413]">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-[#6E655F] leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
