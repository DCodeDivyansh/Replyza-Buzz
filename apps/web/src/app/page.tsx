"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";
import { Button } from "@/components/ui/button";
import { HeroSimulator } from "@/components/landing/hero-simulator";
import { FeatureSplit } from "@/components/landing/feature-split";
import { WorkflowSteps, LandingFooter } from "@/components/landing/workflow-steps";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#141413]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#E6E5E1] bg-[#FAF9F6]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <ReplyzaLogo size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#5C5B57]">
            <a href="#features" className="hover:text-[#141413] transition-colors">
              Features
            </a>
            <a href="#workflow" className="hover:text-[#141413] transition-colors">
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {!isLoading && isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" variant="primary">
                  Open Workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="sm" variant="ghost">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" variant="accent">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-24">
        {/* Asymmetric Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-md border border-[#E6E5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#5C5B57]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0D7A5F]" />
              <span>Official Meta Instagram Graph API</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#141413] leading-[1.12]">
              Turn Reel comments into tracked product DMs.
            </h1>

            <p className="text-sm sm:text-base text-[#5C5B57] leading-relaxed">
              Replyza Buzz watches your Instagram comments, posts a public reply, and sends single or multi-product affiliate links straight to your follower&apos;s inbox—with zero duplicate sends.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                <Button size="lg" variant="accent">
                  {isAuthenticated ? "Go to Dashboard" : "Create Free Account"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#workflow">
                <Button size="lg" variant="secondary">
                  See How It Works
                </Button>
              </a>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#E6E5E1]">
              <div>
                <div className="font-mono-num text-lg font-bold text-[#141413]">10</div>
                <div className="text-[11px] text-[#5C5B57]">Products per flow</div>
              </div>
              <div>
                <div className="font-mono-num text-lg font-bold text-[#141413]">9</div>
                <div className="text-[11px] text-[#5C5B57]">DM template styles</div>
              </div>
              <div>
                <div className="font-mono-num text-lg font-bold text-[#0D7A5F]">100%</div>
                <div className="text-[11px] text-[#5C5B57]">Affiliate URL fidelity</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <HeroSimulator />
          </div>
        </section>

        <FeatureSplit />
        <WorkflowSteps />

        {/* Bottom CTA */}
        <section className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141413]">
              Ready to automate your next product drop?
            </h2>
            <p className="text-sm text-[#5C5B57]">
              Connect your Instagram Professional account and launch your first comment-to-DM workflow in minutes.
            </p>
          </div>
          <Link href={isAuthenticated ? "/automations/new" : "/register"}>
            <Button size="lg" variant="primary" className="shrink-0">
              {isAuthenticated ? "New Automation" : "Start Building"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
