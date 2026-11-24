"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Application Error Boundary caught error]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 sm:p-10 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Something went wrong
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            An unexpected error occurred while rendering this view. Our system has logged the diagnostic trace.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-zinc-400">
              Error Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Button size="sm" onClick={() => reset()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
