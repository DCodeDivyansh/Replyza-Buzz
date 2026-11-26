import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightAction,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-zinc-700"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-zinc-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            className={cn(
              "w-full rounded-lg border bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#141413] placeholder:text-[#8C8A84] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-[#F3F2EE] disabled:text-[#8C8A84] disabled:cursor-not-allowed",
              error
                ? "border-red-300 focus:border-[#C81E1E] focus:ring-[#C81E1E]/15"
                : "border-[#E6E5E1] focus:border-[#141413] focus:ring-[#141413]/10",
              leftIcon && "pl-9",
              rightAction && "pr-10",
              className
            )}
            {...props}
          />
          {rightAction && (
            <div className="absolute right-2.5 flex items-center">
              {rightAction}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
