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
      className="relative bg-[#F7F1EC] py-20 sm:py-28 px-4 sm:px-8 overflow-hidden"
    >
      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center space-y-2 mb-16 sm:mb-24"
        >
          <p className="font-mono-num text-xs font-semibold uppercase tracking-[0.2em] text-[#E1306C]">
            AUTOMATION ENGINE
          </p>
          <h2 className="font-editorial text-5xl sm:text-6xl lg:text-7xl uppercase text-[#161413]">
            HOW IT WORKS
          </h2>
        </motion.div>

        {/* Continuous Winding SVG Path (Desktop) */}
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

        {/* Staggered Milestones */}
        <div className="relative z-10 space-y-16 sm:space-y-28">
          {MILESTONES.map((m) => (
            <motion.div
              key={m.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className={`flex flex-col ${
                m.align === "right" ? "md:items-end md:text-right" : "md:items-start md:text-left"
              }`}
            >
              <div className="max-w-md space-y-4">
                <div className="inline-flex items-center gap-2 font-mono-num text-xs font-bold text-[#E1306C]">
                  <span className="h-6 w-6 rounded-full bg-[#E1306C] text-white flex items-center justify-center text-[11px]">
                    {m.num}
                  </span>
                  <span>STEP {m.num}</span>
                </div>

                <h3 className="font-editorial text-4xl sm:text-5xl lg:text-6xl uppercase text-[#161413]">
                  <span className="block">{m.line1}</span>
                  <span className="block text-[#E1306C]">{m.line2}</span>
                </h3>

                <motion.div
                  initial={{ rotate: m.initialRotate, scale: 0.96 }}
                  whileInView={{ rotate: m.initialRotate, scale: 1 }}
                  whileHover={{ rotate: 0, scale: 1.02 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ type: "spring", stiffness: 280, damping: 20 }}
                  className={`inline-block rounded-2xl border px-4 py-3 text-xs sm:text-sm font-medium shadow-xs ${m.pillBg}`}
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
