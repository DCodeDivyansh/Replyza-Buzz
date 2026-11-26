"use client";

import React, { useRef, useState } from "react";
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
  Camera,
  CheckCircle2,
  ExternalLink,
  Heart,
  Mic,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const HERO_DEMOS = [
  {
    keyword: "SEND LINK",
    dmGreeting:
      "Hey! Thanks for commenting on my Reel 💛 Here is the Vitamin C serum & my code:",
    product: {
      brand: "GLOWLAB",
      title: "Vitamin C 10% Brightening Serum",
      price: "₹699",
      oldPrice: "₹999",
      code: "SHREYA20",
      image: "/images/product-serum.jpg",
    },
  },
  {
    keyword: "OUTFIT",
    dmGreeting:
      "Heyy! Here is the exact linen co-ord set from today's Reel + my discount code ✨",
    product: {
      brand: "ZARA EDIT",
      title: "Structured Linen Co-ord Set",
      price: "₹2,499",
      oldPrice: "₹3,299",
      code: "OUTFIT15",
      image: "/images/product-outfit.jpg",
    },
  },
  {
    keyword: "GUIDE",
    dmGreeting:
      "Here is my 2026 Reels Growth Playbook! Tap below for instant access 👇",
    product: {
      brand: "CREATOR KIT",
      title: "2026 Reels Growth Playbook",
      price: "Free PDF",
      oldPrice: null,
      code: "INSTANT",
      image: "/images/product-guide.jpg",
    },
  },
];

const MARQUEE_TEXT =
  "COMMENT TO DM • INSTANT PRODUCT DELIVERY • AUTO-FOLLOW CHECK • ZERO BOT VIBES • ";

export function LandingHero() {
  const { isAuthenticated } = useAuth();
  const [selectedIdx, setSelectedIdx] = useState(0);
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
    <section className="relative bg-[#FCE8EC] pt-4 sm:pt-8 pb-28 md:pb-36 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
          {/* Left Editorial Headline */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full bg-white/95 border border-[#161413]/10 px-3.5 py-1.5 text-[11px] font-mono-num font-medium text-[#161413]"
            >
              <span className="h-2 w-2 rounded-full bg-[#E1306C]" />
              <span>INSTAGRAM CREATOR COMMERCE</span>
            </motion.div>

            <h1 className="font-editorial text-[2.25rem] min-[390px]:text-[2.75rem] sm:text-6xl lg:text-[4.25rem] leading-[0.96] uppercase text-[#161413] break-words">
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
              className="font-display text-sm sm:text-base lg:text-lg text-[#6E655F] max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Automatically reply to Reel &amp; post comments, verify followers where Meta permits, and deliver multi-product affiliate cards straight into Instagram DMs.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col min-[420px]:flex-row items-center justify-center lg:justify-start gap-3 pt-1 w-full sm:w-auto"
            >
              <motion.div
                className="w-full min-[420px]:w-auto"
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
                  className="group w-full min-[420px]:w-auto inline-flex items-center justify-center gap-3 rounded-full bg-[#161413] pl-6 pr-2 py-2.5 text-sm font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
                >
                  <span>{isAuthenticated ? "Open Dashboard" : "Start Automating Free"}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </motion.div>

              <a
                href="#features"
                className="w-full min-[420px]:w-auto inline-flex items-center justify-center rounded-full bg-white border border-[#161413]/15 px-5 py-3 text-sm font-semibold text-[#161413] hover:bg-[#EDE4DD] transition-colors"
              >
                Explore Features
              </a>
            </motion.div>
          </div>

          {/* Right: Clean Authentic iPhone 16 Pro Instagram DM Mockup */}
          <div className="lg:col-span-6 flex flex-col items-center gap-4">
            {/* Interactive Scenario Pills */}
            <div className="inline-flex items-center gap-1 rounded-full bg-white/95 border border-[#161413]/10 p-1 shadow-2xs">
              {HERO_DEMOS.map((demo, idx) => {
                const isActive = idx === selectedIdx;
                return (
                  <button
                    key={demo.keyword}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`relative rounded-full px-3 sm:px-3.5 py-1.5 font-mono-num text-[11px] font-semibold transition-colors cursor-pointer ${
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

            {/* iPhone 16 Pro Hardware Shell */}
            <div
              ref={phoneRef}
              onMouseMove={handlePhoneMouseMove}
              onMouseLeave={handlePhoneMouseLeave}
              style={{ perspective: 1000 }}
              className="relative w-full max-w-[310px] sm:max-w-[340px] mx-auto"
            >
              {/* Hardware Side Buttons */}
              <span
                aria-hidden="true"
                className="hidden sm:block absolute -left-[3px] top-28 h-8 w-[3px] rounded-l bg-[#2D2A28]"
              />
              <span
                aria-hidden="true"
                className="hidden sm:block absolute -left-[3px] top-40 h-11 w-[3px] rounded-l bg-[#2D2A28]"
              />
              <span
                aria-hidden="true"
                className="hidden sm:block absolute -right-[3px] top-36 h-14 w-[3px] rounded-r bg-[#2D2A28]"
              />

              <motion.div
                style={{ rotateX, rotateY }}
                className="relative rounded-[44px] border-[10px] border-[#161413] bg-[#161413] ring-1 ring-white/15 shadow-[0_32px_64px_-16px_rgba(22,20,19,0.22)] overflow-hidden"
              >
                {/* Dynamic Island */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 h-[22px] w-[88px] rounded-full bg-[#161413] flex items-center justify-end pr-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2B2927] ring-1 ring-white/10" />
                </div>

                {/* Screen Content: Clean Instagram DM Header Right Below Dynamic Island */}
                <div className="rounded-[34px] bg-white overflow-hidden flex flex-col pt-10">
                  {/* Authentic IG DM Header */}
                  <div className="px-3.5 py-2.5 border-b border-[#E6E5E1] flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2.5">
                      <ArrowLeft className="h-4 w-4 text-[#161413]" />
                      <div className="p-[2px] bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] rounded-full shrink-0">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-white p-[1.5px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/images/shreya-avatar.jpg"
                            alt="shre_yadayal profile avatar"
                            className="h-full w-full rounded-full object-cover"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#161413] flex items-center gap-1 leading-none">
                          shre_yadayal
                          <ShieldCheck className="h-3.5 w-3.5 text-[#3897F0]" />
                        </div>
                        <div className="text-[10px] text-[#0D7A5F] font-medium mt-0.5">
                          Active now
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-num text-[9px] text-[#6E655F] bg-[#F2F2F7] px-2 py-0.5 rounded-full">
                      AUTO DM
                    </span>
                  </div>

                  {/* DM Thread Body with Smooth AnimatePresence */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedIdx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="p-3.5 space-y-2.5 bg-[#FAF9F6]"
                    >
                      <div className="max-w-[92%] rounded-2xl rounded-bl-xs bg-[#F2F2F7] px-3 py-2 text-[11px] text-[#161413] leading-snug">
                        {active.dmGreeting}
                      </div>

                      {/* Real Photo Product Card */}
                      <div className="rounded-2xl border border-black/8 bg-white overflow-hidden shadow-2xs">
                        <div className="relative w-full h-36 bg-[#F3F2EE] overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={active.product.image}
                            alt={active.product.title}
                            className="w-full h-36 object-cover"
                          />
                          <span className="absolute top-2.5 right-2.5 font-mono-num rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-[#E1306C] shadow-2xs">
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
                              {active.product.oldPrice && (
                                <span className="font-mono-num text-[10px] text-[#8C8A84] line-through">
                                  {active.product.oldPrice}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedIdx((prev) => (prev + 1) % HERO_DEMOS.length)
                            }
                            className="w-full rounded-xl bg-[#161413] hover:bg-[#E1306C] text-white py-2 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            Shop Now
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-medium text-[#0D7A5F] pl-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Affiliate tracking URL preserved</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Authentic IG Composer Bar + Home Indicator Clearance */}
                  <div className="px-3.5 pb-4 pt-2 bg-white border-t border-[#E6E5E1]">
                    <div className="rounded-full bg-[#F2F2F7] px-3 py-1.5 flex items-center justify-between text-[#6E655F]">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="h-5 w-5 rounded-full bg-[#E1306C] text-white flex items-center justify-center">
                          <Camera className="h-3 w-3" />
                        </span>
                        <span>Message...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mic className="h-3.5 w-3.5" />
                        <Heart className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="mt-2.5 mx-auto w-24 h-1 rounded-full bg-[#161413]/20" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Angled Marquee Ribbon */}
      <div className="marquee-wrapper mt-16 sm:mt-20 -mx-6 rotate-[-1.5deg] bg-[#E1306C] py-3.5 sm:py-4 border-y-2 border-[#161413] select-none overflow-hidden">
        <div className="animate-marquee font-editorial text-lg sm:text-2xl uppercase tracking-wide text-white/95 hover:text-white whitespace-nowrap">
          <span>{MARQUEE_TEXT}</span>
          <span>{MARQUEE_TEXT}</span>
          <span>{MARQUEE_TEXT}</span>
          <span>{MARQUEE_TEXT}</span>
        </div>
      </div>
    </section>
  );
}
