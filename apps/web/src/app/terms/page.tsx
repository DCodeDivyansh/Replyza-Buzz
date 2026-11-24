import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service | Replyza",
  description: "Replyza Terms of Service and Acceptable Use Policy",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 bg-white p-8 sm:p-12 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Replyza
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">Legal Agreements</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Terms of Service
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Last updated: November 24, 2026</p>
        </div>

        <div className="prose prose-zinc prose-sm text-xs leading-relaxed text-zinc-600 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-zinc-900">1. Acceptance of Terms</h2>
            <p className="mt-1">
              By registering for or using Replyza, you agree to comply with and be bound by these Terms of Service
              and Meta&apos;s Platform Terms and Developer Policies. If you do not agree, do not use Replyza.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">2. Acceptable Use Policy</h2>
            <p className="mt-1">
              You agree not to use Replyza to send spam, unsolicited promotional messages violating Meta&apos;s Community Standards,
              harassing content, or deceptive links. You are solely responsible for all comments and direct messages
              dispatched by automations configured under your workspace.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">3. Meta API & Third-Party Platforms</h2>
            <p className="mt-1">
              Replyza relies on official Meta Graph APIs and Webhooks. We are not responsible for service interruptions,
              policy enforcement actions, rate limits, or account suspensions initiated by Meta.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">4. Account Termination</h2>
            <p className="mt-1">
              We reserve the right to suspend or terminate accounts that violate our Acceptable Use Policy or Meta&apos;s
              policies without prior notice. You may delete your account at any time from your Account Settings.
            </p>
          </section>
        </div>

        <div className="border-t border-zinc-100 pt-6 text-[11px] text-zinc-400 flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-zinc-600">Privacy Policy</Link>
          <Link href="/data-deletion" className="hover:text-zinc-600">Data Deletion</Link>
          <span>&copy; 2026 Replyza. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
