"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function LandingNavbar() {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const magX = useMotionValue(0);
  const magY = useMotionValue(0);
  const smoothX = useSpring(magX, { stiffness: 320, damping: 20 });
  const smoothY = useSpring(magY, { stiffness: 320, damping: 20 });

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-6 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Floating White Pill Links (Desktop & Tablet) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-sm border border-[#161413]/10 px-2 py-1.5 shadow-2xs shrink-0"
        >
          <a
            href="#features"
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#161413] hover:bg-[#F7F1EC] transition-colors whitespace-nowrap"
          >
            Features
          </a>
          <a
            href="#workflow"
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#161413] hover:bg-[#F7F1EC] transition-colors whitespace-nowrap"
          >
            How it Works
          </a>
          <a
            href="#faq"
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#161413] hover:bg-[#F7F1EC] transition-colors whitespace-nowrap"
          >
            FAQ
          </a>
        </nav>

        {/* Mobile Hamburger + Wordmark */}
        <div className="flex items-center gap-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="h-9 w-9 rounded-full bg-white/95 border border-[#161413]/10 flex items-center justify-center text-[#161413] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Link
            href="/"
            className="font-editorial text-2xl tracking-tight text-[#E1306C] uppercase select-none whitespace-nowrap"
          >
            Replyza Buzz
          </Link>
        </div>

        {/* Center Wordmark (Desktop & Tablet) */}
        <Link
          href="/"
          className="hidden md:block font-editorial text-2xl lg:text-3xl tracking-tight text-[#E1306C] uppercase select-none whitespace-nowrap"
        >
          Replyza Buzz
        </Link>

        {/* Right: Live Status Pill (lg+ only) + CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-sm border border-[#161413]/10 px-3.5 py-2 text-[11px] font-mono-num font-medium text-[#161413] whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-[#0D7A5F]" />
            <span>Meta Graph API Verified</span>
          </div>

          {!isLoading && isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-full bg-[#161413] pl-3.5 pr-1.5 py-1.5 text-xs font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors whitespace-nowrap"
            >
              <span>Dashboard</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden md:inline-flex rounded-full bg-white/95 border border-[#161413]/10 px-4 py-2 text-xs font-semibold text-[#161413] hover:bg-[#EDE4DD] transition-colors whitespace-nowrap"
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
                  className="group inline-flex items-center gap-2 rounded-full bg-[#161413] pl-3.5 sm:pl-4 pr-1.5 py-1.5 text-xs font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors whitespace-nowrap"
                >
                  <span>Start Free</span>
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden mt-2.5 rounded-2xl bg-white border border-[#161413]/12 p-4 shadow-lg space-y-3"
          >
            <div className="flex flex-col space-y-1">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[#161413] hover:bg-[#F7F1EC]"
              >
                Features
              </a>
              <a
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[#161413] hover:bg-[#F7F1EC]"
              >
                How it Works
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[#161413] hover:bg-[#F7F1EC]"
              >
                FAQ
              </a>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[#161413] hover:bg-[#F7F1EC]"
              >
                Sign in
              </Link>
            </div>
            <div className="pt-2 border-t border-[#E6E5E1] flex items-center gap-2 text-[11px] font-mono-num text-[#0D7A5F]">
              <span className="h-2 w-2 rounded-full bg-[#0D7A5F]" />
              <span>Meta Graph API Verified</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
