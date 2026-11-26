"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";
import { Spinner } from "@/components/ui/spinner";
import { Check, ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <Spinner size="md" label="Checking session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#FAF9F6]">
      {/* Left Editorial Panel */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between border-r border-[#E6E5E1] bg-[#FAF9F6] p-10">
        <Link href="/">
          <ReplyzaLogo size="md" />
        </Link>

        <div className="space-y-6 max-w-sm">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#5C5B57]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0D7A5F]" />
            Official Meta Instagram Graph API
          </div>
          <h1 className="font-display text-2xl font-bold text-[#141413] leading-snug">
            Automated comment-to-DM product delivery for creators.
          </h1>
          <ul className="space-y-3 text-xs text-[#5C5B57]">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-[#0D7A5F] shrink-0" />
              <span>Deliver up to 10 affiliate product links per automation with preserved tracking URLs.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-[#0D7A5F] shrink-0" />
              <span>Reuse brand collaborations from your Affiliate Product Library.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-[#0D7A5F] shrink-0" />
              <span>Database-enforced idempotency prevents duplicate DMs on webhook retries.</span>
            </li>
          </ul>
        </div>

        <p className="text-[11px] text-[#8C8A84]">
          Replyza Buzz · Creator Commerce Workspace
        </p>
      </div>

      {/* Right Form Panel */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-4 sm:p-8 bg-[#FFFFFF]">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex justify-center">
            <Link href="/">
              <ReplyzaLogo size="md" />
            </Link>
          </div>
          <div className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] p-6 sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
