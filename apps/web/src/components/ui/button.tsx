import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "gradient" | "secondary" | "danger" | "ghost" | "outline";
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
      "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-[#17131D] text-[#FFFDFB] hover:bg-[#2A2334] focus:ring-[#17131D]/20 shadow-xs",
      gradient:
        "ig-gradient text-white hover:opacity-95 focus:ring-[#E1306C]/30 shadow-sm",
      secondary:
        "bg-[#FFFDFB] text-[#17131D] border border-[#17131D]/12 hover:bg-[#F8F5F8] focus:ring-[#17131D]/15 shadow-2xs",
      outline:
        "border border-[#17131D]/15 text-[#17131D] hover:bg-[#F8F5F8] focus:ring-[#17131D]/15",
      danger:
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/20 shadow-xs",
      ghost:
        "text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8] focus:ring-[#17131D]/15",
    };

    const sizeStyles = {
      sm: "text-xs px-3.5 py-1.5 gap-1.5",
      md: "text-sm px-4.5 py-2.5 gap-2",
      lg: "text-sm sm:text-base px-6 py-3 gap-2",
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
