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
              "w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed",
              error
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                : "border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20",
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
