"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "How does Replyza Buzz connect to my Instagram account?",
    a: "We use official Meta OAuth (Facebook Login for Business). Your access token is encrypted with AES-256-GCM and you can inspect webhook subscription health or disconnect at any time.",
  },
  {
    q: "Can I send multiple product links from a single comment?",
    a: "Yes. Attach up to 10 products per automation from your Affiliate Product Library or paste links in bulk. Choose between a single formatted DM, sequential DMs, Quick Reply selection, or Meta Generic Cards.",
  },
  {
    q: "Do you modify or shorten my affiliate tracking URLs?",
    a: "Never. Your exact affiliate URL—including ?tag=, ref=, and UTM query parameters—is validated and delivered verbatim.",
  },
  {
    q: "How does Follow-Gate verification work under Meta's rules?",
    a: "Replyza sends an interactive Quick Reply button first. When tapped inside the 24-hour messaging window, we query Meta's User Profile API where supported. If Meta restricts follow status for a user, Replyza handles it transparently.",
  },
  {
    q: "Will a comment ever receive duplicate DMs?",
    a: "No. Every incoming comment webhook is deduplicated in Redis and PostgreSQL with execution-level leases, ensuring at most one public reply and one private reply per comment.",
  },
];

export function LandingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-[#F7F1EC] py-14 md:py-24 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Sticky Column */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div className="space-y-2">
            <p className="font-mono-num text-xs font-semibold uppercase tracking-[0.2em] text-[#E1306C]">
              FAQ
            </p>
            <h2 className="font-editorial text-4xl sm:text-6xl uppercase text-[#161413]">
              THINGS YOU MIGHT ASK
            </h2>
          </div>

          {/* Playful Flat-Line Editorial Mascot / Notification Bell */}
          <div className="flex sm:inline-flex items-center gap-3.5 rounded-3xl bg-[#EDE4DD] border border-[#161413]/10 p-4 sm:p-5 max-w-full">
            <svg
              viewBox="0 0 80 80"
              fill="none"
              className="h-12 w-12 sm:h-16 sm:w-16 shrink-0"
              aria-hidden="true"
            >
              <circle cx="40" cy="40" r="36" fill="#FCE8EC" stroke="#161413" strokeWidth="2.5" />
              <path
                d="M22 30 L28 16 L36 25 M58 30 L52 16 L44 25"
                stroke="#161413"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="32" cy="39" r="3" fill="#161413" />
              <circle cx="48" cy="39" r="3" fill="#161413" />
              <path
                d="M35 48 Q40 53 45 48"
                stroke="#E1306C"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="59" cy="21" r="8" fill="#E1306C" stroke="#161413" strokeWidth="2" />
              <text
                x="59"
                y="24.5"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="10"
                fontWeight="700"
              >
                1
              </text>
            </svg>
            <div className="text-xs text-[#6E655F] leading-relaxed">
              <strong className="text-[#161413] block mb-0.5">
                Built on official Meta APIs
              </strong>
              Zero password sharing, zero browser scraping, and full webhook logs.
            </div>
          </div>
        </div>

        {/* Right Accordion Pills */}
        <div className="lg:col-span-7 space-y-3">
          {FAQS.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={item.q}
                className="rounded-2xl bg-[#EDE4DD] border border-[#161413]/8 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left cursor-pointer"
                >
                  <span className="font-display text-base sm:text-lg font-bold text-[#161413]">
                    {item.q}
                  </span>
                  <span
                    className={`h-7 w-7 rounded-full bg-white border border-[#161413]/10 flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-45 bg-[#E1306C] text-white border-[#E1306C]" : "text-[#161413]"
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-5 text-xs sm:text-sm text-[#6E655F] leading-relaxed">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
