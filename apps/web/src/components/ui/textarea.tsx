import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      maxLength,
      value,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const charCount = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={inputId}
              className="block text-xs font-medium text-zinc-700"
            >
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          )}
          {maxLength !== undefined && (
            <span
              className={cn(
                "text-xs",
                charCount > maxLength ? "text-red-500 font-medium" : "text-zinc-400"
              )}
            >
              {charCount} / {maxLength}
            </span>
          )}
        </div>
        <textarea
          ref={ref}
          id={inputId}
          required={required}
          maxLength={maxLength}
          value={value}
          className={cn(
            "w-full rounded-xl border bg-[#FFFDFB] px-3.5 py-2.5 text-sm text-[#17131D] placeholder:text-[#827D87]/70 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-[#F8F5F8] disabled:text-[#827D87] disabled:cursor-not-allowed resize-y",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-[#17131D]/12 focus:border-[#E1306C] focus:ring-[#E1306C]/15",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
