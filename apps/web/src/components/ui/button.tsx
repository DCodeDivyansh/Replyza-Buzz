import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "gradient" | "accent" | "secondary" | "danger" | "ghost" | "outline";
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
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-[#141413] text-[#FAF9F6] hover:bg-[#2A2A28] focus:ring-[#141413]/20",
      accent:
        "bg-[#D94E28] text-white hover:bg-[#C0421F] focus:ring-[#D94E28]/25",
      gradient:
        "bg-[#D94E28] text-white hover:bg-[#C0421F] focus:ring-[#D94E28]/25",
      secondary:
        "bg-[#FFFFFF] text-[#141413] border border-[#E6E5E1] hover:bg-[#F3F2EE] focus:ring-[#141413]/10",
      outline:
        "border border-[#D1CFC9] text-[#141413] bg-transparent hover:bg-[#F3F2EE] focus:ring-[#141413]/10",
      danger:
        "bg-[#C81E1E] text-white hover:bg-[#A61818] focus:ring-[#C81E1E]/25",
      ghost:
        "text-[#5C5B57] hover:text-[#141413] hover:bg-[#F3F2EE] focus:ring-[#141413]/10",
    };

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-xs sm:text-sm px-4 py-2 gap-2",
      lg: "text-sm px-5 py-2.5 gap-2",
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
          <Loader2 className="h-3.5 w-3.5 animate-spin text-current shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
