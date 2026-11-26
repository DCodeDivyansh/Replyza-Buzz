"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  ShoppingBag,
  UserCheck,
  Zap,
} from "lucide-react";

function CardOneStage({ hovered }: { hovered: boolean }) {
  const comments = [
    { user: "@nina", initial: "N", avatarBg: "bg-[#E1306C]", text: "LINK pls", keyword: "LINK" },
    { user: "@sam", initial: "S", avatarBg: "bg-[#6E655F]", text: "love this!!", keyword: null },
    { user: "@dev", initial: "D", avatarBg: "bg-[#F77737]", text: "send GUIDE", keyword: "GUIDE" },
  ];

  return (
    <div className="w-full space-y-2">
      {comments.map((c, idx) => (
        <motion.div
          key={c.user}
          animate={
            hovered && c.keyword
              ? { x: 4, borderColor: "rgba(225,48,108,0.45)" }
              : { x: 0, borderColor: "rgba(22,20,19,0.08)" }
          }
          transition={{ duration: 0.25, delay: idx * 0.04 }}
          className="w-full flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-xs shadow-2xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-6 w-6 rounded-full ${c.avatarBg} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}
            >
              {c.initial}
            </span>
            <div className="truncate">
              <span className="font-bold text-[#161413] mr-1">{c.user}</span>
              <span className="text-[#6E655F]">{c.text}</span>
            </div>
          </div>
          {c.keyword && (
            <span
              className={`font-mono-num rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors shrink-0 ${
                hovered
                  ? "bg-[#E1306C] text-white"
                  : "bg-[#FCE8EC] text-[#E1306C]"
              }`}
            >
              {c.keyword}
            </span>
          )}
        </motion.div>
      ))}

      <motion.div
        animate={hovered ? { scale: 1.015 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="w-full flex items-center justify-between rounded-xl bg-[#161413] text-white px-3.5 py-2.5 text-[11px] font-mono-num"
      >
        <span className="flex items-center gap-1.5 font-semibold">
          <Zap className={`h-3.5 w-3.5 ${hovered ? "text-[#F77737]" : "text-[#E1306C]"}`} />
          DM Queued
        </span>
        <span className="text-[#0D7A5F] bg-[#ECF7F3] px-2 py-0.5 rounded-full font-bold text-[10px]">
          0.2s
        </span>
      </motion.div>
    </div>
  );
}

function CardTwoStage({ hovered }: { hovered: boolean }) {
  const [clickedVerify, setClickedVerify] = useState(false);
  const verified = hovered || clickedVerify;

  return (
    <div className="w-full rounded-2xl border border-[#161413]/10 bg-white p-4 space-y-3 shadow-2xs">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-full bg-[#E1306C] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
          Y
        </div>
        <div className="text-xs font-medium text-[#161413] leading-snug">
          Follow <span className="font-bold">@yourbrand</span> to unlock your link
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-[#161413]/15 bg-[#FAF9F6] px-3 py-1.5 text-[11px] font-semibold text-[#161413]">
          View Profile
        </span>
        <motion.button
          type="button"
          onClick={() => setClickedVerify((v) => !v)}
          animate={verified ? { scale: 0.97 } : { scale: 1 }}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
            verified
              ? "bg-[#0D7A5F] text-white"
              : "bg-[#E1306C]/10 text-[#E1306C] border border-[#E1306C]/30"
          }`}
        >
          <Check className="h-3 w-3" />
          I&apos;ve followed!
        </motion.button>
      </div>

      <motion.div
        initial={false}
        animate={verified ? { opacity: 1 } : { opacity: 0.55 }}
        className="rounded-xl bg-[#ECF7F3] border border-[#0D7A5F]/20 px-3 py-2 text-[11px] font-mono-num font-semibold text-[#0D7A5F] flex items-center gap-1.5"
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          {verified ? "Verified via Meta API • Link Sent" : "Awaiting Quick Reply tap"}
        </span>
      </motion.div>
    </div>
  );
}

function CardThreeStage({ hovered }: { hovered: boolean }) {
  const miniProducts = [
    { name: "Lip Tint", price: "₹499", tag: "?tag=maya", bg: "bg-[#FCE8EC]" },
    { name: "Glow Serum", price: "₹699", tag: "?tag=maya", bg: "bg-[#EDE4DD]" },
    { name: "Linen Tote", price: "₹899", tag: "?tag=maya", bg: "bg-[#FAF9F6]" },
  ];

  const rotations = hovered ? [-8, 0, 8] : [-3, 0, 3];
  const translatesX = hovered ? [-38, 0, 38] : [-12, 0, 12];

  return (
    <div className="w-full max-w-[260px] mx-auto relative h-44 flex items-center justify-center">
      {miniProducts.map((p, idx) => (
        <motion.div
          key={p.name}
          animate={{
            rotate: rotations[idx],
            x: translatesX[idx],
            y: idx === 1 && hovered ? -8 : 0,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          style={{ zIndex: idx === 1 ? 20 : 10 + idx }}
          className="absolute w-32 rounded-2xl border border-[#E5DDD5] bg-white p-2.5 shadow-sm space-y-2"
        >
          <div className={`h-16 rounded-xl ${p.bg} flex items-center justify-center`}>
            <ShoppingBag className="h-5 w-5 text-[#161413]/75" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#161413] truncate">{p.name}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono-num text-[11px] font-bold text-[#E1306C]">
                {p.price}
              </span>
              <ExternalLink className="h-3 w-3 text-[#6E655F]" />
            </div>
            <div className="font-mono-num text-[9px] text-[#6E655F] truncate mt-0.5">
              {p.tag}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const FEATURE_CARDS = [
  {
    id: "triggers",
    title: "Comment-to-DM Triggers",
    subtitle: "KEYWORD + ANY COMMENT",
    badgeBg: "bg-[#E1306C]",
    cardBg: "bg-[#FCE8EC] border-[#161413]/10",
    icon: MessageSquare,
    items: [
      "Post-specific or all-post triggers",
      "Exact or contains word matching",
      "Rotating public comment replies",
    ],
  },
  {
    id: "follow",
    title: "Follow-Gate Verification",
    subtitle: "COMPLIANT GROWTH",
    badgeBg: "bg-[#F77737]",
    cardBg: "bg-[#EAE2DA] border-[#161413]/10",
    icon: UserCheck,
    items: [
      "Sends \"I've followed!\" quick reply",
      "Verifies via Meta User Profile API",
      "Honest fallback if access is limited",
    ],
  },
  {
    id: "products",
    title: "One-Click Product Delivery",
    subtitle: "UP TO 10 AFFILIATE LINKS",
    badgeBg: "bg-[#161413]",
    cardBg: "bg-[#FFFFFF] border-[#E5DDD5]",
    icon: ShoppingBag,
    items: [
      "Preserves ?tag= & UTM parameters",
      "Bulk paste Name | URL lists",
      "Single DM, sequential, or cards",
    ],
  },
];

export function FeatureShowcase() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section id="features" className="bg-[#F7F1EC] py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-14">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: "some" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center space-y-2"
        >
          <p className="font-mono-num text-xs font-semibold uppercase tracking-[0.2em] text-[#6E655F]">
            CAPABILITIES
          </p>
          <h2 className="font-editorial text-4xl sm:text-6xl lg:text-7xl uppercase text-[#161413]">
            BUILT FOR CREATORS
          </h2>
        </motion.div>

        {/* 3 Well-Proportioned Editorial Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {FEATURE_CARDS.map((card, i) => {
            const Icon = card.icon;
            const isHovered = hoveredId === card.id;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: "some" }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                onMouseEnter={() => setHoveredId(card.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="group space-y-2.5"
              >
                {/* Compact Outer Header Bar: Category Label + Rotating Arrow */}
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`h-8 w-8 rounded-full ${card.badgeBg} text-white flex items-center justify-center shrink-0`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="font-mono-num text-[11px] font-semibold text-[#6E655F] uppercase truncate">
                      {card.subtitle}
                    </p>
                  </div>
                  <Link
                    href="/register"
                    aria-label={card.title}
                    className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isHovered
                        ? "bg-[#E1306C] text-white border-[#E1306C] rotate-45"
                        : "bg-white text-[#161413] border-[#161413]/15"
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* High-Density Card Container */}
                <motion.div
                  animate={isHovered ? { y: -6 } : { y: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                  className={`flex flex-col justify-between h-auto lg:min-h-[440px] p-5 sm:p-7 rounded-3xl border gap-5 overflow-hidden ${card.cardBg}`}
                >
                  {/* Top Pill + Bold Title Inside Card */}
                  <div className="space-y-2.5">
                    <span className="inline-block font-mono-num text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/90 border border-[#161413]/10 text-[#161413]">
                      {card.subtitle}
                    </span>
                    <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#161413]">
                      {card.title}
                    </h3>
                  </div>

                  {/* Full-Width Interactive Visual Stage */}
                  <div className="w-full flex items-center justify-center">
                    {card.id === "triggers" && <CardOneStage hovered={isHovered} />}
                    {card.id === "follow" && <CardTwoStage hovered={isHovered} />}
                    {card.id === "products" && <CardThreeStage hovered={isHovered} />}
                  </div>

                  {/* Compact Footer Spec Strip */}
                  <div className="space-y-1.5 bg-white/90 rounded-2xl border border-[#161413]/10 p-3.5">
                    {card.items.map((item, idx) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 text-[11px] font-medium text-[#161413]"
                      >
                        <span className="font-mono-num text-[10px] font-bold text-[#E1306C]">
                          0{idx + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Below Grid: Centered Condensed Headline + Tilted Black Sticker Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: "some" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative pt-6 text-center max-w-4xl mx-auto space-y-6"
        >
          <div className="relative inline-block">
            <span className="hidden sm:inline-block absolute -top-6 -left-6 -rotate-6 rounded-full bg-[#161413] px-3.5 py-1 text-[11px] font-mono-num font-semibold text-[#F7F1EC] shadow-sm">
              No coding needed
            </span>
            <span className="hidden sm:inline-block absolute -bottom-4 -right-6 rotate-6 rounded-full bg-[#161413] px-3.5 py-1 text-[11px] font-mono-num font-semibold text-[#F77737] shadow-sm">
              Meta approved
            </span>

            <h3 className="font-editorial text-3xl sm:text-5xl lg:text-6xl uppercase text-[#161413]">
              AUTOMATE EVERY COMMENT WITHOUT SOUNDING LIKE A BOT.
            </h3>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#"
              className="group inline-flex items-center gap-2.5 rounded-full bg-[#161413] pl-5 pr-2 py-2 text-xs sm:text-sm font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
            >
              <span>See live demo</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F77737] text-white transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
