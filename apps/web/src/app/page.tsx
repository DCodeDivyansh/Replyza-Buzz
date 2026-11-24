"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Send,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Zap,
  Clock,
  Activity,
} from "lucide-react";

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Someone comments on your post",
    description:
      "A follower comments \"GUIDE\" or any keyword on your Reel or Instagram post. Meta delivers the signed webhook event to Replyza in milliseconds.",
    previewLabel: "Instagram Comment Webhook",
    handle: "@maya_studio",
    bubble: "GUIDE please! Been waiting for this drop 🔥",
    status: "Webhook Verified",
  },
  {
    step: "02",
    title: "Replyza replies publicly",
    description:
      "Replyza immediately posts a natural public comment reply to boost engagement velocity and let the commenter know their DM is waiting.",
    previewLabel: "Public Comment Reply",
    handle: "@yourbrand",
    bubble: "Just sent it to your DMs, @maya_studio! Check your requests ✨",
    status: "Comment Replied",
  },
  {
    step: "03",
    title: "Replyza sends a private DM",
    description:
      "At most one compliant private reply is delivered with your link, promo code, or optional Follow-to-DM quick-reply check.",
    previewLabel: "Private Direct Message",
    handle: "Replyza DM",
    bubble: "Hey Maya! Here is your early-access guide + 20% creator code 👇",
    status: "DM Sent",
  },
  {
    step: "04",
    title: "The conversation continues",
    description:
      "When they tap \"I've followed!\", Replyza verifies status where supported by Meta and delivers the final link—tracked end-to-end in Activity.",
    previewLabel: "Execution Completed",
    handle: "Activity Center",
    bubble: "Follow verified • Final link delivered • 0 duplicate sends",
    status: "Completed",
  },
];

const FAQS = [
  {
    q: "How does Replyza connect to my Instagram account?",
    a: "Replyza uses official Meta OAuth (Facebook Login for Business) and stores your encrypted token with AES-256-GCM. You can inspect webhook subscription health and disconnect at any time.",
  },
  {
    q: "What Instagram accounts are supported?",
    a: "You need an Instagram Professional account (Creator or Business) linked to a Facebook Page, as required by Meta's Instagram Platform APIs.",
  },
  {
    q: "How does Comment-to-DM work under Meta's rules?",
    a: "Meta permits one private reply per comment within 7 days. Replyza enforces database-authoritative idempotency so a single comment never receives duplicate public replies or DMs.",
  },
  {
    q: "How does Follow-to-DM verification work?",
    a: "Replyza sends a private message with an \"I've followed!\" Quick Reply button. When tapped, Replyza queries Meta's User Profile API (is_user_follow_business) where available for your app's access level and user privacy settings. If verification is unavailable, Replyza reports the exact status honestly rather than faking verification.",
  },
  {
    q: "Can I pause or edit an automation anytime?",
    a: "Yes. Every automation can be drafted, activated, paused, edited, or deleted from your dashboard with immediate effect on incoming webhook matching.",
  },
  {
    q: "Is Replyza secure?",
    a: "All webhooks are verified with HMAC-SHA256 signatures, tokens are encrypted at rest, sessions use HttpOnly cookies with CSRF protection, and every database query is strictly tenant-isolated.",
  },
];

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeFlowIdx, setActiveFlowIdx] = useState(0);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const activeStep = WORKFLOW_STEPS[activeFlowIdx];

  return (
    <div className="min-h-screen bg-[#FFFDFB] text-[#17131D] flex flex-col overflow-x-hidden">
      {/* Floating Rounded Pill Navigation */}
      <header className="sticky top-4 z-50 px-4 sm:px-6 pointer-events-none">
        <div className="max-w-5xl mx-auto pointer-events-auto rounded-full bg-[#FFFDFB]/85 backdrop-blur-md border border-[#17131D]/10 px-4 sm:px-6 h-14 flex items-center justify-between shadow-[0_8px_30px_rgba(23,19,29,0.06)]">
          <Link href="/" className="shrink-0">
            <ReplyzaLogo size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#827D87]">
            <a href="#workflow" className="hover:text-[#17131D] transition-colors">
              Workflow
            </a>
            <a href="#features" className="hover:text-[#17131D] transition-colors">
              Features
            </a>
            <a href="#showcase" className="hover:text-[#17131D] transition-colors">
              Product
            </a>
            <a href="#faq" className="hover:text-[#17131D] transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="h-8 w-24 bg-[#F8F5F8] rounded-full animate-pulse" />
            ) : isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" variant="primary" className="gap-1.5">
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
                  <Button size="sm" variant="gradient">
                    Get started free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* SECTION 1 — IMMERSIVE HERO */}
        <section className="hero-ambient relative pt-14 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6">
          {/* Oversized central editorial wordmark backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none text-center font-display font-bold tracking-[-0.06em] text-[18vw] sm:text-[14vw] leading-none text-[#17131D]/[0.035] -mb-8 sm:-mb-14"
          >
            REPLYZA
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center relative z-10">
            {/* Left Editorial Copy */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFFDFB] border border-[#17131D]/10 text-xs font-medium text-[#17131D] shadow-2xs">
                <span className="h-2 w-2 rounded-full ig-gradient" />
                <span>Official Meta Instagram Automation</span>
              </div>

              <h1 className="font-display text-5xl sm:text-6xl lg:text-[4.25rem] font-bold tracking-[-0.04em] leading-[1.02] text-[#17131D]">
                Your Instagram.
                <br />
                <span className="ig-gradient-text">On autopilot.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#827D87] max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Turn every comment into a conversation. Automate replies, start more DMs, and grow your audience without being glued to Instagram.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <Link href={isAuthenticated ? "/dashboard" : "/register"} className="w-full sm:w-auto">
                  <Button size="lg" variant="gradient" className="w-full sm:w-auto gap-2">
                    <span>{isAuthenticated ? "Open Dashboard" : "Get started free"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#workflow" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    Explore Replyza
                  </Button>
                </a>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-[#827D87]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#E1306C]" />
                  Database-backed idempotency
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#833AB4]" />
                  Encrypted token storage
                </span>
              </div>
            </div>

            {/* Right Custom Product UI Composition */}
            <div className="lg:col-span-6 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Floating circular callout */}
                <div className="hidden sm:flex animate-float-slow absolute -top-6 -right-3 z-20 h-24 w-24 rounded-full ig-gradient text-white flex-col items-center justify-center text-center shadow-lg p-2">
                  <span className="font-display text-lg font-bold leading-none">1x</span>
                  <span className="text-[10px] font-medium leading-tight mt-1 opacity-95">
                    Zero duplicate replies
                  </span>
                </div>

                {/* Main layered product canvas */}
                <div className="rounded-3xl bg-[#F8F5F8] border border-[#17131D]/10 p-5 sm:p-6 shadow-[0_24px_60px_rgba(23,19,29,0.08)] space-y-4">
                  {/* Card 1: Incoming Comment */}
                  <div className="rounded-2xl bg-[#FFFDFB] border border-[#17131D]/8 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#833AB4]">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Incoming Reel Comment
                      </span>
                      <span className="text-[11px] text-[#827D87] font-mono">Keyword: LINK</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full ig-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                        SC
                      </div>
                      <div className="text-xs">
                        <p className="font-semibold text-[#17131D]">@sarah_creates</p>
                        <p className="text-[#827D87]">“Can you send me the link for this setup? 🔥”</p>
                      </div>
                    </div>
                  </div>

                  {/* Connector */}
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-px bg-[#17131D]/15" />
                  </div>

                  {/* Card 2: Public Reply + Private DM */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#FFFDFB] border border-[#17131D]/8 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#827D87]">
                          Public Reply
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Sent
                        </span>
                      </div>
                      <p className="text-xs text-[#17131D] leading-snug">
                        “Check your DMs @sarah_creates! Sent it right over 💌”
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#17131D] text-[#FFFDFB] p-3.5 space-y-2 animate-float-delayed">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FCAF45]">
                          Instagram DM
                        </span>
                        <Send className="h-3 w-3 text-[#E1306C]" />
                      </div>
                      <p className="text-xs leading-snug text-[#FFFDFB]/90">
                        “Hey Sarah! Tap below once you follow to unlock your link 👇”
                      </p>
                      <div className="inline-flex items-center gap-1 rounded-full bg-[#FFFDFB]/12 px-2.5 py-1 text-[10px] font-medium">
                        I&apos;ve followed! ✅
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — PRODUCT DEMONSTRATION */}
        <section id="workflow" className="py-20 sm:py-28 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E1306C]">
                Interactive Flow
              </span>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.06] text-[#17131D]">
                From comment to conversation.
              </h2>
              <p className="text-sm sm:text-base text-[#827D87] leading-relaxed">
                Click through each stage to see how Replyza captures webhooks, prevents duplicates, and delivers private messages reliably.
              </p>

              <div className="pt-4 space-y-2">
                {WORKFLOW_STEPS.map((item, idx) => {
                  const isActive = idx === activeFlowIdx;
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => setActiveFlowIdx(idx)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#17131D] text-[#FFFDFB] border-[#17131D]"
                          : "bg-[#FFFDFB] text-[#17131D] border-[#17131D]/8 hover:bg-[#F8F5F8]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono text-xs font-semibold ${
                              isActive ? "text-[#FCAF45]" : "text-[#827D87]"
                            }`}
                          >
                            {item.step}
                          </span>
                          <span className="font-display text-sm font-semibold">
                            {item.title}
                          </span>
                        </div>
                        <ArrowRight
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? "text-[#E1306C]" : "text-[#827D87]"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-3xl bg-[#F8F5F8] border border-[#17131D]/8 p-6 sm:p-10 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#827D87]">
                    Step {activeStep.step} — {activeStep.previewLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFDFB] border border-[#17131D]/10 px-3 py-1 text-xs font-medium text-[#17131D]">
                    <span className="h-2 w-2 rounded-full ig-gradient" />
                    {activeStep.status}
                  </span>
                </div>

                <div className="rounded-2xl bg-[#FFFDFB] border border-[#17131D]/8 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full ig-gradient flex items-center justify-center text-white font-display font-bold text-sm">
                      {activeStep.step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#17131D]">
                        {activeStep.handle}
                      </p>
                      <p className="text-xs text-[#827D87]">
                        Real-time Replyza pipeline
                      </p>
                    </div>
                  </div>

                  <p className="font-display text-xl sm:text-2xl font-semibold text-[#17131D] leading-snug">
                    “{activeStep.bubble}”
                  </p>

                  <p className="text-sm text-[#827D87] leading-relaxed pt-2 border-t border-[#17131D]/6">
                    {activeStep.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 — EDITORIAL FEATURES */}
        <section id="features" className="py-20 bg-[#F8F5F8] border-y border-[#17131D]/6 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto space-y-20">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#833AB4]">
                Capabilities
              </span>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#17131D] mt-2">
                Built for creators and teams who refuse missed DMs.
              </h2>
            </div>

            {/* Feature Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 space-y-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E1306C]">
                  <Zap className="h-4 w-4" />
                  Comment-to-DM & Keyword Triggers
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#17131D]">
                  Respond to every comment, or match exact keywords.
                </h3>
                <p className="text-sm text-[#827D87] leading-relaxed">
                  Pick any post or Reel directly from your Media Library. Trigger on specific keywords like “PRICE” or “GUIDE”, or reply to every comment automatically with dynamic variables.
                </p>
              </div>
              <div className="lg:col-span-7">
                <div className="rounded-3xl bg-[#FFFDFB] border border-[#17131D]/8 p-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {["GUIDE", "LINK", "DISCOUNT", "ANY COMMENT"].map((kw, i) => (
                      <span
                        key={kw}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${
                          i === 0
                            ? "ig-gradient text-white"
                            : "bg-[#F8F5F8] text-[#17131D] border border-[#17131D]/8"
                        }`}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-[#F8F5F8] p-4 text-xs text-[#17131D] space-y-1.5">
                    <p className="font-semibold">Public Reply Template</p>
                    <p className="text-[#827D87]">
                      “Hey {"{{username}}"}! Just dropped the link in your DMs ✨”
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Row 2 (Alternating) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 order-2 lg:order-1">
                <div className="rounded-3xl bg-[#17131D] text-[#FFFDFB] p-6 sm:p-8 space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#827D87]">
                    <span>Follow-to-DM Gate</span>
                    <span className="text-[#FCAF45] font-mono">Quick Reply</span>
                  </div>
                  <div className="rounded-2xl bg-[#FFFDFB]/8 p-4 space-y-3">
                    <p className="text-sm">
                      “Follow our page and tap below to unlock your resource instantly 👇”
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFDFB] text-[#17131D] px-3.5 py-1.5 text-xs font-semibold">
                      <UserCheck className="h-3.5 w-3.5 text-[#E1306C]" />
                      I&apos;ve followed! ✅
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F77737]">
                  <Sparkles className="h-4 w-4" />
                  Follow-to-DM & Reusable Templates
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#17131D]">
                  Start from proven templates in seconds.
                </h3>
                <p className="text-sm text-[#827D87] leading-relaxed">
                  Launch with reusable DM templates or enable optional follow verification before sending your final link—with honest, Meta-compliant status tracking.
                </p>
              </div>
            </div>

            {/* Feature Row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 space-y-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#833AB4]">
                  <Activity className="h-4 w-4" />
                  Execution History & Account Health
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#17131D]">
                  See every reply, DM, and retry in real time.
                </h3>
                <p className="text-sm text-[#827D87] leading-relaxed">
                  No black-box automations. Inspect live execution statuses, webhook subscription health, and exact error diagnostics from one clean activity center.
                </p>
              </div>
              <div className="lg:col-span-7">
                <div className="rounded-3xl bg-[#FFFDFB] border border-[#17131D]/8 p-6 space-y-3">
                  {[
                    { user: "@alex_fit", comment: "LINK", state: "Completed", tone: "bg-emerald-50 text-emerald-700" },
                    { user: "@studio_k", comment: "PRICE", state: "Follow verified", tone: "bg-[#833AB4]/10 text-[#833AB4]" },
                    { user: "@nina.ui", comment: "GUIDE", state: "DM sent", tone: "bg-[#E1306C]/10 text-[#E1306C]" },
                  ].map((row) => (
                    <div
                      key={row.user}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#F8F5F8] text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[#17131D]">{row.user}</span>
                        <span className="text-[#827D87] font-mono">“{row.comment}”</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full font-medium ${row.tone}`}>
                        {row.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 — HOW IT WORKS (3 STEPS) */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E1306C]">
              How It Works
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#17131D] mt-2">
              Three steps to autopilot.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                title: "Connect your Instagram account",
                desc: "Authorize via Meta OAuth in one click. Replyza verifies your webhook subscription health automatically.",
              },
              {
                num: "02",
                title: "Create your automation",
                desc: "Select a post, set keyword or any-comment triggers, craft your public reply and DM, and toggle optional follow checks.",
              },
              {
                num: "03",
                title: "Let Replyza handle conversations",
                desc: "Every eligible comment is processed once with transactional outbox reliability and tracked in Activity.",
              },
            ].map((item) => (
              <div
                key={item.num}
                className="rounded-3xl border border-[#17131D]/8 bg-[#FFFDFB] p-7 space-y-4"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full ig-gradient text-white font-display font-bold text-sm">
                  {item.num}
                </span>
                <h3 className="font-display text-xl font-bold text-[#17131D]">
                  {item.title}
                </h3>
                <p className="text-sm text-[#827D87] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5 — PRODUCT SHOWCASE */}
        <section id="showcase" className="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="rounded-3xl bg-[#17131D] text-[#FFFDFB] p-6 sm:p-12 space-y-8 overflow-hidden relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FCAF45]">
                  Inside Replyza
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2">
                  One workspace for every comment, DM, and connection.
                </h2>
              </div>
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                <Button variant="gradient" size="md">
                  Try the Workspace
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-[#FFFDFB]/6 border border-[#FFFDFB]/10 p-5 space-y-2">
                <p className="text-xs text-[#827D87]">Automation Flow</p>
                <p className="font-display font-semibold text-base">
                  Comment → Match → Public Reply → Private DM
                </p>
                <p className="text-xs text-[#FFFDFB]/70">
                  Visual step-by-step builder with live phone preview.
                </p>
              </div>
              <div className="rounded-2xl bg-[#FFFDFB]/6 border border-[#FFFDFB]/10 p-5 space-y-2">
                <p className="text-xs text-[#827D87]">Activity Center</p>
                <p className="font-display font-semibold text-base">
                  Full Delivery Timeline
                </p>
                <p className="text-xs text-[#FFFDFB]/70">
                  Distinguishes confirmed delivery, retry pending, and unknown outcomes.
                </p>
              </div>
              <div className="rounded-2xl bg-[#FFFDFB]/6 border border-[#FFFDFB]/10 p-5 space-y-2">
                <p className="text-xs text-[#827D87]">Instagram Connection</p>
                <p className="font-display font-semibold text-base">
                  Live Webhook Health
                </p>
                <p className="text-xs text-[#FFFDFB]/70">
                  Shows exact token validity and webhook subscription status.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 — BENEFITS */}
        <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: Clock, label: "Never miss an important comment" },
              { icon: Zap, label: "Respond in seconds" },
              { icon: MessageCircle, label: "Turn engagement into DMs" },
              { icon: Sparkles, label: "Save hours every week" },
              { icon: ShieldCheck, label: "Zero duplicate replies" },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.label}
                  className="rounded-2xl bg-[#F8F5F8] p-5 space-y-2.5"
                >
                  <Icon className="h-5 w-5 text-[#E1306C]" />
                  <p className="text-xs sm:text-sm font-semibold text-[#17131D] leading-snug">
                    {b.label}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 7 — FAQ ACCORDION */}
        <section id="faq" className="py-20 px-4 sm:px-6 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#833AB4]">
              FAQ
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#17131D] mt-2">
              Questions, answered honestly.
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full px-6 py-4.5 flex items-center justify-between text-left gap-4 cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span className="font-display text-sm sm:text-base font-semibold text-[#17131D]">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[#827D87] shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-[#17131D]" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-[#827D87] leading-relaxed border-t border-[#17131D]/6 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 8 — FINAL CTA */}
        <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="rounded-3xl ig-gradient p-10 sm:p-16 text-center text-white space-y-6">
            <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-[-0.03em]">
              Make every interaction count.
            </h2>
            <p className="text-sm sm:text-base text-white/90 max-w-xl mx-auto">
              Connect your Instagram account in under two minutes and let Replyza turn comments into conversations.
            </p>
            <div>
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                <Button
                  size="lg"
                  className="bg-[#FFFDFB] text-[#17131D] hover:bg-[#F8F5F8] gap-2"
                >
                  <span>Start automating with Replyza</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-[#17131D]/8 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#827D87]">
          <div className="flex items-center gap-3">
            <ReplyzaLogo size="sm" />
            <span>© 2026 Replyza</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className="hover:text-[#17131D] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[#17131D] transition-colors">
              Terms of Service
            </Link>
            <Link href="/data-deletion" className="hover:text-[#17131D] transition-colors">
              Data Deletion
            </Link>
            <Link href="/login" className="hover:text-[#17131D] transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
