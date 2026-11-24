import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileQuestion } from "lucide-react";

export const metadata = {
  title: "404 - Page Not Found | Replyza",
  description: "The page you are looking for does not exist",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 sm:p-10 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
          <FileQuestion className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Page not found
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            The page you requested could not be found or may have been moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button size="sm" className="w-full gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full">
              Homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
