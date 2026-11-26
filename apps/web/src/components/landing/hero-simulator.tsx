"use client";

import React, { useState } from "react";
import { CheckCircle2, ExternalLink, MessageCircle, Send, ShieldCheck } from "lucide-react";

const SCENARIOS = [
  {
    keyword: "GLOW",
    commenter: "maya.creates",
    comment: "GLOW please! What serum is that?",
    publicReply: "Sent the skincare links to your DMs, @maya.creates!",
    dmIntro: "Hey Maya! Here are the 2 products from my morning routine:",
    products: [
      {
        name: "Vitamin C 10% Brightening Serum",
        brand: "Minimalist",
        price: "₹699",
        oldPrice: "₹799",
        code: "MAYA15",
        url: "shop.example.com/vit-c?tag=maya",
      },
      {
        name: "Ceramide Barrier Moisturizer",
        brand: "Dot & Key",
        price: "₹495",
        oldPrice: null,
        code: null,
        url: "shop.example.com/ceramide?tag=maya",
      },
    ],
  },
  {
    keyword: "DESK",
    commenter: "arjun_dev",
    comment: "DESK setup link?",
    publicReply: "Just DM'd you the full desk gear list @arjun_dev!",
    dmIntro: "Here is the exact monitor arm & mechanical keyboard from the Reel:",
    products: [
      {
        name: "Keychron K2 Pro Wireless",
        brand: "Keychron",
        price: "$99",
        oldPrice: "$119",
        code: "ARJUN10",
        url: "amzn.to/keychron-k2?tag=desk",
      },
      {
        name: "Ergonomic Gas-Spring Arm",
        brand: "North Bayou",
        price: "$39",
        oldPrice: null,
        code: null,
        url: "amzn.to/nb-arm?tag=desk",
      },
    ],
  },
  {
    keyword: "OUTFIT",
    commenter: "sara.styles",
    comment: "OUTFIT links!!",
    publicReply: "Check your DMs @sara.styles — sent both links!",
    dmIntro: "Here are the blazer & loafers from today's reel:",
    products: [
      {
        name: "Linen Relaxed Blazer — Sand",
        brand: "Mango",
        price: "$89",
        oldPrice: "$120",
        code: "SARA20",
        url: "ltk.app/sara/linen-blazer",
      },
      {
        name: "Leather Penny Loafers",
        brand: "Massimo",
        price: "$110",
        oldPrice: null,
        code: null,
        url: "ltk.app/sara/penny-loafers",
      },
    ],
  },
];

export function HeroSimulator() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = SCENARIOS[activeIdx];

  return (
    <div className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] overflow-hidden">
      {/* Top Bar with Interactive Keyword Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6E5E1] bg-[#FAF9F6] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0D7A5F]" />
          <span className="font-mono-num text-[11px] font-medium text-[#141413]">
            LIVE FLOW PREVIEW
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#5C5B57] mr-1">Try keyword:</span>
          {SCENARIOS.map((s, idx) => (
            <button
              key={s.keyword}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`font-mono-num rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                idx === activeIdx
                  ? "bg-[#141413] text-[#FAF9F6]"
                  : "bg-[#F3F2EE] text-[#5C5B57] hover:text-[#141413]"
              }`}
            >
              {s.keyword}
            </button>
          ))}
        </div>
      </div>

      {/* Simulation Body */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Step 1: Comment Webhook */}
        <div className="rounded-lg border border-[#E6E5E1] bg-[#FAF9F6] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-[#5C5B57] flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-[#D94E28]" />
              1. Comment received on Reel
            </span>
            <span className="font-mono-num text-[#0D7A5F] bg-[#ECF7F3] px-1.5 py-0.5 rounded">
              MATCH: {active.keyword}
            </span>
          </div>
          <div className="text-xs text-[#141413]">
            <span className="font-semibold">@{active.commenter}</span>{" "}
            <span>{active.comment}</span>
          </div>
          <div className="pl-3 border-l-2 border-[#E6E5E1] text-[11px] text-[#5C5B57]">
            <span className="font-semibold text-[#141413]">@yourbrand</span>{" "}
            {active.publicReply}
          </div>
        </div>

        {/* Step 2: Automated DM + Product Cards */}
        <div className="rounded-lg border border-[#E6E5E1] bg-[#FFFFFF] p-3.5 space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-[#141413] flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-[#0D7A5F]" />
              2. Private DM delivered
            </span>
            <span className="inline-flex items-center gap-1 text-[#0D7A5F] font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              Meta API
            </span>
          </div>

          <div className="rounded-lg bg-[#F3F2EE] px-3 py-2 text-xs text-[#141413]">
            {active.dmIntro}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {active.products.map((p) => (
              <div
                key={p.name}
                className="rounded-lg border border-[#E6E5E1] bg-[#FAF9F6] p-2.5 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="text-[10px] font-medium text-[#5C5B57] uppercase tracking-wide">
                    {p.brand}
                  </div>
                  <div className="text-xs font-semibold text-[#141413] leading-snug mt-0.5">
                    {p.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono-num text-xs font-semibold text-[#141413]">
                      {p.price}
                    </span>
                    {p.oldPrice && (
                      <span className="font-mono-num text-[10px] text-[#8C8A84] line-through">
                        {p.oldPrice}
                      </span>
                    )}
                    {p.code && (
                      <span className="font-mono-num text-[10px] bg-[#FDF2EE] text-[#D94E28] px-1.5 py-0.5 rounded">
                        {p.code}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[#E6E5E1] pt-1.5 text-[11px] font-medium text-[#D94E28]">
                  <span className="truncate font-mono-num text-[10px] text-[#5C5B57]">
                    {p.url}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-[#5C5B57]">
            <span className="flex items-center gap-1 text-[#0D7A5F] font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Affiliate tracking parameters preserved
            </span>
            <span className="font-mono-num">142ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
