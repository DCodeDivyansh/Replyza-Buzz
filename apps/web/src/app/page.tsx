"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Bot,
  MessageSquare,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between">
      {/* Navigation Header */}
      <header className="border-b border-zinc-100 bg-white/80 backdrop-blur-xs sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-900">
              Replyza
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-20 bg-zinc-100 rounded-lg animate-pulse" />
            ) : isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="gap-1.5 shadow-xs">
                  <span>Open Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="shadow-xs">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 sm:py-28 px-4 sm:px-6 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-medium mb-6">
            <Zap className="h-3.5 w-3.5 text-indigo-600" />
            <span>Automated Instagram Comment & DM Engagement</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 leading-[1.12]">
            Turn Instagram Comments Into <br className="hidden sm:inline" />
            <span className="text-indigo-600">Automated Direct Messages</span>
          </h1>

          <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base text-zinc-600 leading-relaxed">
            Replyza listens for comments on your posts and reels, instantly publishes engaging public replies, and sends private DMs with links, promo codes, and lead magnets.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={isAuthenticated ? "/dashboard" : "/register"}>
              <Button size="lg" className="gap-2 px-6 shadow-sm w-full sm:w-auto">
                <span>{isAuthenticated ? "Go to Dashboard" : "Start Automating Now"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={isAuthenticated ? "/automations" : "/login"}>
              <Button
                variant="secondary"
                size="lg"
                className="px-6 w-full sm:w-auto"
              >
                {isAuthenticated ? "Manage Automations" : "Sign In to Workspace"}
              </Button>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Official Meta Graph API v27.0
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Encrypted Token Storage
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Keyword & All-Comment Triggers
            </span>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 bg-zinc-50/70 border-t border-b border-zinc-200/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                Engineered for Performance & Reliability
              </h2>
              <p className="text-xs text-zinc-500 mt-1.5">
                A lightweight, robust platform designed to scale with your content
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs space-y-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Targeted Keyword Triggers
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Trigger automations on exact keywords (e.g. &ldquo;price&rdquo;, &ldquo;link&rdquo;, &ldquo;guide&rdquo;) or configure universal replies for every comment received.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs space-y-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Dual-Action Response
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Boost post engagement algorithms by responding publicly in the comment section while delivering high-converting private direct messages.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs space-y-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Enterprise Security
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Meta access tokens are encrypted with AES-256-GCM. Webhooks are cryptographically validated against Meta app secrets with strict rate limiting.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700">Replyza</span>
            <span>&mdash; Professional Instagram Comment & DM Automation</span>
          </div>
          <div>
            <span>Backend API & Worker Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
