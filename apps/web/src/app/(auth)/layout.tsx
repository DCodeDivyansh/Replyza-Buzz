"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";
import { Spinner } from "@/components/ui/spinner";

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
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDFB]">
        <Spinner size="md" label="Checking session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-ambient flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex justify-center">
        <Link href="/">
          <ReplyzaLogo size="lg" />
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#FFFDFB] py-8 px-6 sm:px-10 shadow-[0_20px_50px_rgba(23,19,29,0.06)] border border-[#17131D]/10 rounded-3xl">
          {children}
        </div>
      </div>
    </div>
  );
}
