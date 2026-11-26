"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const MANIFESTO_WORDS = [
  { text: "Creators", accent: false },
  { text: "shouldn't", accent: false },
  { text: "spend", accent: false },
  { text: "midnight", accent: false },
  { text: "copy-pasting", accent: true },
  { text: "affiliate", accent: true },
  { text: "links", accent: true },
  { text: "into", accent: false },
  { text: "hundreds", accent: false },
  { text: "of", accent: false },
  { text: "DM", accent: false },
  { text: "requests.", accent: false },
  { text: "Replyza", accent: true },
  { text: "Buzz", accent: true },
  { text: "turns", accent: false },
  { text: "every", accent: false },
  { text: "comment", accent: false },
  { text: "into", accent: false },
  { text: "a", accent: false },
  { text: "tracked", accent: false },
  { text: "product", accent: false },
  { text: "delivery—fast,", accent: false },
  { text: "compliant,", accent: false },
  { text: "and", accent: false },
  { text: "zero", accent: true },
  { text: "bot", accent: true },
  { text: "vibes.", accent: true },
];

function IlluminatedWord({
  word,
  accent,
  progress,
  range,
}: {
  word: string;
  accent: boolean;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.45, 1]);

  return (
    <motion.span
      style={{ opacity }}
      className={`inline-block mr-[0.26em] ${
        accent ? "text-[#E1306C]" : "text-[#161413]"
      }`}
    >
      {word}
    </motion.span>
  );
}

export function LandingManifesto() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.85", "end 0.5"],
  });

  return (
    <section
      ref={containerRef}
      className="bg-[#F7F1EC] py-14 md:py-24 px-4 sm:px-8"
    >
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <p className="font-mono-num text-xs font-semibold uppercase tracking-[0.2em] text-[#E1306C]">
          WHY REPLYZA BUZZ
        </p>

        <h2 className="font-display text-2xl min-[390px]:text-3xl md:text-5xl font-bold leading-[1.15] tracking-tight">
          {MANIFESTO_WORDS.map((item, i) => {
            const start = i / MANIFESTO_WORDS.length;
            const end = start + 1 / MANIFESTO_WORDS.length;
            return (
              <IlluminatedWord
                key={`${item.text}-${i}`}
                word={item.text}
                accent={item.accent}
                progress={scrollYProgress}
                range={[start, end]}
              />
            );
          })}
        </h2>
      </div>
    </section>
  );
}
