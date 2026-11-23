import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles = {
      primary:
        "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500/20 active:bg-indigo-800 shadow-sm",
      secondary:
        "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 focus:ring-zinc-400/20 shadow-xs",
      outline:
        "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 focus:ring-zinc-400/20",
      danger:
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/20 active:bg-red-800 shadow-sm",
      ghost:
        "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 focus:ring-zinc-400/20",
    };

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1.5 gap-1.5",
      md: "text-sm px-3.5 py-2 gap-2",
      lg: "text-base px-4 py-2.5 gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
