import React, { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Data Deletion Instructions | Replyza",
  description: "User Data Deletion Instructions and Status for Meta Platform Users",
};

interface DataDeletionPageProps {
  searchParams: Promise<{ id?: string }>;
}

async function ConfirmationStatus({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id: confirmationCode } = await searchParams;

  if (!confirmationCode) return null;

  return (
    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
      <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span>Data Deletion Request Processed</span>
      </div>
      <p className="text-xs text-emerald-700">
        Your data deletion request was successfully processed by Replyza.
      </p>
      <p className="text-[11px] font-mono text-emerald-800 bg-white/70 p-2 rounded border border-emerald-200/60 inline-block">
        Confirmation Code: {confirmationCode}
      </p>
    </div>
  );
}

export default function DataDeletionPage({ searchParams }: DataDeletionPageProps) {
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
            <Trash2 className="h-5 w-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">User Privacy Rights</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            User Data Deletion
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Instructions and status verification for Facebook and Instagram users
          </p>
        </div>

        <Suspense fallback={null}>
          <ConfirmationStatus searchParams={searchParams} />
        </Suspense>

        <div className="prose prose-zinc prose-sm text-xs leading-relaxed text-zinc-600 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-zinc-900">
              How to Delete Your Data from Replyza
            </h2>
            <p className="mt-1">
              Replyza respects user privacy and complies with Meta Platform Data Deletion requirements.
              You have multiple ways to request deletion of your personal data and connected Instagram credentials:
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
              Option 1: In-App Account Deletion
            </h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Log in to your Replyza account.</li>
              <li>Navigate to <strong>Settings</strong> from the dashboard sidebar.</li>
              <li>Under the <strong>Danger Zone</strong> section, click <strong>Delete Account</strong>.</li>
              <li>Confirm deletion. Your user record, encrypted Instagram tokens, automations, and execution history will be immediately and permanently removed.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
              Option 2: Disconnect via Facebook / Instagram
            </h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open your Facebook Account Settings &gt; <strong>Apps and Websites</strong>.</li>
              <li>Find <strong>Replyza</strong> in your active apps list.</li>
              <li>Click <strong>Remove</strong>.</li>
              <li>When prompted, check the box to request data deletion. Facebook will trigger our automated Data Deletion Callback URL to erase your linked credentials.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
              Option 3: Manual Email Request
            </h3>
            <p>
              Send an email to <strong>privacy@replyza.buzz</strong> from your registered email address with the subject
              &ldquo;Data Deletion Request&rdquo;. We will purge all associated database records within 48 hours and send you a confirmation code.
            </p>
          </section>
        </div>

        <div className="border-t border-zinc-100 pt-6 text-[11px] text-zinc-400 flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-zinc-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-zinc-600">Terms of Service</Link>
          <span>&copy; 2026 Replyza. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
