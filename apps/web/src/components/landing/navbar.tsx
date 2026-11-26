"use client";

import React from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function LandingNavbar() {
  const { isAuthenticated, isLoading } = useAuth();
  const magX = useMotionValue(0);
  const magY = useMotionValue(0);
  const smoothX = useSpring(magX, { stiffness: 320, damping: 20 });
  const smoothY = useSpring(magY, { stiffness: 320, damping: 20 });

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-4 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Floating White Pill Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-sm border border-[#161413]/10 px-2 py-1.5 shadow-2xs pointer-events-auto"
        >
          <a
            href="#features"
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#161413] hover:bg-[#F7F1EC] transition-colors"
          >
            Features
          </a>
          <a
            href="#workflow"
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#161413] hover:bg-[#F7F1EC] transition-colors"
          >
            How it Works
          </a>
          <a
            href="#faq"
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#161413] hover:bg-[#F7F1EC] transition-colors"
          >
            FAQ
          </a>
        </nav>

        {/* Center: Replyza Buzz Wordmark */}
        <Link
          href="/"
          className="pointer-events-auto font-editorial text-2xl sm:text-3xl tracking-tight text-[#E1306C] uppercase select-none"
        >
          Replyza Buzz
        </Link>

        {/* Right: Live Status Pill + Magnetic Charcoal CTA */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="hidden lg:inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-sm border border-[#161413]/10 px-3.5 py-2 text-[11px] font-mono-num font-medium text-[#161413]">
            <span className="h-2 w-2 rounded-full bg-[#0D7A5F]" />
            <span>Meta Graph API Verified</span>
          </div>

          {!isLoading && isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2.5 rounded-full bg-[#161413] pl-4 pr-1.5 py-1.5 text-xs font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
            >
              <span>Dashboard</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden sm:inline-flex rounded-full bg-white/95 border border-[#161413]/10 px-4 py-2 text-xs font-semibold text-[#161413] hover:bg-[#EDE4DD] transition-colors"
              >
                Sign in
              </Link>
              <motion.div
                style={{ x: smoothX, y: smoothY }}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  magX.set(((e.clientX - r.left) / r.width - 0.5) * 8);
                  magY.set(((e.clientY - r.top) / r.height - 0.5) * 8);
                }}
                onMouseLeave={() => {
                  magX.set(0);
                  magY.set(0);
                }}
              >
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#161413] pl-4 pr-1.5 py-1.5 text-xs font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
                >
                  <span>Start Free</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
