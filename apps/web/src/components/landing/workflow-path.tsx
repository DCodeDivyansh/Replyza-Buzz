"use client";

import React, { useRef } from "react";
import { motion, useScroll } from "motion/react";

const MILESTONES = [
  {
    num: "01",
    line1: "POST & REEL",
    line2: "TRIGGERS",
    badge: "Detect keywords in comments or story replies in under 1 second.",
    align: "left" as const,
    initialRotate: -3,
    pillBg: "bg-white text-[#161413] border-[#161413]/15",
  },
  {
    num: "02",
    line1: "SMART",
    line2: "FOLLOW GATE",
    badge: "Verify followers automatically before unlocking your freebie or link.",
    align: "right" as const,
    initialRotate: 3,
    pillBg: "bg-[#FCE8EC] text-[#161413] border-[#E1306C]/30",
  },
  {
    num: "03",
    line1: "INSTANT",
    line2: "DM CHECKOUT",
    badge: "Deliver guides, links, and products directly inside Instagram DMs.",
    align: "left" as const,
    initialRotate: -2,
    pillBg: "bg-white text-[#161413] border-[#161413]/15",
  },
];

export function WorkflowPath() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.75", "end 0.65"],
  });

  return (
    <section
      id="workflow"
      ref={sectionRef}
      className="relative bg-[#F7F1EC] py-14 md:py-24 px-4 sm:px-8 overflow-x-clip"
    >
      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: "some" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center space-y-2 mb-12 md:mb-24"
        >
          <p className="font-mono-num text-xs font-semibold uppercase tracking-[0.2em] text-[#E1306C]">
            AUTOMATION ENGINE
          </p>
          <h2 className="font-editorial text-4xl sm:text-6xl lg:text-7xl uppercase text-[#161413]">
            HOW IT WORKS
          </h2>
        </motion.div>

        {/* Mobile Vertical Timeline (< 768px) */}
        <div className="md:hidden relative pl-7 space-y-8">
          <div
            aria-hidden="true"
            className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-[#E1306C]"
          />
          {MILESTONES.map((m) => (
            <motion.div
              key={`mob-${m.num}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: "some" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl border border-[#161413]/10 bg-white p-5 space-y-3"
            >
              <span className="absolute -left-[27px] top-5 h-5 w-5 rounded-full bg-[#E1306C] text-white font-mono-num text-[10px] font-bold flex items-center justify-center ring-4 ring-[#F7F1EC]">
                {m.num}
              </span>
              <h3 className="font-editorial text-3xl uppercase text-[#161413]">
                {m.line1} <span className="text-[#E1306C]">{m.line2}</span>
              </h3>
              <p className="rounded-xl bg-[#F7F1EC] border border-[#161413]/8 px-3.5 py-2.5 text-xs font-medium text-[#161413] rotate-0">
                {m.badge}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Desktop Continuous Winding SVG Path (>= 768px) */}
        <svg
          viewBox="0 0 800 760"
          fill="none"
          aria-hidden="true"
          className="hidden md:block absolute left-1/2 -translate-x-1/2 top-28 w-[760px] h-[720px] pointer-events-none"
        >
          <path
            d="M 160 30 C 480 30, 680 180, 620 320 C 560 460, 140 420, 180 580 C 210 700, 520 710, 640 720"
            stroke="#EDE4DD"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <motion.path
            d="M 160 30 C 480 30, 680 180, 620 320 C 560 460, 140 420, 180 580 C 210 700, 520 710, 640 720"
            stroke="#E1306C"
            strokeWidth="6"
            strokeLinecap="round"
            style={{ pathLength: scrollYProgress }}
          />
        </svg>

        {/* Desktop Staggered Milestones (>= 768px) */}
        <div className="hidden md:block relative z-10 space-y-28">
          {MILESTONES.map((m) => (
            <motion.div
              key={m.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: "some" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className={`flex flex-col ${
                m.align === "right" ? "items-end text-right" : "items-start text-left"
              }`}
            >
              <div className="max-w-md space-y-4">
                <div className="inline-flex items-center gap-2 font-mono-num text-xs font-bold text-[#E1306C]">
                  <span className="h-6 w-6 rounded-full bg-[#E1306C] text-white flex items-center justify-center text-[11px]">
                    {m.num}
                  </span>
                  <span>STEP {m.num}</span>
                </div>

                <h3 className="font-editorial text-5xl lg:text-6xl uppercase text-[#161413]">
                  <span className="block">{m.line1}</span>
                  <span className="block text-[#E1306C]">{m.line2}</span>
                </h3>

                <motion.div
                  initial={{ rotate: m.initialRotate, scale: 0.96 }}
                  whileInView={{ rotate: m.initialRotate, scale: 1 }}
                  whileHover={{ rotate: 0, scale: 1.02 }}
                  viewport={{ once: true, amount: "some" }}
                  transition={{ type: "spring", stiffness: 280, damping: 20 }}
                  className={`inline-block rounded-2xl border px-4 py-3 text-sm font-medium shadow-xs ${m.pillBg}`}
                >
                  {m.badge}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
