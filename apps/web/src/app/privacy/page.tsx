import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Replyza",
  description: "Replyza Privacy Policy and Meta Platform Compliance",
};

export default function PrivacyPage() {
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
            <Shield className="h-5 w-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">Compliance & Trust</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Privacy Policy
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Last updated: November 24, 2026</p>
        </div>

        <div className="prose prose-zinc prose-sm text-xs leading-relaxed text-zinc-600 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-zinc-900">1. Information We Collect</h2>
            <p className="mt-1">
              Replyza collects email addresses and encrypted credentials required for workspace authentication.
              When you connect an Instagram Professional account via Facebook Login for Business, we receive an authorized
              access token, your Instagram business account ID, and your public Instagram username.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">2. How We Use Information</h2>
            <p className="mt-1">
              We process comment webhooks delivered by Meta only to match configured keywords and dispatch automated
              public replies and private direct messages. We do not sell your personal data, post unauthorized content,
              or access private personal Instagram messages outside your configured automation rules.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">3. Token Security & Encryption</h2>
            <p className="mt-1">
              All Meta Graph API access tokens are encrypted at rest using AES-256-GCM authenticated encryption before
              being stored in PostgreSQL. Decryption keys are stored strictly in secure server environment variables
              and are never exposed to the frontend or logged in application traces.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">4. Data Deletion</h2>
            <p className="mt-1">
              You can disconnect your Instagram account or permanently delete your Replyza account at any time from your
              Account Settings. In addition, we support Meta&apos;s automatic Data Deletion Callback URL. For manual data deletion
              requests or status checks, visit our{" "}
              <Link href="/data-deletion" className="text-indigo-600 underline font-medium">
                Data Deletion Instructions
              </Link>{" "}
              page.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">5. Contact Us</h2>
            <p className="mt-1">
              If you have any questions about this Privacy Policy or our security practices, contact us at privacy@replyza.buzz.
            </p>
          </section>
        </div>

        <div className="border-t border-zinc-100 pt-6 text-[11px] text-zinc-400 flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-zinc-600">Terms of Service</Link>
          <Link href="/data-deletion" className="hover:text-zinc-600">Data Deletion</Link>
          <span>&copy; 2026 Replyza. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
