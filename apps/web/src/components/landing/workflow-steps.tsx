import React from "react";
import Link from "next/link";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";

const STEPS = [
  {
    num: "01",
    title: "Connect Instagram via Meta OAuth",
    description:
      "Link your Creator or Business account with Facebook Login for Business. Access tokens are encrypted with AES-256-GCM.",
  },
  {
    num: "02",
    title: "Pick a Reel & set comment keywords",
    description:
      "Target a specific post or all posts. Match any keyword, all keywords, or exact words like LINK, SHOP, or PRICE.",
  },
  {
    num: "03",
    title: "Attach products & customize your DM",
    description:
      "Select products from your Affiliate Library or paste links in bulk. Preview the exact mobile DM thread before activating.",
  },
  {
    num: "04",
    title: "Track every webhook & delivery",
    description:
      "Every comment webhook, public reply, and DM send is logged in Activity with lease-locked, zero-duplicate execution.",
  },
];

export function WorkflowSteps() {
  return (
    <section id="workflow" className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="font-mono-num text-xs font-medium text-[#D94E28]">
          HOW IT WORKS
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141413]">
          Four steps from comment to product DM
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] p-5 space-y-3"
          >
            <span className="font-mono-num inline-block text-xs font-semibold text-[#D94E28] bg-[#FDF2EE] px-2 py-0.5 rounded">
              STEP {step.num}
            </span>
            <h3 className="font-display text-base font-semibold text-[#141413]">
              {step.title}
            </h3>
            <p className="text-xs text-[#5C5B57] leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[#E6E5E1] bg-[#FFFFFF]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <ReplyzaLogo size="sm" />
          <p className="text-xs text-[#5C5B57]">
            Instagram comment-to-DM &amp; affiliate link automation built on official Meta APIs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs text-[#5C5B57]">
          <Link href="/privacy" className="hover:text-[#141413] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[#141413] transition-colors">
            Terms of Service
          </Link>
          <Link href="/data-deletion" className="hover:text-[#141413] transition-colors">
            Data Deletion
          </Link>
        </div>
      </div>
    </footer>
  );
}
