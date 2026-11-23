"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Automation, UpdateAutomationPayload } from "@/types/automation";
import { AutomationForm } from "@/components/automations/automation-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { ArrowLeft } from "lucide-react";

export default function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAutomation() {
      try {
        const res = await apiRequest<Automation>(`/automations/${id}`);
        setAutomation(res.data || null);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setPageError(err.message);
        } else {
          setPageError("Failed to load automation details.");
        }
      } finally {
        setIsLoadingData(false);
      }
    }

    loadAutomation();
  }, [id]);

  const handleUpdate = async (payload: unknown) => {
    setIsSubmitting(true);
    setPageError(null);

    try {
      await apiRequest<Automation>(`/automations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload as UpdateAutomationPayload),
      });

      router.push(`/automations/${id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPageError(err.message);
      } else {
        setPageError("Failed to update automation.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="md" label="Loading automation for editing..." />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <ErrorAlert message={pageError || "Automation not found"} />
        <Link href="/automations">
          <Button variant="secondary" size="sm">
            Back to Automations
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/automations/${id}`}>
          <Button variant="ghost" size="sm" className="p-2 text-zinc-500">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            Edit Automation
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Modify trigger keywords and responses for {automation.name}
          </p>
        </div>
      </div>

      <ErrorAlert
        message={pageError || ""}
        onDismiss={() => setPageError(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Edit Configuration</CardTitle>
          <CardDescription>
            Target Post: {automation.mediaId} (Media ID cannot be changed once created).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutomationForm
            initialData={automation}
            isEditMode={true}
            onSubmit={handleUpdate}
            isLoading={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
