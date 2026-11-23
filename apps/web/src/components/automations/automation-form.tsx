"use client";

import React, { useState } from "react";
import {
  Automation,
  CreateAutomationPayload,
  UpdateAutomationPayload,
  AutomationTrigger,
  MediaType,
  InstagramAccountInfo,
} from "@/types/automation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { Plus, X, Info } from "lucide-react";

interface AutomationFormProps {
  initialData?: Automation;
  isEditMode?: boolean;
  discoveredAccounts?: InstagramAccountInfo[];
  onSubmit: (
    data: CreateAutomationPayload | UpdateAutomationPayload
  ) => Promise<void>;
  isLoading: boolean;
}

export function AutomationForm({
  initialData,
  isEditMode = false,
  discoveredAccounts = [],
  onSubmit,
  isLoading,
}: AutomationFormProps) {
  // Form state
  const [name, setName] = useState(initialData?.name || "");
  const [instagramAccountId, setInstagramAccountId] = useState(
    initialData?.instagramAccountId ||
      (discoveredAccounts.length > 0 ? discoveredAccounts[0].id : "")
  );
  const [mediaId, setMediaId] = useState(initialData?.mediaId || "");
  const [mediaPermalink, setMediaPermalink] = useState(
    initialData?.mediaPermalink || ""
  );
  const [mediaType, setMediaType] = useState<MediaType | "">(
    initialData?.mediaType || ""
  );
  const [triggerType, setTriggerType] = useState<AutomationTrigger>(
    initialData?.triggerType || "KEYWORD"
  );
  const [keywords, setKeywords] = useState<string[]>(
    initialData?.keywords || []
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [publicReplyText, setPublicReplyText] = useState(
    initialData?.publicReplyText || ""
  );
  const [dmMessageText, setDmMessageText] = useState(
    initialData?.dmMessageText || ""
  );
  const [dmLink, setDmLink] = useState(initialData?.dmLink || "");

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Array<{ field?: string; message: string }>
  >([]);

  // Add keyword tag
  const handleAddKeyword = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const trimmed = keywordInput.trim();
    if (!trimmed) return;

    if (keywords.length >= 20) {
      setFormError("Maximum of 20 keywords allowed.");
      return;
    }

    if (trimmed.length > 50) {
      setFormError("Keyword must not exceed 50 characters.");
      return;
    }

    if (keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      setKeywordInput("");
      return;
    }

    setKeywords([...keywords, trimmed]);
    setKeywordInput("");
    setFormError(null);
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    setKeywords(keywords.filter((_, idx) => idx !== indexToRemove));
  };

  const handleTriggerTypeChange = (newType: AutomationTrigger) => {
    setTriggerType(newType);
    if (newType === "ANY_COMMENT") {
      setKeywords([]);
      setKeywordInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors([]);

    const errors: Array<{ field?: string; message: string }> = [];

    // Validation
    if (!name.trim()) {
      errors.push({ field: "name", message: "Automation name is required" });
    } else if (name.length > 100) {
      errors.push({
        field: "name",
        message: "Automation name cannot exceed 100 characters",
      });
    }

    if (!isEditMode) {
      if (!instagramAccountId.trim()) {
        errors.push({
          field: "instagramAccountId",
          message: "Instagram account ID is required",
        });
      }
      if (!mediaId.trim()) {
        errors.push({
          field: "mediaId",
          message: "Instagram post or reels media ID is required",
        });
      }
      if (mediaPermalink && !mediaPermalink.startsWith("http")) {
        errors.push({
          field: "mediaPermalink",
          message: "Media permalink must be a valid URL",
        });
      }
    }

    if (triggerType === "KEYWORD" && keywords.length === 0) {
      errors.push({
        field: "keywords",
        message: "At least one keyword is required for keyword trigger",
      });
    }

    if (triggerType === "ANY_COMMENT" && keywords.length > 0) {
      errors.push({
        field: "keywords",
        message: "Keywords are not allowed for ANY_COMMENT trigger",
      });
    }

    if (!publicReplyText.trim()) {
      errors.push({
        field: "publicReplyText",
        message: "Public comment reply text is required",
      });
    } else if (publicReplyText.length > 500) {
      errors.push({
        field: "publicReplyText",
        message: "Public reply text must not exceed 500 characters",
      });
    }

    if (!dmMessageText.trim()) {
      errors.push({
        field: "dmMessageText",
        message: "Direct message text is required",
      });
    } else if (dmMessageText.length > 2000) {
      errors.push({
        field: "dmMessageText",
        message: "DM message text must not exceed 2000 characters",
      });
    }

    if (dmLink && !dmLink.startsWith("http")) {
      errors.push({
        field: "dmLink",
        message: "DM link must be a valid URL",
      });
    }

    if (errors.length > 0) {
      setFormError("Please resolve the form validation errors.");
      setFieldErrors(errors);
      return;
    }

    if (isEditMode) {
      const payload: UpdateAutomationPayload = {
        name: name.trim(),
        triggerType,
        keywords: triggerType === "KEYWORD" ? keywords : [],
        publicReplyText: publicReplyText.trim(),
        dmMessageText: dmMessageText.trim(),
        dmLink: dmLink.trim() || null,
      };
      await onSubmit(payload);
    } else {
      const payload: CreateAutomationPayload = {
        instagramAccountId: instagramAccountId.trim(),
        name: name.trim(),
        mediaId: mediaId.trim(),
        mediaPermalink: mediaPermalink.trim() || undefined,
        mediaType: (mediaType as MediaType) || undefined,
        triggerType,
        keywords: triggerType === "KEYWORD" ? keywords : [],
        publicReplyText: publicReplyText.trim(),
        dmMessageText: dmMessageText.trim(),
        dmLink: dmLink.trim() || undefined,
      };
      await onSubmit(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ErrorAlert
        message={formError || ""}
        errors={fieldErrors}
        onDismiss={() => {
          setFormError(null);
          setFieldErrors([]);
        }}
      />

      {/* 1. General Info */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
          Basic Settings
        </h3>

        <Input
          label="Automation Name"
          required
          maxLength={100}
          placeholder="e.g. Summer Promo DM & Reply"
          value={name}
          onChange={(e) => setName(e.target.value)}
          helperText="A descriptive internal label for this workflow"
        />

        {!isEditMode && (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Instagram Account <span className="text-red-500">*</span>
              </label>

              {discoveredAccounts.length > 0 ? (
                <div className="space-y-2">
                  <select
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={instagramAccountId}
                    onChange={(e) => setInstagramAccountId(e.target.value)}
                  >
                    {discoveredAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        @{acc.username || "Account"} ({acc.id})
                      </option>
                    ))}
                    <option value="">-- Enter ID Manually --</option>
                  </select>
                  {!instagramAccountId && (
                    <Input
                      placeholder="Paste Instagram Account UUID"
                      value={instagramAccountId}
                      onChange={(e) => setInstagramAccountId(e.target.value)}
                    />
                  )}
                </div>
              ) : (
                <Input
                  required
                  placeholder="Paste Instagram Account UUID (from Instagram Connection)"
                  value={instagramAccountId}
                  onChange={(e) => setInstagramAccountId(e.target.value)}
                  helperText="UUID of the connected Instagram account in Replyza"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Instagram Media ID"
                required
                maxLength={255}
                placeholder="e.g. 17923485901234567"
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
                helperText="Meta Post or Reel ID to listen for comments on"
              />

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Media Type
                </label>
                <select
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as MediaType)}
                >
                  <option value="">Select post type (optional)</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="CAROUSEL_ALBUM">Carousel Album</option>
                  <option value="REELS">Reels</option>
                </select>
              </div>
            </div>

            <Input
              label="Media Permalink"
              placeholder="https://www.instagram.com/p/..."
              value={mediaPermalink}
              onChange={(e) => setMediaPermalink(e.target.value)}
              helperText="Optional public URL to the Instagram post"
            />
          </>
        )}
      </div>

      {/* 2. Trigger Configuration */}
      <div className="space-y-4 pt-4 border-t border-zinc-100">
        <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
          Trigger Rule
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleTriggerTypeChange("KEYWORD")}
            className={`p-3 rounded-xl border text-left transition-all ${
              triggerType === "KEYWORD"
                ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                : "border-zinc-200 hover:border-zinc-300 bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-zinc-900">
              Specific Keywords
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Only trigger when a comment contains specific words.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleTriggerTypeChange("ANY_COMMENT")}
            className={`p-3 rounded-xl border text-left transition-all ${
              triggerType === "ANY_COMMENT"
                ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                : "border-zinc-200 hover:border-zinc-300 bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-zinc-900">
              Any Comment
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Trigger on every single comment received on this post.
            </p>
          </button>
        </div>

        {triggerType === "KEYWORD" && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700">
              Keywords <span className="text-red-500">*</span>
              <span className="text-zinc-400 font-normal ml-1">
                ({keywords.length}/20)
              </span>
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Type keyword (e.g. 'link', 'price', 'info') and press Enter"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleAddKeyword}
                disabled={!keywordInput.trim() || keywords.length >= 20}
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </Button>
            </div>

            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-800 text-xs px-2.5 py-1 rounded-md border border-zinc-200"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(idx)}
                      className="text-zinc-400 hover:text-red-600 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Automated Responses */}
      <div className="space-y-4 pt-4 border-t border-zinc-100">
        <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
          Automated Responses
        </h3>

        <Textarea
          label="Public Reply to Comment"
          required
          maxLength={500}
          rows={3}
          placeholder="e.g. Thanks for asking! We just sent you a direct message with details."
          value={publicReplyText}
          onChange={(e) => setPublicReplyText(e.target.value)}
          helperText="This reply is posted publicly under the user's comment"
        />

        <Textarea
          label="Private Direct Message (DM)"
          required
          maxLength={2000}
          rows={4}
          placeholder="e.g. Hi there! Here is the link you requested to check out our latest offers..."
          value={dmMessageText}
          onChange={(e) => setDmMessageText(e.target.value)}
          helperText="This message is dispatched to the user's Instagram DM inbox"
        />

        <Input
          label="DM Action Link"
          placeholder="https://example.com/special-offer"
          value={dmLink}
          onChange={(e) => setDmLink(e.target.value)}
          helperText="Optional call-to-action link attached to the DM message"
        />
      </div>

      <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
        {!isEditMode && (
          <p className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            New automations are saved as DRAFT status
          </p>
        )}
        <div className="ml-auto">
          <Button type="submit" isLoading={isLoading} className="shadow-xs">
            {isEditMode ? "Save Changes" : "Create Automation"}
          </Button>
        </div>
      </div>
    </form>
  );
}
