"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  AffiliateProduct,
  AutomationProductItem,
  CreateAutomationPayload,
  DeliveryMode,
  InstagramAccountInfo,
  InstagramMedia,
  KeywordMatchLogic,
  KeywordMatchMode,
  ProductDeliveryMode,
  Template,
} from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MediaGrid } from "@/components/media/media-grid";
import { LivePreview } from "./live-preview";
import { DmTemplatePicker } from "./dm-template-picker";
import { ProductSelectorStep } from "./product-selector-step";
import { apiRequest } from "@/lib/api-client";
import { validateTemplateVariables } from "@replyza/shared";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  MousePointerClick,
  Rocket,
  Save,
  Send,
  ShoppingBag,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";

const DRAFT_KEY = "replyza_builder_draft_v2";

interface BuilderWizardProps {
  discoveredAccounts: InstagramAccountInfo[];
  initialData?: Partial<CreateAutomationPayload> & {
    id?: string;
    status?: string;
  };
  onSubmit: (data: CreateAutomationPayload, activateNow: boolean) => Promise<void>;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

const STEPS = [
  { id: "step-trigger", num: 1, label: "Trigger" },
  { id: "step-condition", num: 2, label: "Keywords" },
  { id: "step-public-reply", num: 3, label: "Public Reply" },
  { id: "step-opening-dm", num: 4, label: "Opening DM" },
  { id: "step-button", num: 5, label: "Button" },
  { id: "step-products", num: 6, label: "Products" },
  { id: "step-followup", num: 7, label: "Follow-up" },
];

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

  // Step 2: Comment condition
  const [triggerType, setTriggerType] = useState<"ANY_COMMENT" | "KEYWORD">(
    initialData?.triggerType || "KEYWORD"
  );
  const [keywordMatchMode, setKeywordMatchMode] = useState<KeywordMatchMode>(
    initialData?.keywordMatchMode || "CONTAINS"
  );
  const [keywordMatchLogic, setKeywordMatchLogic] = useState<KeywordMatchLogic>(
    initialData?.keywordMatchLogic || "ANY_KEYWORD"
  );
  const [keywords, setKeywords] = useState<string[]>(initialData?.keywords || ["LINK"]);
  const [keywordInput, setKeywordInput] = useState<string>("");

  // Step 3: Public reply
  const [publicReplyEnabled, setPublicReplyEnabled] = useState<boolean>(
    initialData?.publicReplyEnabled ?? true
  );
  const [publicReplyText, setPublicReplyText] = useState<string>(
    initialData?.publicReplyText || "Check your DMs {{username}}! Sent it your way 🔥"
  );
  const [publicReplyVariations, setPublicReplyVariations] = useState<string[]>(
    initialData?.publicReplyVariations || []
  );
  const [variationInput, setVariationInput] = useState<string>("");

  // Step 4: Opening DM & Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    () => searchParams.get("templateId") || initialData?.templateId || null
  );
  const [dmMessageText, setDmMessageText] = useState<string>(
    initialData?.dmMessageText ||
      "Hey {{first_name}}! 😊 Thanks for commenting! Here's what you asked for:"
  );

  // Step 5: Button / User interaction
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
      "Hey {{first_name}}! Thanks for commenting. Follow our page and tap below to get your links instantly! 👇"
  );
  const [followSuccessText, setFollowSuccessText] = useState<string>(
    initialData?.followSuccessText ||
      "Woohoo! Thanks for following {{first_name}} 🎉 Here are your links:"
  );
  const [followFallbackText, setFollowFallbackText] = useState<string>(
    initialData?.followFallbackText ||
      "Looks like you aren't following us yet! Please follow our profile and tap the button below."
  );

  // Step 6: Products & Delivery
  const [libraryProducts, setLibraryProducts] = useState<AffiliateProduct[]>([]);
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
  const [productDeliveryMode, setProductDeliveryMode] = useState<ProductDeliveryMode>(
    initialData?.productDeliveryMode || "SINGLE_MESSAGE"
  );
  const [productIntroText, setProductIntroText] = useState<string>(
    initialData?.productIntroText || ""
  );
  const [productClosingText, setProductClosingText] = useState<string>(
    initialData?.productClosingText || ""
  );

  // Step 7: Follow-up & Advanced
  const [followUpEnabled, setFollowUpEnabled] = useState<boolean>(
    initialData?.followUpEnabled ?? false
  );
  const [followUpText, setFollowUpText] = useState<string>(
    initialData?.followUpText || "Let me know if you need any help choosing! 😊"
  );
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(
    initialData?.cooldownSeconds ?? 0
  );
  const [dmMeFallbackEnabled, setDmMeFallbackEnabled] = useState<boolean>(
    initialData?.dmMeFallbackEnabled ?? false
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
    if (tmpl.followInstructionText) setFollowInstructionText(tmpl.followInstructionText);
    if (tmpl.followSuccessText) setFollowSuccessText(tmpl.followSuccessText);
    if (tmpl.followFallbackText) setFollowFallbackText(tmpl.followFallbackText);
    toast.success(`Applied "${tmpl.name}" template`);
  }, []);

  useEffect(() => {
    let ignore = false;
    const qTemplateId = searchParams.get("templateId");

    Promise.all([
      apiRequest<Template[]>("/templates"),
      apiRequest<AffiliateProduct[]>("/products").catch(() => ({ data: [] as AffiliateProduct[] })),
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

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (!keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    setKeywordInput("");
  };

  const handleAddVariation = () => {
    const trimmed = variationInput.trim();
    if (!trimmed) return;
    if (publicReplyVariations.length >= 10) {
      toast.error("Maximum 10 reply variations.");
      return;
    }
    setPublicReplyVariations([...publicReplyVariations, trimmed]);
    setVariationInput("");
  };

  const buildPayload = (): CreateAutomationPayload | null => {
    setValidationError(null);

    if (!accountId) {
      setValidationError("Please connect and select an Instagram account first.");
      return null;
    }
    if (!allMedia && !mediaId) {
      setValidationError("Step 1: Select an Instagram post/Reel or choose All Posts & Reels.");
      return null;
    }
    if (!name.trim()) {
      setValidationError("Please give your automation a name.");
      return null;
    }
    if (triggerType === "KEYWORD" && keywordMatchMode !== "ANY" && keywords.length === 0) {
      setValidationError("Step 2: Add at least one comment keyword.");
      return null;
    }
    if (publicReplyEnabled && !publicReplyText.trim()) {
      setValidationError("Step 3: Enter a public comment reply or disable public replies.");
      return null;
    }
    if (!dmMessageText.trim()) {
      setValidationError("Step 4: Enter your opening/delivery DM message.");
      return null;
    }

    for (const [label, val] of [
      ["Public Reply", publicReplyEnabled ? publicReplyText : ""],
      ["Opening DM", dmMessageText],
      ["Product Intro", productIntroText],
      ["Product Closing", productClosingText],
      ["Follow-up", followUpEnabled ? followUpText : ""],
    ]) {
      const check = validateTemplateVariables(val);
      if (!check.valid) {
        setValidationError(
          `${label} contains unsupported variable(s): ${check.unsupportedVariables
            .map((v) => `{{${v}}}`)
            .join(", ")}`
        );
        return null;
      }
    }

    const effectiveDeliveryMode: DeliveryMode = followRequired ? "BUTTON" : deliveryMode;

    return {
      instagramAccountId: accountId,
      name: name.trim(),
      mediaId: allMedia ? null : mediaId,
      mediaPermalink: allMedia ? null : mediaPermalink || null,
      mediaType: allMedia ? null : mediaType,
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
      buttonLabel: effectiveDeliveryMode === "BUTTON" ? buttonLabel.trim() || "Send me the links" : null,
      cooldownSeconds,
      dmMeFallbackEnabled,
      followRequired,
      followInstructionText: followRequired ? followInstructionText.trim() : null,
      followSuccessText: followRequired ? followSuccessText.trim() : null,
      followFallbackText: followRequired ? followFallbackText.trim() : null,
      followUpEnabled,
      followUpText: followUpEnabled ? followUpText.trim() : null,
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

  return (
    <div className="space-y-5">
      {/* Top Bar: Name + Step Jump Pills + Save Actions */}
      <div className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Automation name (e.g. Skincare Haul Links)"
              aria-label="Automation name"
            />
            {discoveredAccounts.length > 0 && (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={isEditMode}
                className="rounded-xl border border-[#17131D]/15 bg-[#FFFDFB] px-3.5 py-2 text-sm text-[#17131D] focus:border-[#17131D] focus:outline-none disabled:opacity-60"
              >
                {discoveredAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username || acc.instagramUserId}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSave(false)}
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {isEditMode ? "Save Changes" : "Save Draft"}
            </Button>
            {!isEditMode && (
              <Button
                type="button"
                variant="gradient"
                size="sm"
                onClick={() => handleSave(true)}
                isLoading={isSubmitting}
                className="gap-1.5"
              >
                <Rocket className="h-3.5 w-3.5" />
                Save &amp; Activate
              </Button>
            )}
          </div>
        </div>

        {/* Step Jump Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {STEPS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8F5F8] hover:bg-[#17131D] hover:text-white px-2.5 py-1 text-[11px] font-medium text-[#17131D] transition-colors shrink-0"
            >
              <span className="font-mono text-[10px] opacity-60">{s.num}.</span>
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {validationError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Mobile Preview Toggle */}
      <div className="lg:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setMobilePreviewOpen((v) => !v)}
          className="w-full justify-center gap-2"
        >
          {mobilePreviewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {mobilePreviewOpen ? "Hide Live DM Preview" : "Show Live DM Preview"}
        </Button>
        {mobilePreviewOpen && (
          <div className="mt-3">
            <LivePreview
              accountUsername={activeAccount?.username || "your_brand"}
              publicReplyEnabled={publicReplyEnabled}
              publicReplyText={publicReplyText}
              dmMessageText={dmMessageText}
              dmLink={products[0]?.affiliateUrl || initialData?.dmLink}
              triggerType={triggerType}
              keywords={keywords}
              deliveryMode={followRequired ? "BUTTON" : deliveryMode}
              buttonLabel={buttonLabel}
              followRequired={followRequired}
              followInstructionText={followInstructionText}
              followSuccessText={followSuccessText}
              followUpEnabled={followUpEnabled}
              followUpText={followUpText}
              products={products}
              productDeliveryMode={productDeliveryMode}
              productIntroText={productIntroText}
              productClosingText={productClosingText}
              mediaThumbnailUrl={selectedMediaPreview?.thumbnail_url || selectedMediaPreview?.media_url}
            />
          </div>
        )}
      </div>

      {/* Main 2-Column Builder Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* LEFT COLUMN: 7 Workflow Step Cards */}
        <div className="space-y-5 min-w-0">
          {/* STEP 1: Trigger (Post / Reel) */}
          <section
            id="step-trigger"
            className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#17131D] text-white text-xs font-bold">
                  1
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#17131D]">
                    Trigger — Select Post or Reel
                  </h2>
                  <p className="text-[11px] text-[#827D87]">
                    Choose a specific post/Reel or trigger on any post on your account.
                  </p>
                </div>
              </div>
              <ImageIcon className="h-4 w-4 text-[#827D87]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setAllMedia(false)}
                className={`text-left rounded-xl border p-3 transition-all cursor-pointer disabled:opacity-60 ${
                  !allMedia
                    ? "border-[#17131D] bg-[#F8F5F8] ring-1 ring-[#17131D]/15"
                    : "border-[#17131D]/10 bg-white"
                }`}
              >
                <div className="text-xs font-semibold text-[#17131D]">Specific Post or Reel</div>
                <p className="text-[11px] text-[#827D87] mt-0.5">
                  Ideal for product hauls, tutorials, or single-post campaigns.
                </p>
              </button>
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => {
                  setAllMedia(true);
                  setMediaId("");
                }}
                className={`text-left rounded-xl border p-3 transition-all cursor-pointer disabled:opacity-60 ${
                  allMedia
                    ? "border-[#17131D] bg-[#F8F5F8] ring-1 ring-[#17131D]/15"
                    : "border-[#17131D]/10 bg-white"
                }`}
              >
                <div className="text-xs font-semibold text-[#17131D]">Any Post or Reel</div>
                <p className="text-[11px] text-[#827D87] mt-0.5">
                  Catches matching comments across all your posts (1 active per account).
                </p>
              </button>
            </div>

            {!allMedia && accountId && !isEditMode && (
              <MediaGrid
                initialAccountId={accountId}
                selectedMediaId={mediaId}
                onSelectForAutomation={(m: InstagramMedia) => {
                  setMediaId(m.id);
                  setMediaPermalink(m.permalink || "");
                  setMediaType(
                    m.media_product_type === "REELS" ? "REELS" : m.media_type
                  );
                  setSelectedMediaPreview(m);
                }}
              />
            )}

            {isEditMode && (
              <div className="rounded-xl bg-[#F8F5F8] px-3.5 py-2.5 text-xs text-[#827D87]">
                Target:{" "}
                <strong className="text-[#17131D]">
                  {allMedia ? "All Posts & Reels" : `Media ID ${mediaId}`}
                </strong>{" "}
                (post target is locked after creation)
              </div>
            )}
          </section>

          {/* STEP 2: Comment Condition */}
          <section
            id="step-condition"
            className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#17131D] text-white text-xs font-bold">
                  2
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#17131D]">
                    Comment Condition
                  </h2>
                  <p className="text-[11px] text-[#827D87]">
                    Define which comments trigger this automation.
                  </p>
                </div>
              </div>
              <Hash className="h-4 w-4 text-[#827D87]" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTriggerType("KEYWORD")}
                className={`rounded-xl border p-3 text-left text-xs font-semibold cursor-pointer ${
                  triggerType === "KEYWORD"
                    ? "border-[#17131D] bg-[#F8F5F8]"
                    : "border-[#17131D]/10 bg-white text-[#827D87]"
                }`}
              >
                Specific Keywords
              </button>
              <button
                type="button"
                onClick={() => setTriggerType("ANY_COMMENT")}
                className={`rounded-xl border p-3 text-left text-xs font-semibold cursor-pointer ${
                  triggerType === "ANY_COMMENT"
                    ? "border-[#17131D] bg-[#F8F5F8]"
                    : "border-[#17131D]/10 bg-white text-[#827D87]"
                }`}
              >
                Any Comment
              </button>
            </div>

            {triggerType === "KEYWORD" && (
              <div className="space-y-3">
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
                    placeholder="Add keyword (e.g. LINK, SHOP, PRICE)"
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddKeyword}>
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#17131D] text-white px-2.5 py-1 text-xs font-medium"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => setKeywords(keywords.filter((k) => k !== kw))}
                        className="opacity-70 hover:opacity-100 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-[#17131D] block mb-1">
                      Match Style
                    </label>
                    <select
                      value={keywordMatchMode}
                      onChange={(e) => setKeywordMatchMode(e.target.value as KeywordMatchMode)}
                      className="w-full rounded-xl border border-[#17131D]/15 bg-white px-3 py-2 text-xs text-[#17131D]"
                    >
                      <option value="CONTAINS">Contains keyword (recommended)</option>
                      <option value="EXACT">Exact comment match</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#17131D] block mb-1">
                      Matching Logic
                    </label>
                    <select
                      value={keywordMatchLogic}
                      onChange={(e) => setKeywordMatchLogic(e.target.value as KeywordMatchLogic)}
                      className="w-full rounded-xl border border-[#17131D]/15 bg-white px-3 py-2 text-xs text-[#17131D]"
                    >
                      <option value="ANY_KEYWORD">Match ANY selected keyword</option>
                      <option value="ALL_KEYWORDS">Match ALL keywords</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 3: Public Comment Reply */}
          <section
            id="step-public-reply"
            className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#17131D] text-white text-xs font-bold">
                  3
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#17131D]">
                    Public Comment Reply (Optional)
                  </h2>
                  <p className="text-[11px] text-[#827D87]">
                    Reply publicly under the user&apos;s comment to boost engagement.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-[#17131D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={publicReplyEnabled}
                  onChange={(e) => setPublicReplyEnabled(e.target.checked)}
                />
                Enabled
              </label>
            </div>

            {publicReplyEnabled && (
              <div className="space-y-3">
                <Input
                  label="Primary Public Reply"
                  value={publicReplyText}
                  onChange={(e) => setPublicReplyText(e.target.value)}
                  placeholder="Sent you a DM! ❤️"
                />

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[#827D87]">
                    Reply Variations (optional, rotates to avoid spam)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={variationInput}
                      onChange={(e) => setVariationInput(e.target.value)}
                      placeholder="Add another variation (e.g. Check your inbox {{username}}!)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddVariation}
                    >
                      Add
                    </Button>
                  </div>
                  {publicReplyVariations.length > 0 && (
                    <div className="space-y-1">
                      {publicReplyVariations.map((v, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-[#F8F5F8] px-3 py-1.5 text-xs"
                        >
                          <span className="truncate">{v}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setPublicReplyVariations(
                                publicReplyVariations.filter((_, idx) => idx !== i)
                              )
                            }
                            className="text-[#827D87] hover:text-red-600 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* STEP 4: Opening DM & Template Library */}
          <section
            id="step-opening-dm"
            className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#17131D] text-white text-xs font-bold">
                  4
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#17131D]">
                    Opening DM &amp; Template Library
                  </h2>
                  <p className="text-[11px] text-[#827D87]">
                    Pick a template style or write your own with dynamic variables.
                  </p>
                </div>
              </div>
              <MessageSquare className="h-4 w-4 text-[#827D87]" />
            </div>

            <DmTemplatePicker
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={applyTemplate}
              onTemplateCreated={(t) => {
                setTemplates((prev) => [t, ...prev]);
                setSelectedTemplateId(t.id);
              }}
              dmMessageText={dmMessageText}
              onChangeDmMessageText={setDmMessageText}
              publicReplyText={publicReplyText}
              triggerType={triggerType}
              keywords={keywords}
            />
          </section>

          {/* STEP 5: Button / User Interaction */}
          <section
            id="step-button"
            className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#17131D] text-white text-xs font-bold">
                  5
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#17131D]">
                    Button &amp; User Interaction
                  </h2>
                  <p className="text-[11px] text-[#827D87]">
                    Require a Quick Reply tap first (unlocks Visual Cards &amp; Follow Gate) or send directly.
                  </p>
                </div>
              </div>
              <MousePointerClick className="h-4 w-4 text-[#827D87]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDeliveryMode("DIRECT");
                  setFollowRequired(false);
                }}
                className={`text-left rounded-xl border p-3 cursor-pointer ${
                  deliveryMode === "DIRECT" && !followRequired
                    ? "border-[#17131D] bg-[#F8F5F8] ring-1 ring-[#17131D]/15"
                    : "border-[#17131D]/10 bg-white"
                }`}
              >
                <div className="text-xs font-semibold text-[#17131D]">Direct Private Reply</div>
                <p className="text-[11px] text-[#827D87] mt-0.5">
                  Sends product links immediately in 1 message.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("BUTTON")}
                className={`text-left rounded-xl border p-3 cursor-pointer ${
                  deliveryMode === "BUTTON" || followRequired
                    ? "border-[#17131D] bg-[#F8F5F8] ring-1 ring-[#17131D]/15"
                    : "border-[#17131D]/10 bg-white"
                }`}
              >
                <div className="text-xs font-semibold text-[#17131D]">
                  Interactive Quick Reply Button
                </div>
                <p className="text-[11px] text-[#827D87] mt-0.5">
                  User taps a button first, unlocking multi-DM &amp; Product Cards.
                </p>
              </button>
            </div>

            {(deliveryMode === "BUTTON" || followRequired) && (
              <div className="space-y-3 pt-1">
                <Input
                  label="Quick Reply Button Text (max 20 chars — Meta limit)"
                  value={buttonLabel}
                  onChange={(e) => setButtonLabel(e.target.value)}
                  maxLength={20}
                  placeholder="Send me the links"
                />

                <label className="flex items-start gap-2.5 rounded-xl border border-[#17131D]/10 bg-[#F8F5F8] p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followRequired}
                    onChange={(e) => {
                      setFollowRequired(e.target.checked);
                      if (e.target.checked) setDeliveryMode("BUTTON");
                    }}
                    className="mt-0.5"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-[#17131D] flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                      Require Follow Before Sending Links
                    </span>
                    <p className="text-[#827D87] mt-0.5">
                      Verifies follower status when the user taps the button.
                    </p>
                  </div>
                </label>

                {followRequired && (
                  <div className="space-y-3 pl-3 border-l-2 border-indigo-200">
                    <Textarea
                      label="Follow Instruction DM"
                      value={followInstructionText}
                      onChange={(e) => setFollowInstructionText(e.target.value)}
                      rows={2}
                    />
                    <Input
                      label="Follow Verified Success Intro"
                      value={followSuccessText}
                      onChange={(e) => setFollowSuccessText(e.target.value)}
                    />
                    <Input
                      label="Not Following Fallback DM"
                      value={followFallbackText}
                      onChange={(e) => setFollowFallbackText(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* STEP 6: Product Selection & Delivery */}
          <section
            id="step-products"
            className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#17131D] text-white text-xs font-bold">
                  6
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#17131D]">
                    Product Links &amp; Delivery Format
                  </h2>
                  <p className="text-[11px] text-[#827D87]">
                    Add one or multiple affiliate products, drag to reorder, and choose how they are sent.
                  </p>
                </div>
              </div>
              <ShoppingBag className="h-4 w-4 text-[#827D87]" />
            </div>

            <ProductSelectorStep
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
          </section>

          {/* STEP 7: Follow-up & Cooldown */}
          <section
            id="step-followup"
            className="rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#17131D] text-white text-xs font-bold">
                  7
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#17131D]">
                    Follow-up Message &amp; Protection
                  </h2>
                  <p className="text-[11px] text-[#827D87]">
                    Sent only within Meta&apos;s active 24-hour messaging window.
                  </p>
                </div>
              </div>
              <Send className="h-4 w-4 text-[#827D87]" />
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-[#17131D]/10 bg-[#F8F5F8] p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={followUpEnabled}
                onChange={(e) => setFollowUpEnabled(e.target.checked)}
                className="mt-0.5"
              />
              <div className="text-xs">
                <span className="font-semibold text-[#17131D]">
                  Send Follow-up Message (2-step DMs only)
                </span>
                <p className="text-[#827D87] mt-0.5">
                  Automatically sends a helpful closing message right after product links are delivered inside the 24h window.
                </p>
              </div>
            </label>

            {followUpEnabled && (
              <Input
                label="Follow-up Message"
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder="Let me know if you need any help choosing! 😊"
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-[#17131D] block mb-1">
                  Per-User Cooldown (seconds)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={86400}
                  value={cooldownSeconds}
                  onChange={(e) => setCooldownSeconds(Number(e.target.value) || 0)}
                />
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-[#17131D]/10 px-3 py-2 text-xs text-[#17131D] cursor-pointer self-end h-[38px]">
                <input
                  type="checkbox"
                  checked={dmMeFallbackEnabled}
                  onChange={(e) => setDmMeFallbackEnabled(e.target.checked)}
                />
                Enable DM-me keyword fallback
              </label>
            </div>
          </section>

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-between rounded-2xl border border-[#17131D]/10 bg-[#FFFDFB] p-4">
            <div className="flex items-center gap-2 text-xs text-[#827D87]">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{products.length} product(s) attached</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleSave(false)}
                isLoading={isSubmitting}
              >
                {isEditMode ? "Save Changes" : "Save Draft"}
              </Button>
              {!isEditMode && (
                <Button
                  type="button"
                  variant="gradient"
                  size="sm"
                  onClick={() => handleSave(true)}
                  isLoading={isSubmitting}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Save &amp; Activate
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Live Preview */}
        <div className="hidden lg:block sticky top-6">
          <LivePreview
            accountUsername={activeAccount?.username || "your_brand"}
            publicReplyEnabled={publicReplyEnabled}
            publicReplyText={publicReplyText}
            dmMessageText={dmMessageText}
            dmLink={products[0]?.affiliateUrl || initialData?.dmLink}
            triggerType={triggerType}
            keywords={keywords}
            deliveryMode={followRequired ? "BUTTON" : deliveryMode}
            buttonLabel={buttonLabel}
            followRequired={followRequired}
            followInstructionText={followInstructionText}
            followSuccessText={followSuccessText}
            followUpEnabled={followUpEnabled}
            followUpText={followUpText}
            products={products}
            productDeliveryMode={productDeliveryMode}
            productIntroText={productIntroText}
            productClosingText={productClosingText}
            mediaThumbnailUrl={selectedMediaPreview?.thumbnail_url || selectedMediaPreview?.media_url}
          />
        </div>
      </div>
    </div>
  );
}
