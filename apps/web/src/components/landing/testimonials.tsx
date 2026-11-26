"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "My skincare haul Reel hit 180k views overnight. Replyza Buzz delivered all 4 affiliate links to 1,400+ commenters without a single duplicate DM.",
    name: "Maya Kapoor",
    handle: "@maya.creates",
    role: "Beauty & Skincare Creator · 145K",
    metric: "1,420 DMs sent",
  },
  {
    quote:
      "Having an Affiliate Product Library saves me 20 minutes on every post. I just pick my saved gear, keep my exact Amazon tracking tags, and hit Activate.",
    name: "Arjun Mehta",
    handle: "@arjun_dev",
    role: "Desk Setup & Tech · 88K",
    metric: "3.4x link CTR",
  },
  {
    quote:
      "The Follow-Gate quick reply feels natural in DMs and never pretends someone followed when Meta can't verify it. Super clean and reliable.",
    name: "Sara Lin",
    handle: "@sara.styles",
    role: "Fashion & LTK Creator · 210K",
    metric: "0 duplicate sends",
  },
];

export function LandingTestimonials() {
  const [index, setIndex] = useState(0);
  const [deckHovered, setDeckHovered] = useState(false);

  const next = () => setIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  const prev = () =>
    setIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

  const current = TESTIMONIALS[index];

  return (
    <section className="bg-[#E1306C] py-20 sm:py-28 px-4 sm:px-8 overflow-hidden">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <p className="font-mono-num text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            CREATOR STORIES
          </p>
          <h2 className="font-editorial text-5xl sm:text-6xl lg:text-7xl uppercase text-white">
            CREATORS LOVE IT
          </h2>
        </div>

        {/* Stacked Deck */}
        <div
          onMouseEnter={() => setDeckHovered(true)}
          onMouseLeave={() => setDeckHovered(false)}
          className="relative max-w-2xl mx-auto pt-4 pb-6"
        >
          {/* Background peeking cards */}
          <motion.div
            aria-hidden="true"
            animate={deckHovered ? { rotate: -3.5, x: -6 } : { rotate: -2, x: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="absolute inset-x-4 top-6 bottom-4 rounded-3xl bg-[#F7F1EC]/65 border border-[#161413]/10"
          />
          <motion.div
            aria-hidden="true"
            animate={deckHovered ? { rotate: 3, x: 6 } : { rotate: 1.5, x: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="absolute inset-x-2 top-5 bottom-5 rounded-3xl bg-[#F7F1EC]/85 border border-[#161413]/10"
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50) next();
                if (info.offset.x > 50) prev();
              }}
              onClick={next}
              className="relative rounded-3xl bg-[#F7F1EC] border border-[#161413]/15 p-7 sm:p-10 shadow-[0_20px_50px_rgba(22,20,19,0.16)] cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center justify-between mb-6">
                <Quote className="h-7 w-7 text-[#E1306C]" />
                <span className="font-mono-num rounded-full bg-[#FCE8EC] text-[#E1306C] px-3 py-1 text-[11px] font-semibold">
                  {current.metric}
                </span>
              </div>

              <p className="font-display text-lg sm:text-2xl font-semibold text-[#161413] leading-snug">
                &ldquo;{current.quote}&rdquo;
              </p>

              <div className="mt-8 pt-5 border-t border-[#161413]/10 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-[#161413]">
                    {current.name}
                  </div>
                  <div className="text-xs text-[#6E655F]">
                    {current.handle} · {current.role}
                  </div>
                </div>
                <span className="font-mono-num text-[11px] text-[#6E655F]">
                  {index + 1} / {TESTIMONIALS.length}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Deck Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous testimonial"
            className="h-10 w-10 rounded-full bg-[#161413] text-white flex items-center justify-center hover:bg-[#2A2624] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {TESTIMONIALS.map((t, i) => (
              <button
                key={t.handle}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show testimonial ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/45"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="Next testimonial"
            className="h-10 w-10 rounded-full bg-[#161413] text-white flex items-center justify-center hover:bg-[#2A2624] transition-colors cursor-pointer"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
