"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Rocket,
  Save,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { validateTemplateVariables } from "@replyza/shared";
import { apiRequest } from "@/lib/api-client";
import {
  AffiliateProduct,
  AutomationProductItem,
  CreateAutomationPayload,
  DeliveryMode,
  InstagramAccountInfo,
  InstagramMedia,
  KeywordMatchLogic,
  KeywordMatchMode,
  MediaTypeFilter,
  ProductDeliveryMode,
  TargetMode,
  Template,
} from "@/types/automation";

export function utcIsoToLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localDateTimeInputToUtcIso(localVal: string): string | null {
  if (!localVal) return null;
  const d = new Date(localVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
import { LivePreview } from "./live-preview";
import { ProductSelectorStep } from "./product-selector-step";
import { StepFollowDm } from "./step-follow-dm";
import { StepReview } from "./step-review";
import { StepTrigger } from "./step-trigger";

const DRAFT_KEY = "replyza_builder_draft_v2";

export interface BuilderWizardProps {
  discoveredAccounts: InstagramAccountInfo[];
  initialData?: Partial<CreateAutomationPayload> & {
    id?: string;
    status?: string;
  };
  onSubmit: (
    data: CreateAutomationPayload,
    activateNow: boolean
  ) => Promise<void>;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

const WIZARD_STEPS = [
  { id: 0, num: "01", label: "Post & Trigger" },
  { id: 1, num: "02", label: "Follow Gate" },
  { id: 2, num: "03", label: "DM & Products" },
  { id: 3, num: "04", label: "Review & Launch" },
] as const;

export function BuilderWizard({
  discoveredAccounts,
  initialData,
  onSubmit,
  isSubmitting,
  isEditMode = false,
}: BuilderWizardProps) {
  const searchParams = useSearchParams();

  const defaultAccountId =
    initialData?.instagramAccountId ||
    (discoveredAccounts.length > 0 ? discoveredAccounts[0].id : "");

  const [activeStep, setActiveStep] = useState<number>(0);

  // Step 1: Post & Trigger
  const [accountId, setAccountId] = useState<string>(defaultAccountId);
  const [name, setName] = useState<string>(initialData?.name || "");
  const [mediaId, setMediaId] = useState<string>(
    () => searchParams.get("mediaId") || initialData?.mediaId || ""
  );
  const [mediaPermalink, setMediaPermalink] = useState<string>(
    () => searchParams.get("permalink") || initialData?.mediaPermalink || ""
  );
  const [mediaType, setMediaType] = useState<
    "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS"
  >(() => {
    const q = searchParams.get("mediaType");
    if (
      q === "IMAGE" ||
      q === "VIDEO" ||
      q === "CAROUSEL_ALBUM" ||
      q === "REELS"
    ) {
      return q;
    }
    if (initialData?.mediaType) return initialData.mediaType;
    return "IMAGE";
  });
  const [selectedMediaPreview, setSelectedMediaPreview] =
    useState<InstagramMedia | null>(null);
  const [targetMode, setTargetMode] = useState<TargetMode>(() => {
    if (searchParams.get("mediaId")) return "SPECIFIC_POST";
    if (initialData?.targetMode) return initialData.targetMode;
    if (initialData?.mediaId === null) return "ALL_POSTS";
    return "SPECIFIC_POST";
  });
  const [scheduledActivateAtLocal, setScheduledActivateAtLocal] = useState<string>(
    () => utcIsoToLocalDateTimeInput(initialData?.scheduledActivateAt)
  );
  const [bindingWindowMinutes, setBindingWindowMinutes] = useState<number>(30);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>(
    initialData?.mediaTypeFilter || "ANY"
  );
  const [captionKeywordFilter, setCaptionKeywordFilter] = useState<string>(
    initialData?.captionKeywordFilter || ""
  );

  const [triggerType, setTriggerType] = useState<"ANY_COMMENT" | "KEYWORD">(
    initialData?.triggerType || "KEYWORD"
  );
  const [keywordMatchMode, setKeywordMatchMode] = useState<KeywordMatchMode>(
    initialData?.keywordMatchMode || "CONTAINS"
  );
  const [keywordMatchLogic, setKeywordMatchLogic] =
    useState<KeywordMatchLogic>(
      initialData?.keywordMatchLogic || "ANY_KEYWORD"
    );
  const [keywords, setKeywords] = useState<string[]>(
    initialData?.keywords || ["LINK"]
  );

  const [publicReplyEnabled, setPublicReplyEnabled] = useState<boolean>(
    initialData?.publicReplyEnabled ?? true
  );
  const [publicReplyText, setPublicReplyText] = useState<string>(
    initialData?.publicReplyText ||
      "Check your DMs {{username}}! Sent it your way ✨"
  );
  const [publicReplyVariations, setPublicReplyVariations] = useState<string[]>(
    initialData?.publicReplyVariations || []
  );

  // Step 2: Follow Gate & DM
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    () => searchParams.get("templateId") || initialData?.templateId || null
  );
  const [dmMessageText, setDmMessageText] = useState<string>(
    initialData?.dmMessageText ||
      "Hey {{first_name}}! Thanks for commenting! Here's what you asked for:"
  );
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(
    initialData?.deliveryMode || "DIRECT"
  );
  const [buttonLabel, setButtonLabel] = useState<string>(
    initialData?.buttonLabel || "Send me the links"
  );
  const [followRequired, setFollowRequired] = useState<boolean>(
    initialData?.followRequired ?? false
  );
  const [followInstructionText, setFollowInstructionText] = useState<string>(
    initialData?.followInstructionText ||
      "Hey {{first_name}}! Follow our page and tap below to get your links instantly! 👇"
  );
  const [followSuccessText, setFollowSuccessText] = useState<string>(
    initialData?.followSuccessText ||
      "Woohoo! Thanks for following {{first_name}} 🎉 Here are your links:"
  );
  const [followFallbackText, setFollowFallbackText] = useState<string>(
    initialData?.followFallbackText ||
      "Looks like you aren't following us yet! Please follow our profile and tap the button below."
  );

  // Step 3: Products
  const [libraryProducts, setLibraryProducts] = useState<AffiliateProduct[]>(
    []
  );
  const [products, setProducts] = useState<AutomationProductItem[]>(
    initialData?.products ||
      (initialData?.dmLink
        ? [
            {
              name: "Featured Link",
              affiliateUrl: initialData.dmLink,
              ctaLabel: "Shop Now",
              sortOrder: 0,
            },
          ]
        : [])
  );
  const [productDeliveryMode, setProductDeliveryMode] =
    useState<ProductDeliveryMode>(
      initialData?.productDeliveryMode || "SINGLE_MESSAGE"
    );
  const [productIntroText, setProductIntroText] = useState<string>(
    initialData?.productIntroText || ""
  );
  const [productClosingText, setProductClosingText] = useState<string>(
    initialData?.productClosingText || ""
  );

  // Step 4: Guardrails & Launch
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(
    initialData?.cooldownSeconds ?? 0
  );
  const [dmMeFallbackEnabled, setDmMeFallbackEnabled] = useState<boolean>(
    initialData?.dmMeFallbackEnabled ?? false
  );
  const [dmMeFallbackKeyword, setDmMeFallbackKeyword] = useState<string>(
    keywords[0] || "LINK"
  );

  // UI state
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const applyTemplate = useCallback((tmpl: Template) => {
    setSelectedTemplateId(tmpl.id);
    setName((prev) => prev || `${tmpl.name} Automation`);
    setTriggerType(tmpl.triggerType);
    if (tmpl.keywords && tmpl.keywords.length > 0) {
      setKeywords(tmpl.keywords);
    }
    setPublicReplyText(tmpl.publicReplyText);
    setDmMessageText(tmpl.dmMessageText);
    setFollowRequired(tmpl.followRequired);
    if (tmpl.followInstructionText) {
      setFollowInstructionText(tmpl.followInstructionText);
    }
    if (tmpl.followSuccessText) {
      setFollowSuccessText(tmpl.followSuccessText);
    }
    if (tmpl.followFallbackText) {
      setFollowFallbackText(tmpl.followFallbackText);
    }
    toast.success(`Applied "${tmpl.name}" template`);
  }, []);

  useEffect(() => {
    let ignore = false;
    const qTemplateId = searchParams.get("templateId");

    Promise.all([
      apiRequest<Template[]>("/templates"),
      apiRequest<AffiliateProduct[]>("/products").catch(() => ({
        data: [] as AffiliateProduct[],
      })),
    ]).then(([tmplRes, prodRes]) => {
      if (ignore) return;
      if (tmplRes.data) {
        setTemplates(tmplRes.data);
        if (qTemplateId) {
          const found = tmplRes.data.find((t) => t.id === qTemplateId);
          if (found) applyTemplate(found);
        }
      }
      if (prodRes.data) {
        setLibraryProducts(prodRes.data);
      }
    });

    return () => {
      ignore = true;
    };
  }, [searchParams, applyTemplate]);

  const buildPayload = (): CreateAutomationPayload | null => {
    setValidationError(null);

    if (!accountId) {
      setValidationError(
        "Please connect and select an Instagram account first."
      );
      setActiveStep(0);
      return null;
    }
    if (targetMode === "SPECIFIC_POST" && !mediaId) {
      setValidationError(
        "Step 01: Select an Instagram post/Reel or choose another target mode."
      );
      setActiveStep(0);
      return null;
    }
    const scheduledIso =
      targetMode === "SCHEDULED_TIME"
        ? localDateTimeInputToUtcIso(scheduledActivateAtLocal)
        : null;
    if (targetMode === "SCHEDULED_TIME" && !scheduledIso) {
      setValidationError(
        "Step 01: Choose a valid scheduled date and time."
      );
      setActiveStep(0);
      return null;
    }
    if (!name.trim()) {
      setValidationError("Step 01: Please give your automation a name.");
      setActiveStep(0);
      return null;
    }
    if (
      triggerType === "KEYWORD" &&
      keywordMatchMode !== "ANY" &&
      keywords.length === 0
    ) {
      setValidationError("Step 01: Add at least one comment keyword.");
      setActiveStep(0);
      return null;
    }
    if (publicReplyEnabled && !publicReplyText.trim()) {
      setValidationError(
        "Step 01: Enter a public comment reply or disable public replies."
      );
      setActiveStep(0);
      return null;
    }
    if (!dmMessageText.trim()) {
      setValidationError("Step 02: Enter your opening/delivery DM message.");
      setActiveStep(1);
      return null;
    }

    for (const [label, val, stepIdx] of [
      ["Public Reply", publicReplyEnabled ? publicReplyText : "", 0],
      ["Opening DM", dmMessageText, 1],
      ["Product Intro", productIntroText, 2],
      ["Product Closing", productClosingText, 2],
    ] as const) {
      const check = validateTemplateVariables(val);
      if (!check.valid) {
        setValidationError(
          `${label} contains unsupported variable(s): ${check.unsupportedVariables
            .map((v) => `{{${v}}}`)
            .join(", ")}`
        );
        setActiveStep(stepIdx);
        return null;
      }
    }

    const effectiveDeliveryMode: DeliveryMode = followRequired
      ? "BUTTON"
      : deliveryMode;

    return {
      instagramAccountId: accountId,
      name: name.trim(),
      targetMode,
      mediaId: targetMode === "SPECIFIC_POST" ? mediaId : null,
      mediaPermalink:
        targetMode === "SPECIFIC_POST" ? mediaPermalink || null : null,
      mediaType: targetMode === "SPECIFIC_POST" ? mediaType : null,
      scheduledActivateAt: scheduledIso,
      bindingWindowMinutes:
        targetMode === "SCHEDULED_TIME" ? bindingWindowMinutes : undefined,
      mediaTypeFilter,
      captionKeywordFilter: captionKeywordFilter.trim() || null,
      triggerType,
      keywordMatchMode,
      keywordMatchLogic,
      keywords: triggerType === "KEYWORD" ? keywords : [],
      publicReplyEnabled,
      publicReplyText: publicReplyText.trim() || "Check your DMs!",
      publicReplyVariations,
      dmMessageText: dmMessageText.trim(),
      dmLink: products[0]?.affiliateUrl || null,
      productDeliveryMode,
      productIntroText: productIntroText.trim() || null,
      productClosingText: productClosingText.trim() || null,
      products: products.map((p, idx) => ({ ...p, sortOrder: idx })),
      deliveryMode: effectiveDeliveryMode,
      buttonLabel:
        effectiveDeliveryMode === "BUTTON"
          ? buttonLabel.trim() || "Send me the links"
          : null,
      cooldownSeconds,
      dmMeFallbackEnabled,
      followRequired,
      followInstructionText: followRequired
        ? followInstructionText.trim()
        : null,
      followSuccessText: followRequired ? followSuccessText.trim() : null,
      followFallbackText: followRequired ? followFallbackText.trim() : null,
      followUpEnabled: initialData?.followUpEnabled ?? false,
      followUpText: initialData?.followUpText ?? null,
      templateId: selectedTemplateId,
    };
  };

  const handleSave = async (activateNow: boolean) => {
    const payload = buildPayload();
    if (!payload) return;
    try {
      await onSubmit(payload, activateNow);
      if (typeof window !== "undefined") {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // handled by parent page
    }
  };

  const activeAccount = discoveredAccounts.find((a) => a.id === accountId);

  const previewNode = (
    <LivePreview
      accountUsername={activeAccount?.username || "shre_yadayal"}
      publicReplyEnabled={publicReplyEnabled}
      publicReplyText={publicReplyText}
      dmMessageText={dmMessageText}
      dmLink={products[0]?.affiliateUrl || null}
      triggerType={triggerType}
      keywords={keywords}
      deliveryMode={followRequired ? "BUTTON" : deliveryMode}
      buttonLabel={buttonLabel}
      followRequired={followRequired}
      followInstructionText={followInstructionText}
      followSuccessText={followSuccessText}
      products={products}
      productDeliveryMode={productDeliveryMode}
      productIntroText={productIntroText}
      productClosingText={productClosingText}
      mediaThumbnailUrl={
        selectedMediaPreview?.thumbnail_url || selectedMediaPreview?.media_url
      }
    />
  );

  return (
    <div className="mx-auto max-w-7xl pb-24 lg:pb-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left Column: 4-Step Editorial Studio */}
        <div className="space-y-6 lg:col-span-7">
          {/* Step Progress Bar */}
          <nav
            aria-label="Automation builder steps"
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6DFD8] bg-white p-2"
          >
            {WIZARD_STEPS.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    setActiveStep(step.id);
                  }}
                  className={`relative flex flex-1 min-w-[130px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? "text-white"
                      : "text-[#6E655F] hover:bg-[#F7F1EC] hover:text-[#161413]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="builder-step-pill"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-xl bg-[#161413]"
                    />
                  )}
                  <span
                    className={`relative z-10 font-mono text-[10px] ${
                      isActive ? "text-[#F77737]" : "text-[#6E655F]"
                    }`}
                  >
                    {step.num}
                  </span>
                  <span className="relative z-10 truncate">{step.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Validation Error Banner */}
          {validationError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-[#E1306C]/30 bg-[#FCE8EC] px-4 py-3 text-xs font-medium text-[#161413]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E1306C]" />
              <span className="flex-1">{validationError}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => setValidationError(null)}
                className="text-[#6E655F] hover:text-[#161413] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Active Step Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {activeStep === 0 && (
                <StepTrigger
                  name={name}
                  onChangeName={setName}
                  accountId={accountId}
                  onChangeAccountId={setAccountId}
                  discoveredAccounts={discoveredAccounts}
                  isEditMode={isEditMode}
                  targetMode={targetMode}
                  onChangeTargetMode={setTargetMode}
                  scheduledActivateAtLocal={scheduledActivateAtLocal}
                  onChangeScheduledActivateAtLocal={setScheduledActivateAtLocal}
                  bindingWindowMinutes={bindingWindowMinutes}
                  onChangeBindingWindowMinutes={setBindingWindowMinutes}
                  mediaTypeFilter={mediaTypeFilter}
                  onChangeMediaTypeFilter={setMediaTypeFilter}
                  captionKeywordFilter={captionKeywordFilter}
                  onChangeCaptionKeywordFilter={setCaptionKeywordFilter}
                  mediaId={mediaId}
                  onSelectMedia={(m) => {
                    setMediaId(m.id);
                    setMediaPermalink(m.permalink || "");
                    setMediaType(m.media_type);
                    setSelectedMediaPreview(m);
                  }}
                  triggerType={triggerType}
                  onChangeTriggerType={setTriggerType}
                  keywords={keywords}
                  onChangeKeywords={setKeywords}
                  keywordMatchMode={keywordMatchMode}
                  onChangeKeywordMatchMode={setKeywordMatchMode}
                  keywordMatchLogic={keywordMatchLogic}
                  onChangeKeywordMatchLogic={setKeywordMatchLogic}
                  publicReplyEnabled={publicReplyEnabled}
                  onChangePublicReplyEnabled={setPublicReplyEnabled}
                  publicReplyText={publicReplyText}
                  onChangePublicReplyText={setPublicReplyText}
                  publicReplyVariations={publicReplyVariations}
                  onChangePublicReplyVariations={setPublicReplyVariations}
                />
              )}

              {activeStep === 1 && (
                <StepFollowDm
                  followRequired={followRequired}
                  onChangeFollowRequired={setFollowRequired}
                  followInstructionText={followInstructionText}
                  onChangeFollowInstructionText={setFollowInstructionText}
                  followSuccessText={followSuccessText}
                  onChangeFollowSuccessText={setFollowSuccessText}
                  followFallbackText={followFallbackText}
                  onChangeFollowFallbackText={setFollowFallbackText}
                  buttonLabel={buttonLabel}
                  onChangeButtonLabel={setButtonLabel}
                  deliveryMode={deliveryMode}
                  onChangeDeliveryMode={setDeliveryMode}
                  dmMessageText={dmMessageText}
                  onChangeDmMessageText={setDmMessageText}
                  templates={templates}
                  selectedTemplateId={selectedTemplateId}
                  onSelectTemplate={applyTemplate}
                  onTemplateCreated={(created) =>
                    setTemplates((prev) => [created, ...prev])
                  }
                  publicReplyText={publicReplyText}
                  triggerType={triggerType}
                  keywords={keywords}
                />
              )}

              {activeStep === 2 && (
                <div className="rounded-2xl border border-[#E6DFD8] bg-white p-5 sm:p-6">
                  <div className="mb-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655F]">
                      Step 03 • Product Attachment
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[#161413]">
                      Attach Products &amp; Affiliate Links
                    </h2>
                  </div>
                  <ProductSelectorStep
                    automationId={initialData?.id}
                    products={products}
                    onChangeProducts={setProducts}
                    productDeliveryMode={productDeliveryMode}
                    onChangeProductDeliveryMode={setProductDeliveryMode}
                    deliveryMode={followRequired ? "BUTTON" : deliveryMode}
                    followRequired={followRequired}
                    productIntroText={productIntroText}
                    onChangeProductIntroText={setProductIntroText}
                    productClosingText={productClosingText}
                    onChangeProductClosingText={setProductClosingText}
                    libraryProducts={libraryProducts}
                  />
                </div>
              )}

              {activeStep === 3 && (
                <StepReview
                  name={name}
                  triggerType={triggerType}
                  keywords={keywords}
                  publicReplyEnabled={publicReplyEnabled}
                  publicReplyText={publicReplyText}
                  dmMessageText={dmMessageText}
                  dmLink={products[0]?.affiliateUrl}
                  productCount={products.length}
                  followRequired={followRequired}
                  followSuccessText={followSuccessText}
                  cooldownMinutes={Math.round(cooldownSeconds / 60)}
                  onChangeCooldownMinutes={(mins) =>
                    setCooldownSeconds(Math.max(0, mins) * 60)
                  }
                  dmMeFallbackEnabled={dmMeFallbackEnabled}
                  onChangeDmMeFallbackEnabled={setDmMeFallbackEnabled}
                  dmMeFallbackKeyword={dmMeFallbackKeyword}
                  onChangeDmMeFallbackKeyword={setDmMeFallbackKeyword}
                  isEditMode={isEditMode}
                  saving={isSubmitting}
                  onSaveDraft={() => handleSave(false)}
                  onActivate={() => handleSave(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Sticky Bottom Navigation Bar */}
          <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-[#E6DFD8] bg-white/95 px-4 py-3 backdrop-blur-sm shadow-sm">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DFD8] bg-[#F7F1EC] px-4 py-2 text-xs font-semibold text-[#161413] transition-colors hover:bg-[#EDE4DD] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSave(false)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#E6DFD8] bg-white px-4 py-2 text-xs font-semibold text-[#161413] hover:bg-[#F7F1EC] disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                {isEditMode ? "Save Changes" : "Save Draft"}
              </button>

              {activeStep < WIZARD_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveStep((s) =>
                      Math.min(WIZARD_STEPS.length - 1, s + 1)
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-[#161413] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2A2624] cursor-pointer"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5 text-[#F77737]" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSave(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#E1306C] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#c8235a] disabled:opacity-50 cursor-pointer"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  {isSubmitting ? "Saving..." : "Activate Automation"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Live iPhone 16 Pro Preview (Desktop) */}
        <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-8">
          <div className="rounded-3xl border border-[#E6DFD8] bg-[#F2EBE4]/55 p-5">
            {previewNode}
          </div>
        </aside>
      </div>

      {/* Mobile Floating Preview Pill (< 1024px) */}
      <button
        type="button"
        onClick={() => setMobilePreviewOpen(true)}
        className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[#161413] px-4 py-2.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/15 lg:hidden cursor-pointer"
      >
        <Smartphone className="h-4 w-4 text-[#F77737]" />
        Live Phone Preview
      </button>

      {/* Mobile Slide-Up Preview Drawer */}
      <AnimatePresence>
        {mobilePreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-[#161413]/60 backdrop-blur-xs lg:hidden"
            onClick={() => setMobilePreviewOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border-t border-[#E6DFD8] bg-[#F7F1EC] px-4 pt-4 pb-8"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#6E655F]">
                  Live Phone Preview
                </span>
                <button
                  type="button"
                  aria-label="Close phone preview"
                  onClick={() => setMobilePreviewOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E6DFD8] bg-white text-[#161413]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {previewNode}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
