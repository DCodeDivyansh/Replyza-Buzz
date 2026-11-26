"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function LandingFooter() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="bg-[#E1306C] text-white pt-16 sm:pt-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          {/* Top-Left Conversational Headline + CTA */}
          <div className="space-y-5 max-w-lg">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.08]">
              Okay, that&apos;s enough scrolling
            </h2>
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className="group inline-flex items-center gap-3 rounded-full bg-[#161413] pl-6 pr-2 py-2 text-sm font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
            >
              <span>{isAuthenticated ? "Go to Dashboard" : "Get Started"}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F77737] text-white transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          </div>

          {/* Navigation & Legal Links */}
          <div className="grid grid-cols-2 gap-8 sm:gap-14 text-xs sm:text-sm">
            <div className="space-y-2.5">
              <p className="font-mono-num text-[11px] uppercase tracking-wider text-white/70">
                Product
              </p>
              <ul className="space-y-2 font-medium">
                <li>
                  <a href="#features" className="hover:underline">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#workflow" className="hover:underline">
                    How it Works
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:underline">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:underline">
                    Create Account
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-mono-num text-[11px] uppercase tracking-wider text-white/70">
                Legal
              </p>
              <ul className="space-y-2 font-medium">
                <li>
                  <Link href="/privacy" className="hover:underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:underline">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/data-deletion" className="hover:underline">
                    Data Deletion
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Edge-to-Edge Monumental Wordmark */}
      <div className="mt-12 sm:mt-16 w-full overflow-hidden select-none leading-none">
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="font-editorial text-[24vw] sm:text-[22vw] uppercase text-[#161413]/95 text-center leading-[0.82] tracking-tight translate-y-[6%] cursor-default"
        >
          REPLYZA
        </motion.div>
      </div>
    </footer>
  );
}
