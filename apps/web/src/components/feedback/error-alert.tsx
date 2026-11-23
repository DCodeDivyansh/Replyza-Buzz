import React from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorAlertProps {
  message: string;
  errors?: Array<{ field?: string; message: string }>;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({
  message,
  errors,
  onDismiss,
  className,
}: ErrorAlertProps) {
  if (!message && (!errors || errors.length === 0)) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-red-200 bg-red-50/80 p-3.5 text-red-800 text-xs",
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-red-900">{message}</p>
          {errors && errors.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-1 text-red-700">
              {errors.map((err, idx) => (
                <li key={idx}>
                  {err.field ? (
                    <span className="font-semibold">{err.field}: </span>
                  ) : null}
                  {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600 transition-colors p-0.5"
            aria-label="Dismiss alert"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
