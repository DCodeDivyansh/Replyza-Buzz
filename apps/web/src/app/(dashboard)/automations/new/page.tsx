"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import {
  Automation,
  CreateAutomationPayload,
  InstagramAccountInfo,
} from "@/types/automation";
import { AutomationForm } from "@/components/automations/automation-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { ArrowLeft } from "lucide-react";

export default function NewAutomationPage() {
  const router = useRouter();
  const [discoveredAccounts, setDiscoveredAccounts] = useState<
    InstagramAccountInfo[]
  >([]);
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

  const handleCreate = async (payload: unknown) => {
    setIsLoading(true);
    setPageError(null);

    try {
      await apiRequest<Automation>("/automations", {
        method: "POST",
        body: JSON.stringify(payload as CreateAutomationPayload),
      });

      router.push("/automations");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPageError(err.message);
      } else {
        setPageError("Failed to create automation. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/automations">
          <Button variant="ghost" size="sm" className="gap-1 p-2 text-zinc-500">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            Create Automation
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure automated comments and DMs for an Instagram post or reel
          </p>
        </div>
      </div>

      <ErrorAlert
        message={pageError || ""}
        onDismiss={() => setPageError(null)}
      />

      {hasLoadedAccounts && discoveredAccounts.length === 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-900">No Instagram Account Connected</p>
            <p className="text-amber-700 mt-0.5">
              You must connect an Instagram Professional or Creator account before you can activate comment triggers.
            </p>
          </div>
          <Link href="/instagram">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100/70 shrink-0">
              Connect Instagram
            </Button>
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workflow Configuration</CardTitle>
          <CardDescription>
            Specify trigger keywords, public reply comments, and direct messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutomationForm
            isEditMode={false}
            discoveredAccounts={discoveredAccounts}
            onSubmit={handleCreate}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
