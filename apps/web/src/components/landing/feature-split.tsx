import React from "react";
import { Check, Minus } from "lucide-react";

const FEATURE_BLOCKS = [
  {
    tag: "01 / MULTI-PRODUCT DELIVERY",
    title: "Send one link or an entire haul from a single comment",
    body: "Attach up to 10 products per automation. Choose between a single formatted DM list, sequential messages, Quick Reply product pickers, or Meta Generic Template cards when inside the 24-hour window.",
    details: [
      "Drag-and-drop product order",
      "Bulk paste Name | URL lists",
      "Automatic fallback when Direct Private Reply is used",
    ],
  },
  {
    tag: "02 / AFFILIATE PRODUCT LIBRARY",
    title: "Save brand links once, reuse them across every Reel",
    body: "Store product titles, images, prices, discount codes, and partner notes in a central library. Replyza never strips or rewrites your UTM or affiliate tracking parameters.",
    details: [
      "Best-effort OpenGraph metadata prefill",
      "Preserves ?tag= and UTM query strings verbatim",
      "Deleting a library item never breaks live automations",
    ],
  },
  {
    tag: "03 / DM TEMPLATES & VARIABLES",
    title: "Write replies that sound like you, not a bot",
    body: "Start from 9 creator-tested categories—Friendly, Professional, Creator, Promotional, Exclusive Offer, and Multi-Product—with validated variables like {{first_name}}, {{product_name}}, and {{coupon_code}}.",
    details: [
      "Server-validated placeholders before saving",
      "Rotating public comment reply variations",
      "Optional Follow-to-Get-Link gate where Meta permits",
    ],
  },
];

const COMPARISON_ROWS = [
  {
    capability: "Multi-product haul links in one flow",
    replyza: true,
    manual: false,
  },
  {
    capability: "Preserves affiliate & UTM query parameters",
    replyza: true,
    manual: true,
  },
  {
    capability: "Zero duplicate DMs on Meta webhook retries",
    replyza: true,
    manual: false,
  },
  {
    capability: "Rotating public comment replies",
    replyza: true,
    manual: false,
  },
  {
    capability: "Reusable Affiliate Product Library",
    replyza: true,
    manual: false,
  },
  {
    capability: "Honest 24-hour window & Meta API guardrails",
    replyza: true,
    manual: true,
  },
];

export function FeatureSplit() {
  return (
    <div className="space-y-20">
      {/* Split Feature Breakdowns */}
      <section id="features" className="space-y-12">
        <div className="max-w-2xl space-y-2">
          <p className="font-mono-num text-xs font-medium text-[#D94E28]">
            BUILT FOR CREATOR COMMERCE
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141413]">
            Everything between a Reel comment and a tracked checkout
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {FEATURE_BLOCKS.map((item) => (
            <div
              key={item.tag}
              className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <span className="font-mono-num text-[11px] font-medium text-[#5C5B57]">
                  {item.tag}
                </span>
                <h3 className="font-display text-lg font-semibold text-[#141413] leading-snug">
                  {item.title}
                </h3>
                <p className="text-sm text-[#5C5B57] leading-relaxed">
                  {item.body}
                </p>
              </div>
              <ul className="space-y-2 border-t border-[#E6E5E1] pt-4">
                {item.details.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-xs text-[#141413]">
                    <Check className="h-3.5 w-3.5 text-[#0D7A5F] shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Clean Comparison Table */}
      <section className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E6E5E1] bg-[#FAF9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-[#141413]">
              Automated Product DMs vs. Manual Replying
            </h3>
            <p className="text-xs text-[#5C5B57] mt-0.5">
              Stop copying and pasting affiliate links into DM requests after every viral Reel.
            </p>
          </div>
          <span className="font-mono-num text-[11px] text-[#0D7A5F] bg-[#ECF7F3] px-2.5 py-1 rounded-md self-start sm:self-auto">
            Official Meta Graph API
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6E5E1] text-[11px] font-mono-num uppercase text-[#5C5B57]">
                <th className="py-3 px-6 font-medium">Capability</th>
                <th className="py-3 px-6 font-medium text-[#141413]">Replyza Buzz</th>
                <th className="py-3 px-6 font-medium">Manual DMs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E5E1] text-sm">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.capability} className="hover:bg-[#FAF9F6]">
                  <td className="py-3.5 px-6 text-[#141413] font-medium">
                    {row.capability}
                  </td>
                  <td className="py-3.5 px-6">
                    {row.replyza ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D7A5F]">
                        <Check className="h-4 w-4" /> Included
                      </span>
                    ) : (
                      <Minus className="h-4 w-4 text-[#8C8A84]" />
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    {row.manual ? (
                      <span className="text-xs text-[#5C5B57]">Manual effort</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-[#8C8A84]">
                        <Minus className="h-3.5 w-3.5" /> Not available
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
