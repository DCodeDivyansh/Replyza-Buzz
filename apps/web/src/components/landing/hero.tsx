"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Heart,
  MessageCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const HERO_DEMOS = [
  {
    keyword: "SEND LINK",
    handle: "@maya.creates",
    reelTitle: "My 2-step morning glow routine ✨",
    comment: "SEND LINK! Need that serum from your morning routine ✨",
    reply: "Just sent the link to your DMs @maya.creates!",
    dmGreeting: "Hey Maya! Here is the serum & creator code you asked for:",
    product: {
      brand: "GLOWLAB",
      title: "Vitamin C 10% Brightening Serum",
      price: "₹699",
      oldPrice: "₹999",
      code: "MAYA20",
      url: "shop.example.com/vit-c?tag=maya",
      swatch: "from-[#FCE8EC] to-[#F77737]/25",
    },
  },
  {
    keyword: "OUTFIT",
    handle: "@sara.styles",
    reelTitle: "3 effortless linen looks for summer ☀️",
    comment: "OUTFIT links please!! That linen blazer is perfection",
    reply: "Check your DMs @sara.styles — sent both links!",
    dmGreeting: "Hey Sara! Here is the linen blazer from today's Reel:",
    product: {
      brand: "STUDIO LINEN",
      title: "Relaxed Tailored Blazer — Sand",
      price: "$89",
      oldPrice: "$120",
      code: "SARA15",
      url: "ltk.app/sara/linen-blazer",
      swatch: "from-[#EDE4DD] to-[#F77737]/20",
    },
  },
  {
    keyword: "GUIDE",
    handle: "@arjun_dev",
    reelTitle: "Clean wireless desk setup tour ⌨️",
    comment: "GUIDE! Want the full desk setup gear list",
    reply: "Sent the full setup guide to your inbox @arjun_dev!",
    dmGreeting: "Hey Arjun! Here is the exact desk gear & affiliate links:",
    product: {
      brand: "KEYCHRON",
      title: "K2 Pro Wireless Mechanical Keyboard",
      price: "$99",
      oldPrice: "$119",
      code: "DESK10",
      url: "amzn.to/keychron-k2?tag=desk",
      swatch: "from-[#F3F2EE] to-[#E1306C]/20",
    },
  },
];

const MARQUEE_TEXT =
  "COMMENT TO DM • INSTANT PRODUCT DELIVERY • AUTO-FOLLOW CHECK • ZERO BOT VIBES • ";

type PhoneStage = "reel_comment" | "dm_typing" | "dm_delivered";

export function LandingHero() {
  const { isAuthenticated } = useAuth();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [stage, setStage] = useState<PhoneStage>("reel_comment");
  const [runId, setRunId] = useState(0);
  const active = HERO_DEMOS[selectedIdx];

  // Magnetic button motion
  const magX = useMotionValue(0);
  const magY = useMotionValue(0);
  const smoothMagX = useSpring(magX, { stiffness: 300, damping: 20 });
  const smoothMagY = useSpring(magY, { stiffness: 300, damping: 20 });

  // 3D mouse-tilt parallax on iPhone (±4deg)
  const phoneRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), {
    stiffness: 180,
    damping: 22,
  });
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), {
    stiffness: 180,
    damping: 22,
  });

  useEffect(() => {
    const t1 = setTimeout(() => setStage("dm_typing"), 1150);
    const t2 = setTimeout(() => setStage("dm_delivered"), 1650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [selectedIdx, runId]);

  const triggerReplay = (nextIdx?: number) => {
    if (nextIdx !== undefined) setSelectedIdx(nextIdx);
    setStage("reel_comment");
    setRunId((r) => r + 1);
  };

  const handlePhoneMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = phoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handlePhoneMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section className="relative bg-[#FCE8EC] pt-4 sm:pt-8 pb-20 sm:pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Editorial Headline with Staggered Masked Entrance */}
          <div className="lg:col-span-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full bg-white/95 border border-[#161413]/10 px-3.5 py-1.5 text-[11px] font-mono-num font-medium text-[#161413]"
            >
              <span className="h-2 w-2 rounded-full bg-[#E1306C]" />
              <span>INSTAGRAM CREATOR COMMERCE</span>
            </motion.div>

            <h1 className="font-editorial text-5xl sm:text-6xl lg:text-[72px] uppercase text-[#161413]">
              {["EVERY COMMENT", "TURNS INTO A", "PRODUCT DM."].map((line, i) => (
                <span key={line} className="block overflow-hidden">
                  <motion.span
                    initial={{ y: 42, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      duration: 0.55,
                      delay: 0.08 * i,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`block ${i === 1 ? "text-[#E1306C]" : ""}`}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-base sm:text-lg text-[#6E655F] max-w-xl leading-relaxed"
            >
              Automatically reply to Reel &amp; post comments, verify followers where Meta permits, and deliver multi-product affiliate cards straight into Instagram DMs.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap items-center gap-3 pt-1"
            >
              <motion.div
                style={{ x: smoothMagX, y: smoothMagY }}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  magX.set(((e.clientX - r.left) / r.width - 0.5) * 10);
                  magY.set(((e.clientY - r.top) / r.height - 0.5) * 10);
                }}
                onMouseLeave={() => {
                  magX.set(0);
                  magY.set(0);
                }}
              >
                <Link
                  href={isAuthenticated ? "/dashboard" : "/register"}
                  className="group inline-flex items-center gap-3 rounded-full bg-[#161413] pl-6 pr-2 py-2 text-sm font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
                >
                  <span>{isAuthenticated ? "Open Dashboard" : "Start Automating Free"}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </motion.div>

              <a
                href="#features"
                className="inline-flex items-center rounded-full bg-white border border-[#161413]/15 px-5 py-3 text-sm font-semibold text-[#161413] hover:bg-[#EDE4DD] transition-colors"
              >
                Explore Features
              </a>
            </motion.div>
          </div>

          {/* Right: Realistic iPhone 16 Pro Instagram Simulation */}
          <div className="lg:col-span-6 flex flex-col items-center gap-4">
            {/* Scenario Tabs + Replay Control */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-white/95 border border-[#161413]/10 p-1 shadow-2xs">
                {HERO_DEMOS.map((demo, idx) => {
                  const isActive = idx === selectedIdx;
                  return (
                    <button
                      key={demo.keyword}
                      type="button"
                      onClick={() => triggerReplay(idx)}
                      className={`relative rounded-full px-3 py-1 font-mono-num text-[11px] font-semibold transition-colors cursor-pointer ${
                        isActive ? "text-white" : "text-[#161413] hover:text-[#E1306C]"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="hero-scenario-pill"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="absolute inset-0 rounded-full bg-[#E1306C]"
                        />
                      )}
                      <span className="relative z-10">{demo.keyword}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => triggerReplay()}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-[#161413]/10 px-3 py-1.5 text-[11px] font-semibold text-[#161413] hover:bg-[#EDE4DD] transition-colors cursor-pointer"
                title="Replay comment-to-DM flow"
              >
                <RotateCcw className="h-3 w-3" />
                Replay Flow
              </button>
            </div>

            {/* iPhone 16 Pro Frame with 3D Parallax */}
            <div
              ref={phoneRef}
              onMouseMove={handlePhoneMouseMove}
              onMouseLeave={handlePhoneMouseLeave}
              style={{ perspective: 1000 }}
              className="w-full max-w-[330px]"
            >
              <motion.div
                style={{ rotateX, rotateY }}
                className="relative rounded-[44px] bg-[#161413] p-[9px] shadow-[0_28px_60px_rgba(22,20,19,0.22)] border border-[#2E2B29]"
              >
                {/* Dynamic Island */}
                <div className="absolute top-[16px] left-1/2 -translate-x-1/2 z-30 h-[22px] w-[86px] rounded-full bg-[#161413] flex items-center justify-end pr-2">
                  <span className="h-2 w-2 rounded-full bg-[#2B2927]" />
                </div>

                {/* Inner Screen */}
                <div className="relative rounded-[36px] bg-white overflow-hidden h-[505px] flex flex-col">
                  {/* Top iOS DM Push Notification Banner on DM Transition */}
                  <AnimatePresence>
                    {stage === "dm_typing" && (
                      <motion.div
                        initial={{ y: -56, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -56, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute top-9 inset-x-3 z-20 rounded-2xl bg-[#161413]/92 backdrop-blur-md text-white px-3 py-2 flex items-center gap-2.5 shadow-lg"
                      >
                        <div className="h-6 w-6 rounded-lg bg-[#E1306C] flex items-center justify-center shrink-0">
                          <Send className="h-3 w-3 text-white" />
                        </div>
                        <div className="text-[10px] leading-tight min-w-0">
                          <div className="font-bold">Instagram</div>
                          <div className="text-white/80 truncate">
                            yourbrand sent you a message
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* STAGE 1: Instagram Reel View + Comment Sheet */}
                  {stage === "reel_comment" ? (
                    <motion.div
                      key={`reel-${selectedIdx}-${runId}`}
                      initial={{ opacity: 0.85 }}
                      animate={{ opacity: 1 }}
                      className="relative flex-1 bg-[#1C1917] text-white flex flex-col justify-between pt-11"
                    >
                      {/* Reel Visual Backdrop */}
                      <div className="px-4 flex items-center justify-between text-xs font-semibold">
                        <span>Reels</span>
                        <span className="font-mono-num text-[10px] bg-white/15 px-2 py-0.5 rounded-full">
                          LIVE TRIGGER
                        </span>
                      </div>

                      {/* Creator Info + Right Action Icons */}
                      <div className="px-4 pb-3 flex items-end justify-between gap-2">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-[#E1306C] flex items-center justify-center text-[10px] font-bold">
                              Y
                            </div>
                            <span className="text-xs font-bold">@yourbrand</span>
                            <ShieldCheck className="h-3.5 w-3.5 text-[#3897F0]" />
                          </div>
                          <p className="text-[11px] text-white/85 truncate">
                            {active.reelTitle}
                          </p>
                        </div>

                        <div className="flex flex-col items-center gap-3 text-white/90 shrink-0 pb-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <Heart className="h-5 w-5 fill-[#E1306C] text-[#E1306C]" />
                            <span className="text-[9px]">4.2K</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <MessageCircle className="h-5 w-5" />
                            <span className="text-[9px]">318</span>
                          </div>
                          <Bookmark className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Animated Bottom Comment Sheet */}
                      <motion.div
                        initial={{ y: 120 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="rounded-t-2xl bg-white text-[#161413] p-4 space-y-3 shadow-2xl"
                      >
                        <div className="w-9 h-1 rounded-full bg-[#E6E5E1] mx-auto" />
                        <div className="text-[11px] font-bold text-center border-b border-[#E6E5E1] pb-2">
                          Comments
                        </div>

                        <div className="flex items-start gap-2.5">
                          <div className="h-6 w-6 rounded-full bg-[#F77737] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {active.handle.charAt(1).toUpperCase()}
                          </div>
                          <div className="text-[11px] leading-snug">
                            <span className="font-bold mr-1">{active.handle}</span>
                            {active.comment}
                          </div>
                        </div>

                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.45, duration: 0.3 }}
                          className="ml-8 rounded-xl bg-[#FCE8EC] border border-[#E1306C]/20 px-3 py-2 text-[11px]"
                        >
                          <span className="font-bold text-[#E1306C] mr-1">
                            @yourbrand
                          </span>
                          {active.reply}
                        </motion.div>

                        <button
                          type="button"
                          onClick={() => setStage("dm_delivered")}
                          className="w-full rounded-full bg-[#F7F1EC] py-1.5 text-[10px] font-semibold text-[#6E655F] hover:text-[#161413] cursor-pointer"
                        >
                          Tap to jump to DM →
                        </button>
                      </motion.div>
                    </motion.div>
                  ) : (
                    /* STAGE 2: Authentic Instagram DM Thread */
                    <motion.div
                      key={`dm-${selectedIdx}-${runId}`}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1 bg-white flex flex-col pt-10"
                    >
                      {/* Authentic IG DM Header */}
                      <div className="px-4 py-2.5 border-b border-[#E6E5E1] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setStage("reel_comment")}
                            aria-label="Back to Reel"
                            className="text-[#161413] hover:text-[#E1306C] cursor-pointer"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <div className="h-7 w-7 rounded-full bg-[#E1306C] text-white flex items-center justify-center text-[11px] font-bold">
                            Y
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#161413] flex items-center gap-1">
                              yourbrand
                              <ShieldCheck className="h-3 w-3 text-[#3897F0]" />
                            </div>
                            <div className="text-[9px] text-[#0D7A5F] font-medium">
                              Active now
                            </div>
                          </div>
                        </div>
                        <span className="font-mono-num text-[9px] text-[#6E655F] bg-[#F7F1EC] px-2 py-0.5 rounded-full">
                          AUTO DM
                        </span>
                      </div>

                      {/* DM Messages Area */}
                      <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-[#FAF9F6]">
                        <div className="text-center text-[9px] text-[#8C8A84]">
                          Today · Replyza Automated Flow
                        </div>

                        {stage === "dm_typing" ? (
                          <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-[#EFEFEF] px-3.5 py-2.5">
                            {[0, 1, 2].map((dot) => (
                              <motion.span
                                key={dot}
                                animate={{ y: [0, -3, 0] }}
                                transition={{
                                  duration: 0.5,
                                  repeat: Infinity,
                                  delay: dot * 0.12,
                                }}
                                className="h-1.5 w-1.5 rounded-full bg-[#6E655F]"
                              />
                            ))}
                          </div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-2.5"
                          >
                            {/* Incoming Grey IG Bubble */}
                            <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-[#EFEFEF] px-3.5 py-2.5 text-[11px] text-[#161413] leading-relaxed">
                              {active.dmGreeting}
                            </div>

                            {/* Rich Instagram Product Carousel Card */}
                            <div className="max-w-[92%] rounded-2xl border border-[#E6E5E1] bg-white overflow-hidden shadow-xs">
                              <div
                                className={`h-24 bg-gradient-to-br ${active.product.swatch} flex items-center justify-center relative`}
                              >
                                <ShoppingBag className="h-8 w-8 text-[#161413]/75" />
                                <span className="absolute top-2 right-2 font-mono-num rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold text-[#E1306C]">
                                  {active.product.code}
                                </span>
                              </div>
                              <div className="p-3 space-y-2">
                                <div>
                                  <div className="font-mono-num text-[9px] font-semibold text-[#6E655F]">
                                    {active.product.brand}
                                  </div>
                                  <div className="text-xs font-bold text-[#161413] leading-snug">
                                    {active.product.title}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="font-mono-num text-xs font-bold text-[#161413]">
                                      {active.product.price}
                                    </span>
                                    <span className="font-mono-num text-[10px] text-[#8C8A84] line-through">
                                      {active.product.oldPrice}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => triggerReplay()}
                                  className="w-full rounded-xl bg-[#161413] hover:bg-[#E1306C] text-white py-2 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                                >
                                  Shop Now
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] font-medium text-[#0D7A5F] pl-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Affiliate URL &amp; UTM preserved</span>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Bottom IG Input Mock */}
                      <div className="px-3.5 py-2.5 border-t border-[#E6E5E1] bg-white flex items-center justify-between text-[10px] text-[#8C8A84]">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-[#E1306C]" />
                          Message...
                        </span>
                        <span className="font-mono-num text-[9px] text-[#0D7A5F]">
                          0.2s
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Curved / Angled Marquee Ribbon (pauses smoothly on hover) */}
      <div className="marquee-wrapper mt-12 sm:mt-14 -mx-6 rotate-[-1.75deg] bg-[#E1306C] py-3.5 sm:py-4 border-y-2 border-[#161413] select-none overflow-hidden">
        <div className="animate-marquee font-editorial text-xl sm:text-2xl uppercase tracking-wide text-white/95 hover:text-white whitespace-nowrap">
          <span>{MARQUEE_TEXT}</span>
          <span>{MARQUEE_TEXT}</span>
          <span>{MARQUEE_TEXT}</span>
          <span>{MARQUEE_TEXT}</span>
        </div>
      </div>
    </section>
  );
}
