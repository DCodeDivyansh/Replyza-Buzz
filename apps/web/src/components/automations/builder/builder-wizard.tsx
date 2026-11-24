"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  CreateAutomationPayload,
  InstagramAccountInfo,
  InstagramMedia,
  Template,
} from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MediaGrid } from "@/components/media/media-grid";
import { TemplateCard } from "@/components/templates/template-card";
import { LivePreview } from "./live-preview";
import { apiRequest } from "@/lib/api-client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  MessageSquare,
  Send,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";

const DRAFT_KEY = "replyza_builder_draft_v1";

interface BuilderWizardProps {
  discoveredAccounts: InstagramAccountInfo[];
  initialData?: Partial<CreateAutomationPayload> & { id?: string; status?: string };
  onSubmit: (data: CreateAutomationPayload, activateNow: boolean) => Promise<void>;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

export function BuilderWizard({
  discoveredAccounts,
  initialData,
  onSubmit,
  isSubmitting,
  isEditMode = false,
}: BuilderWizardProps) {
  const searchParams = useSearchParams();

  // Initial account selection
  const defaultAccountId =
    initialData?.instagramAccountId ||
    (discoveredAccounts.length > 0 ? discoveredAccounts[0].id : "");

  // Builder State
  const [step, setStep] = useState<number>(() => (searchParams.get("mediaId") ? 2 : 1));
  const [accountId, setAccountId] = useState<string>(defaultAccountId);
  const [name, setName] = useState<string>(initialData?.name || "");
  const [mediaId, setMediaId] = useState<string>(
    () => searchParams.get("mediaId") || initialData?.mediaId || ""
  );
  const [mediaPermalink, setMediaPermalink] = useState<string>(
    () => searchParams.get("permalink") || initialData?.mediaPermalink || ""
  );
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS">(
    () => {
      const q = searchParams.get("mediaType");
      if (q === "IMAGE" || q === "VIDEO" || q === "CAROUSEL_ALBUM" || q === "REELS") return q;
      if (initialData?.mediaType) return initialData.mediaType;
      return "IMAGE";
    }
  );
  const [selectedMediaPreview, setSelectedMediaPreview] = useState<InstagramMedia | null>(null);

  const [allMedia, setAllMedia] = useState<boolean>(
    () => !searchParams.get("mediaId") && initialData?.mediaId === null
  );
  const [keywordMatchMode, setKeywordMatchMode] = useState<"CONTAINS" | "EXACT" | "ANY">(
    initialData?.keywordMatchMode || "CONTAINS"
  );
  const [deliveryMode, setDeliveryMode] = useState<"DIRECT" | "BUTTON">(
    initialData?.deliveryMode || "DIRECT"
  );
  const [buttonLabel, setButtonLabel] = useState<string>(
    initialData?.buttonLabel || "Send me the link"
  );
  const [publicReplyVariations, setPublicReplyVariations] = useState<string[]>(
    initialData?.publicReplyVariations || []
  );
  const [variationInput, setVariationInput] = useState<string>("");
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(
    initialData?.cooldownSeconds ?? 0
  );
  const [dmMeFallbackEnabled, setDmMeFallbackEnabled] = useState<boolean>(
    initialData?.dmMeFallbackEnabled ?? false
  );

  const [triggerType, setTriggerType] = useState<"ANY_COMMENT" | "KEYWORD">(
    initialData?.triggerType || "KEYWORD"
  );
  const [keywords, setKeywords] = useState<string[]>(initialData?.keywords || ["LINK"]);
  const [keywordInput, setKeywordInput] = useState<string>("");

  const [publicReplyText, setPublicReplyText] = useState<string>(
    initialData?.publicReplyText || "Check your DMs {{username}}! Sent it your way 🔥"
  );
  const [dmMessageText, setDmMessageText] = useState<string>(
    initialData?.dmMessageText || "Hey {{first_name}}! Thanks for asking for the link. Here is what you requested:"
  );
  const [dmLink, setDmLink] = useState<string>(initialData?.dmLink || "");

  const [followRequired, setFollowRequired] = useState<boolean>(initialData?.followRequired ?? false);
  const [followInstructionText, setFollowInstructionText] = useState<string>(
    initialData?.followInstructionText ||
      "Hey {{first_name}}! Thanks for commenting. Follow our page and tap the button below to get your link instantly! 👇"
  );
  const [followSuccessText, setFollowSuccessText] = useState<string>(
    initialData?.followSuccessText || "Woohoo! Thanks for following {{first_name}} 🎉 Here is your link:"
  );
  const [followFallbackText, setFollowFallbackText] = useState<string>(
    initialData?.followFallbackText ||
      "Looks like you aren't following us yet! Please follow our profile and tap the button below to get your link."
  );

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    () => searchParams.get("templateId") || null
  );
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(() => {
    if (isEditMode || searchParams.get("mediaId")) return false;
    try {
      if (typeof window === "undefined") return false;
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      return Boolean(parsed.name || parsed.mediaId);
    } catch {
      return false;
    }
  });
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
    if (tmpl.dmLink) setDmLink(tmpl.dmLink);
    setFollowRequired(tmpl.followRequired);
    if (tmpl.followInstructionText) setFollowInstructionText(tmpl.followInstructionText);
    if (tmpl.followSuccessText) setFollowSuccessText(tmpl.followSuccessText);
    if (tmpl.followFallbackText) setFollowFallbackText(tmpl.followFallbackText);
  }, []);

  // Load templates on mount and apply if templateId was provided in searchParams
  useEffect(() => {
    let ignore = false;
    const qTemplateId = searchParams.get("templateId");

    apiRequest<Template[]>("/templates").then((res) => {
      if (!ignore && res.data) {
        setTemplates(res.data);
        if (qTemplateId) {
          const found = res.data.find((t) => t.id === qTemplateId);
          if (found) applyTemplate(found);
        }
      }
    });

    return () => {
      ignore = true;
    };
  }, [searchParams, applyTemplate]);

  // Auto-save draft
  useEffect(() => {
    if (isEditMode) return;
    try {
      const draft = {
        name,
        accountId,
        mediaId,
        mediaPermalink,
        mediaType,
        triggerType,
        keywords,
        publicReplyText,
        dmMessageText,
        dmLink,
        followRequired,
        followInstructionText,
        followSuccessText,
        followFallbackText,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    isEditMode,
    name,
    accountId,
    mediaId,
    mediaPermalink,
    mediaType,
    triggerType,
    keywords,
    publicReplyText,
    dmMessageText,
    dmLink,
    followRequired,
    followInstructionText,
    followSuccessText,
    followFallbackText,
  ]);

  function restoreDraft() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.name) setName(d.name);
      if (d.accountId) setAccountId(d.accountId);
      if (d.mediaId) setMediaId(d.mediaId);
      if (d.mediaPermalink) setMediaPermalink(d.mediaPermalink);
      if (d.mediaType) setMediaType(d.mediaType);
      if (d.triggerType) setTriggerType(d.triggerType);
      if (d.keywords) setKeywords(d.keywords);
      if (d.publicReplyText) setPublicReplyText(d.publicReplyText);
      if (d.dmMessageText) setDmMessageText(d.dmMessageText);
      if (d.dmLink) setDmLink(d.dmLink);
      if (typeof d.followRequired === "boolean") setFollowRequired(d.followRequired);
      if (d.followInstructionText) setFollowInstructionText(d.followInstructionText);
      if (d.followSuccessText) setFollowSuccessText(d.followSuccessText);
      if (d.followFallbackText) setFollowFallbackText(d.followFallbackText);
      setHasRestoredDraft(false);
    } catch {
      // ignore
    }
  }

  function discardDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
      setHasRestoredDraft(false);
    } catch {
      // ignore
    }
  }



  function handleAddKeyword() {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (!keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    setKeywordInput("");
  }

  function handleRemoveKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw));
  }

  function validateCurrentStep(): boolean {
    setValidationError(null);
    if (step === 1) {
      if (!allMedia && !mediaId) {
        setValidationError("Please select an Instagram post/reel or choose All Posts & Reels.");
        return false;
      }
    }
    if (step === 3) {
      if (!name.trim()) {
        setValidationError("Please give your automation a name.");
        return false;
      }
      if (triggerType === "KEYWORD" && keywords.length === 0) {
        setValidationError("Please add at least one trigger keyword.");
        return false;
      }
    }
    if (step === 4) {
      if (!publicReplyText.trim()) {
        setValidationError("Please provide a public comment reply message.");
        return false;
      }
      if (!dmMessageText.trim()) {
        setValidationError("Please provide a private DM message.");
        return false;
      }
    }
    if (step === 5) {
      if (followRequired && !followInstructionText.trim()) {
        setValidationError("Please provide follow instruction text for the DM.");
        return false;
      }
      if (dmLink && !/^https?:\/\//i.test(dmLink)) {
        setValidationError("Target Link must be a valid URL starting with http:// or https://");
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (validateCurrentStep()) {
      setStep((prev) => Math.min(prev + 1, 6));
    }
  }

  function handleBack() {
    setValidationError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  }

  async function handleFinalSubmit(activateNow: boolean) {
    if (!validateCurrentStep()) return;

    const effectiveAccountId =
      accountId ||
      initialData?.instagramAccountId ||
      (discoveredAccounts.length > 0 ? discoveredAccounts[0].id : "");

    const payload: CreateAutomationPayload = {
      instagramAccountId: effectiveAccountId,
      name: name.trim(),
      mediaId: allMedia ? null : mediaId,
      mediaPermalink: allMedia ? null : mediaPermalink || undefined,
      mediaType: allMedia ? null : mediaType,
      triggerType,
      keywordMatchMode: triggerType === "ANY_COMMENT" ? "ANY" : keywordMatchMode,
      keywords: triggerType === "KEYWORD" ? keywords : [],
      publicReplyText: publicReplyText.trim(),
      publicReplyVariations,
      dmMessageText: dmMessageText.trim(),
      dmLink: dmLink.trim() || undefined,
      deliveryMode: followRequired ? "BUTTON" : deliveryMode,
      buttonLabel:
        followRequired || deliveryMode === "BUTTON"
          ? buttonLabel.trim().slice(0, 20) || undefined
          : undefined,
      cooldownSeconds,
      dmMeFallbackEnabled,
      followRequired,
      followInstructionText: followRequired ? followInstructionText.trim() : undefined,
      followSuccessText: followRequired ? followSuccessText.trim() : undefined,
      followFallbackText: followRequired ? followFallbackText.trim() : undefined,
      templateId: selectedTemplateId || undefined,
    };

    try {
      await onSubmit(payload, activateNow);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
    } catch {
      // error handled by parent
    }
  }

  const effectiveAccountId =
    accountId ||
    initialData?.instagramAccountId ||
    (discoveredAccounts.length > 0 ? discoveredAccounts[0].id : "");
  const selectedAccount = discoveredAccounts.find((a) => a.id === effectiveAccountId);
  const accountUsername = selectedAccount?.username || "your_brand";

  const STEPS = [
    { num: 1, label: "Select Media" },
    { num: 2, label: "Template" },
    { num: 3, label: "Trigger" },
    { num: 4, label: "Responses" },
    { num: 5, label: "Follow Gate" },
    { num: 6, label: "Launch" },
  ];

  return (
    <div className="space-y-6">
      {/* Draft Restore Notification */}
      {hasRestoredDraft && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>You have an auto-saved automation draft. Would you like to restore it?</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="primary" onClick={restoreDraft} className="text-xs py-1">
              Restore Draft
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={discardDraft} className="text-xs py-1 text-zinc-500">
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* 6-Step Stepper Header */}
      <div className="bg-white rounded-xl border border-zinc-200/80 p-3 shadow-2xs">
        <div className="flex items-center justify-between overflow-x-auto pb-1 sm:pb-0">
          {STEPS.map((s, idx) => {
            const isDone = s.num < step;
            const isCurrent = s.num === step;
            return (
              <React.Fragment key={s.num}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < step) setStep(s.num);
                  }}
                  disabled={s.num > step}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : isDone
                      ? "text-zinc-800 hover:bg-zinc-100 cursor-pointer"
                      : "text-zinc-400 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCurrent
                        ? "bg-white text-indigo-700"
                        : isDone
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : s.num}
                  </span>
                  <span className="whitespace-nowrap">{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className="h-px w-4 sm:w-8 bg-zinc-200 shrink-0 mx-1" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {validationError}
        </div>
      )}

      {/* STEP 1: SELECT MEDIA */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Step 1: Choose Post, Reel, or All Media</h3>
              <p className="text-xs text-zinc-500">
                Pick a specific post/Reel, or apply to all posts & Reels. Media-specific rules always take precedence over all-media rules.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={allMedia ? "primary" : "secondary"}
                onClick={() => {
                  setAllMedia(true);
                  setMediaId("");
                  setValidationError(null);
                  setStep(2);
                }}
              >
                All Posts &amp; Reels
              </Button>
              {mediaId && !allMedia && (
                <>
                  <Badge variant="green" className="text-xs">
                    Post Selected: ID {mediaId.slice(-6)}
                  </Badge>
                  <Button size="sm" variant="primary" onClick={handleNext}>
                    Continue to Template <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <MediaGrid
            initialAccountId={accountId}
            selectedMediaId={allMedia ? "" : mediaId}
            onSelectForAutomation={(media) => {
              setAllMedia(false);
              setMediaId(media.id);
              if (media.permalink) setMediaPermalink(media.permalink);
              setMediaType(
                media.media_product_type === "REELS" || media.media_type === "VIDEO"
                  ? "REELS"
                  : media.media_type
              );
              setSelectedMediaPreview(media);
              setValidationError(null);
              // advance
              setStep(2);
            }}
          />
        </div>
      )}

      {/* STEP 2: CHOOSE TEMPLATE */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Step 2: Choose Strategy Template</h3>
              <p className="text-xs text-zinc-500">
                Select a high-converting comment-to-DM template, or start with a custom blank canvas.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedTemplateId(null);
                handleNext();
              }}
            >
              Skip / Blank Canvas
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                isSelected={selectedTemplateId === tmpl.id}
                onSelect={(selected) => {
                  applyTemplate(selected);
                  handleNext();
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: CONFIGURE TRIGGER */}
      {step === 3 && (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-5 shadow-2xs">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Step 3: Trigger Settings</h3>
            <p className="text-xs text-zinc-500">
              Define the name and decide which comments trigger automated responses.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="auto-name" className="block text-xs font-medium text-zinc-700 mb-1">
                Automation Name *
              </label>
              <Input
                id="auto-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summer Launch Discount Delivery"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-2">
                Trigger Type *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTriggerType("KEYWORD")}
                  className={`flex flex-col p-3.5 rounded-xl border text-left transition-all ${
                    triggerType === "KEYWORD"
                      ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <span className="text-xs font-semibold text-zinc-900">Specific Keyword(s)</span>
                  <span className="text-[11px] text-zinc-500 mt-1">
                    Triggers only when a comment contains specific words like &ldquo;LINK&rdquo; or &ldquo;DEAL&rdquo;.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTriggerType("ANY_COMMENT")}
                  className={`flex flex-col p-3.5 rounded-xl border text-left transition-all ${
                    triggerType === "ANY_COMMENT"
                      ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <span className="text-xs font-semibold text-zinc-900">Any Comment</span>
                  <span className="text-[11px] text-zinc-500 mt-1">
                    Triggers for every valid incoming comment on this post.
                  </span>
                </button>
              </div>
            </div>

            {triggerType === "KEYWORD" && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-700">Match Mode:</span>
                  {(["CONTAINS", "EXACT"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setKeywordMatchMode(mode)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer ${
                        keywordMatchMode === mode
                          ? "bg-[#17131D] text-white border-[#17131D]"
                          : "bg-white text-zinc-600 border-zinc-200"
                      }`}
                    >
                      {mode === "CONTAINS" ? "Contains word" : "Exact match"}
                    </button>
                  ))}
                </div>
                <label className="block text-xs font-medium text-zinc-700">
                  Target Keywords (Press Enter to add)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="Type keyword e.g. LINK, PROMO, INFO"
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={handleAddKeyword}>
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="blue" className="gap-1 text-xs py-1 px-2.5">
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="hover:text-red-600"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: CRAFT RESPONSES */}
      {step === 4 && (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-5 shadow-2xs">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Step 4: Craft Automated Copy</h3>
            <p className="text-xs text-zinc-500">
              Personalize your public comment reply and initial direct message using dynamic placeholder tags.
            </p>
          </div>

          {/* Variable chips */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-200/80 text-[11px]">
            <span className="font-medium text-zinc-600">Available Variables:</span>
            <button
              type="button"
              onClick={() => setPublicReplyText((prev) => prev + " {{username}}")}
              className="font-mono bg-white border border-zinc-300 rounded px-1.5 py-0.5 text-zinc-700 hover:border-indigo-500"
            >
              {"{{username}}"}
            </button>
            <button
              type="button"
              onClick={() => setDmMessageText((prev) => prev + " {{first_name}}")}
              className="font-mono bg-white border border-zinc-300 rounded px-1.5 py-0.5 text-zinc-700 hover:border-indigo-500"
            >
              {"{{first_name}}"}
            </button>
            <button
              type="button"
              onClick={() => setDmMessageText((prev) => prev + " {{link}}")}
              className="font-mono bg-white border border-zinc-300 rounded px-1.5 py-0.5 text-zinc-700 hover:border-indigo-500"
            >
              {"{{link}}"}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
                  Public Comment Reply *
                </label>
                <span className="text-[10px] text-zinc-400">{publicReplyText.length}/500</span>
              </div>
              <Textarea
                rows={2}
                value={publicReplyText}
                onChange={(e) => setPublicReplyText(e.target.value)}
                placeholder="Check your DMs {{username}}! Sent it your way 🔥"
                maxLength={500}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-indigo-500" />
                  Private Direct Message (DM) *
                </label>
                <span className="text-[10px] text-zinc-400">{dmMessageText.length}/2000</span>
              </div>
              <Textarea
                rows={4}
                value={dmMessageText}
                onChange={(e) => setDmMessageText(e.target.value)}
                placeholder="Hey {{first_name}}! Thanks for asking. Here is the link:"
                maxLength={2000}
                required
              />
            </div>

            {/* Public Reply Variations */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="block text-xs font-medium text-zinc-700">
                Public Reply Variations (Optional — rotated automatically to stay natural)
              </label>
              <div className="flex gap-2">
                <Input
                  value={variationInput}
                  onChange={(e) => setVariationInput(e.target.value)}
                  placeholder="e.g. Check your DM requests! 💌"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const v = variationInput.trim();
                    if (v && !publicReplyVariations.includes(v)) {
                      setPublicReplyVariations([...publicReplyVariations, v]);
                    }
                    setVariationInput("");
                  }}
                >
                  Add Variation
                </Button>
              </div>
              {publicReplyVariations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {publicReplyVariations.map((v) => (
                    <Badge key={v} variant="gray" className="gap-1 text-xs py-1 px-2.5">
                      <span>{v}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPublicReplyVariations(
                            publicReplyVariations.filter((item) => item !== v)
                          )
                        }
                        className="hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: FOLLOW GATE & LINK */}
      {step === 5 && (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-5 shadow-2xs">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Step 5: Follow Gate & Destination Link</h3>
            <p className="text-xs text-zinc-500">
              Deliver your resource link directly, or activate Follow-to-Get-Link to grow your followership.
            </p>
          </div>

          <div>
            <label htmlFor="target-link" className="block text-xs font-medium text-zinc-700 mb-1">
              Destination URL (Optional)
            </label>
            <Input
              id="target-link"
              type="url"
              value={dmLink}
              onChange={(e) => setDmLink(e.target.value)}
              placeholder="https://yourwebsite.com/resource"
            />
          </div>

          {/* Delivery Mode, Cooldown & DM-me Fallback */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                DM Delivery Mode
              </label>
              <select
                value={followRequired ? "BUTTON" : deliveryMode}
                disabled={followRequired}
                onChange={(e) => setDeliveryMode(e.target.value as "DIRECT" | "BUTTON")}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900"
              >
                <option value="DIRECT">Direct (send link in first DM)</option>
                <option value="BUTTON">Two-Step Button (hook DM + tap to unlock)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                Per-User Cooldown (seconds)
              </label>
              <Input
                type="number"
                min={0}
                max={86400}
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          {(followRequired || deliveryMode === "BUTTON") && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Quick Reply Button Label (max 20 characters — Meta limit)
              </label>
              <Input
                maxLength={20}
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                placeholder="Send me the link"
              />
            </div>
          )}

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-zinc-900">
                Enable &ldquo;DM me&rdquo; Public Reply Fallback (Opt-in)
              </p>
              <p className="text-[11px] text-zinc-500">
                Invites commenters to DM your keyword if Meta blocks the initial private reply.
              </p>
            </div>
            <input
              type="checkbox"
              checked={dmMeFallbackEnabled}
              onChange={(e) => setDmMeFallbackEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 cursor-pointer"
            />
          </label>

          {/* Follow-to-Get-Link Toggle Card */}
          <div
            className={`rounded-xl border p-4 transition-all ${
              followRequired ? "border-purple-300 bg-purple-50/40" : "border-zinc-200 bg-zinc-50/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    followRequired ? "bg-purple-600 text-white" : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-900">
                    Require Follow before Link Delivery (Follow-to-Get-Link)
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Requires user to follow your Instagram account before receiving the link.
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={followRequired}
                onChange={(e) => setFollowRequired(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            {followRequired && (
              <div className="mt-4 pt-4 border-t border-purple-200/60 space-y-3.5">
                <div className="rounded-lg bg-white/80 border border-purple-200 p-2.5 text-[11px] text-purple-900 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>
                    <strong>Meta Compliant Two-Stage Flow:</strong> Initial DM sends an interactive
                    &ldquo;I&apos;ve followed! ✅&rdquo; Quick Reply button. When tapped, Replyza verifies follower
                    status and dispatches the link.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Instruction Copy (Sent with Quick Reply button)
                  </label>
                  <Textarea
                    rows={2}
                    value={followInstructionText}
                    onChange={(e) => setFollowInstructionText(e.target.value)}
                    placeholder="Hey {{first_name}}! Thanks for commenting. Follow our page and tap the button below to get your link instantly! 👇"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Success Copy (Sent once follower status is verified)
                  </label>
                  <Textarea
                    rows={2}
                    value={followSuccessText}
                    onChange={(e) => setFollowSuccessText(e.target.value)}
                    placeholder="Woohoo! Thanks for following {{first_name}} 🎉 Here is your link:"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Fallback Copy (Sent if user taps button without following)
                  </label>
                  <Textarea
                    rows={2}
                    value={followFallbackText}
                    onChange={(e) => setFollowFallbackText(e.target.value)}
                    placeholder="Looks like you aren't following us yet! Follow our profile and tap the button below to get your link."
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 6: LIVE PREVIEW & LAUNCH */}
      {step === 6 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Summary Checklist */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{name || "Untitled Automation"}</h3>
                    <p className="text-xs text-zinc-500">@{accountUsername}</p>
                  </div>
                  <Badge variant={triggerType === "KEYWORD" ? "blue" : "gray"}>
                    {triggerType === "KEYWORD" ? "Keyword Trigger" : "Any Comment"}
                  </Badge>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start justify-between">
                    <span className="text-zinc-500">Target Media:</span>
                    <span className="font-mono text-zinc-800 text-[11px] truncate max-w-[200px]">
                      {mediaId}
                    </span>
                  </div>

                  {triggerType === "KEYWORD" && (
                    <div className="flex items-start justify-between">
                      <span className="text-zinc-500">Keywords:</span>
                      <div className="flex flex-wrap gap-1 justify-end max-w-[220px]">
                        {keywords.map((k) => (
                          <span key={k} className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <span className="text-zinc-500">Follow-to-Get-Link:</span>
                    <span className="font-medium text-zinc-800">
                      {followRequired ? "Enabled (Follower check required)" : "Disabled (Direct delivery)"}
                    </span>
                  </div>

                  {dmLink && (
                    <div className="flex items-start justify-between">
                      <span className="text-zinc-500">Link URL:</span>
                      <a
                        href={dmLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 underline font-medium truncate max-w-[200px]"
                      >
                        {dmLink}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Ready to launch banner */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold">All requirements satisfied!</p>
                  <p className="text-emerald-700 text-[11px]">
                    Once activated, Replyza will immediately begin listening for comments on this post.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Live Interactive Phone Simulator */}
            <div className="lg:col-span-5">
              <LivePreview
                accountUsername={accountUsername}
                publicReplyText={publicReplyText}
                dmMessageText={dmMessageText}
                dmLink={dmLink}
                triggerType={triggerType}
                keywords={keywords}
                followRequired={followRequired}
                followInstructionText={followInstructionText}
                followSuccessText={followSuccessText}
                followFallbackText={followFallbackText}
                mediaThumbnailUrl={selectedMediaPreview?.thumbnail_url || selectedMediaPreview?.media_url}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-zinc-200/80 shadow-2xs">
        <div>
          {step > 1 && (
            <Button type="button" variant="secondary" size="sm" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step < 6 ? (
            <Button type="button" variant="primary" size="sm" onClick={handleNext}>
              Next Step <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleFinalSubmit(false)}
                disabled={isSubmitting}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleFinalSubmit(true)}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? "Activating..." : "Activate Automation"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
