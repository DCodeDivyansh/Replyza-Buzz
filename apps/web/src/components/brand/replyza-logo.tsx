import React from "react";
import { cn } from "@/lib/utils";

interface ReplyzaLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

export function ReplyzaLogo({
  size = "md",
  showWordmark = true,
  className,
}: ReplyzaLogoProps) {
  const iconDimensions = {
    sm: "h-7 w-7 rounded-lg",
    md: "h-8 w-8 rounded-xl",
    lg: "h-10 w-10 rounded-xl",
  }[size];

  const textSize = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  }[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        className={cn(
          "bg-[#D94E28] flex items-center justify-center text-white shrink-0",
          iconDimensions
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[54%] w-[54%]"
          aria-hidden="true"
        >
          <path
            d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H5.5L7.6 16.9C5.4 15.6 4 13.9 4 12Z"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 12H14.5M14.5 12L12.3 9.8M14.5 12L12.3 14.2"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-[#141413]",
            textSize
          )}
        >
          Replyza
        </span>
      )}
    </span>
  );
}
