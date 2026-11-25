"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import {
  Automation,
  CreateAutomationPayload,
  InstagramAccountInfo,
} from "@/types/automation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const BuilderWizard = dynamic(
  () =>
    import("@/components/automations/builder/builder-wizard").then(
      (m) => m.BuilderWizard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" label="Loading builder..." />
      </div>
    ),
  }
);
import { ErrorAlert } from "@/components/feedback/error-alert";
import { ArrowLeft, Sparkles } from "lucide-react";

function NewAutomationContent() {
  const router = useRouter();
  const [discoveredAccounts, setDiscoveredAccounts] = useState<InstagramAccountInfo[]>([]);
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await apiRequest<InstagramAccountInfo[]>("/instagram/accounts");
        if (res.data) {
          setDiscoveredAccounts(res.data);
        }
      } catch (err) {
        console.warn("Could not pre-load accounts:", err);
      } finally {
        setHasLoadedAccounts(true);
      }
    }

    loadAccounts();
  }, []);

  const handleCreate = async (payload: CreateAutomationPayload, activateNow: boolean) => {
    setIsLoading(true);
    setPageError(null);

    try {
      const createRes = await apiRequest<Automation>("/automations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (activateNow && createRes.data?.id) {
        await apiRequest(`/automations/${createRes.data.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "ACTIVE" }),
        });
      }

      router.push("/automations");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPageError(err.message);
      } else {
        setPageError("Failed to create automation. Please try again.");
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasLoadedAccounts) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" label="Loading accounts..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/automations">
          <Button variant="ghost" size="sm" className="gap-1 p-2 text-zinc-500">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Automation Builder
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100">
              <Sparkles className="h-2.5 w-2.5" /> Multi-Product Flow
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Create high-converting comment-to-DM flows with zero manual media ID entry.
          </p>
        </div>
      </div>

      {pageError && <ErrorAlert message={pageError} />}

      <BuilderWizard
        discoveredAccounts={discoveredAccounts}
        onSubmit={handleCreate}
        isSubmitting={isLoading}
      />
    </div>
  );
}

export default function NewAutomationPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center">
          <Spinner size="lg" label="Preparing builder..." />
        </div>
      }
    >
      <NewAutomationContent />
    </Suspense>
  );
}
