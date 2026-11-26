"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import {
  Automation,
  CreateAutomationPayload,
  InstagramAccountInfo,
  UpdateAutomationPayload,
} from "@/types/automation";
import { BuilderWizard } from "@/components/automations/builder/builder-wizard";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [accounts, setAccounts] = useState<InstagramAccountInfo[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAutomation() {
      try {
        const [autoRes, accRes] = await Promise.all([
          apiRequest<Automation>(`/automations/${id}`),
          apiRequest<InstagramAccountInfo[]>("/instagram/accounts").catch(() => ({
            data: [] as InstagramAccountInfo[],
          })),
        ]);
        setAutomation(autoRes.data || null);
        if (accRes.data) setAccounts(accRes.data);
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

  const handleUpdate = async (payload: CreateAutomationPayload) => {
    setIsSubmitting(true);
    setPageError(null);

    const updatePayload: UpdateAutomationPayload = {
      name: payload.name,
      triggerType: payload.triggerType,
      keywordMatchMode: payload.keywordMatchMode,
      keywordMatchLogic: payload.keywordMatchLogic,
      keywords: payload.keywords,
      publicReplyEnabled: payload.publicReplyEnabled,
      publicReplyText: payload.publicReplyText,
      publicReplyVariations: payload.publicReplyVariations,
      dmMessageText: payload.dmMessageText,
      dmLink: payload.dmLink,
      productDeliveryMode: payload.productDeliveryMode,
      productIntroText: payload.productIntroText,
      productClosingText: payload.productClosingText,
      products: payload.products,
      deliveryMode: payload.deliveryMode,
      buttonLabel: payload.buttonLabel,
      cooldownSeconds: payload.cooldownSeconds,
      dmMeFallbackEnabled: payload.dmMeFallbackEnabled,
      followRequired: payload.followRequired,
      followInstructionText: payload.followInstructionText,
      followSuccessText: payload.followSuccessText,
      followFallbackText: payload.followFallbackText,
      followUpEnabled: payload.followUpEnabled,
      followUpText: payload.followUpText,
      templateId: payload.templateId,
    };

    try {
      await apiRequest<Automation>(`/automations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updatePayload),
      });
      toast.success("Automation updated");
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
    <div className="space-y-6">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Link href={`/automations/${id}`}>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-[#E6DFD8] bg-white p-2 text-[#6E655F] hover:text-[#161413]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#161413]">
              Edit Automation
            </h2>
            <span className="inline-flex items-center rounded-full border border-[#E6DFD8] bg-[#FCE8EC] px-2.5 py-0.5 text-[10px] font-semibold text-[#E1306C]">
              Live Studio
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#6E655F]">
            Update triggers, follow gate, DM templates, and product links for{" "}
            {automation.name}
          </p>
        </div>
      </div>

      {pageError && (
        <ErrorAlert message={pageError} onDismiss={() => setPageError(null)} />
      )}

      <BuilderWizard
        discoveredAccounts={
          accounts.length > 0
            ? accounts
            : automation.instagramAccount
            ? [automation.instagramAccount]
            : []
        }
        initialData={{
          id: automation.id,
          instagramAccountId: automation.instagramAccountId,
          name: automation.name,
          mediaId: automation.mediaId,
          mediaPermalink: automation.mediaPermalink,
          mediaType: automation.mediaType,
          triggerType: automation.triggerType,
          keywordMatchMode: automation.keywordMatchMode,
          keywordMatchLogic: automation.keywordMatchLogic,
          keywords: automation.keywords,
          publicReplyEnabled: automation.publicReplyEnabled,
          publicReplyText: automation.publicReplyText,
          publicReplyVariations: automation.publicReplyVariations,
          dmMessageText: automation.dmMessageText,
          dmLink: automation.dmLink,
          productDeliveryMode: automation.productDeliveryMode,
          productIntroText: automation.productIntroText,
          productClosingText: automation.productClosingText,
          products: automation.products,
          deliveryMode: automation.deliveryMode,
          buttonLabel: automation.buttonLabel,
          cooldownSeconds: automation.cooldownSeconds,
          dmMeFallbackEnabled: automation.dmMeFallbackEnabled,
          followRequired: automation.followRequired,
          followInstructionText: automation.followInstructionText,
          followSuccessText: automation.followSuccessText,
          followFallbackText: automation.followFallbackText,
          followUpEnabled: automation.followUpEnabled,
          followUpText: automation.followUpText,
          templateId: automation.templateId,
          status: automation.status,
        }}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
        isEditMode={true}
      />
    </div>
  );
}
