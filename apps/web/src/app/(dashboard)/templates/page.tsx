"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Template, AutomationTrigger } from "@/types/automation";
import { TemplateCard } from "@/components/templates/template-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Copy, LayoutTemplate, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Create template modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Custom");
  const [formDescription, setFormDescription] = useState("");
  const [formTrigger, setFormTrigger] = useState<AutomationTrigger>("KEYWORD");
  const [formKeywords, setFormKeywords] = useState("LINK");
  const [formPublicReply, setFormPublicReply] = useState("Sent it to your DMs! 💌");
  const [formDmMessage, setFormDmMessage] = useState("Hey {{first_name}}, here is your link:");
  const [formDmLink, setFormDmLink] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadTemplates() {
      try {
        const res = await apiRequest<Template[]>("/templates");
        if (!ignore && res.success && res.data) {
          setTemplates(res.data);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load templates");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void loadTemplates();
    return () => {
      ignore = true;
    };
  }, []);

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(templates.map((t) => t.category)))],
    [templates]
  );

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchesCat = filterCategory === "ALL" || t.category === filterCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [templates, filterCategory, searchQuery]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!formName.trim()) {
      setCreateError("Template name is required.");
      return;
    }

    const parsedKeywords =
      formTrigger === "KEYWORD"
        ? formKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
        : [];

    setIsCreating(true);
    try {
      const res = await apiRequest<Template>("/templates", {
        method: "POST",
        body: JSON.stringify({
          name: formName.trim(),
          category: formCategory.trim() || "Custom",
          description: formDescription.trim() || undefined,
          triggerType: formTrigger,
          keywords: parsedKeywords,
          publicReplyText: formPublicReply.trim(),
          dmMessageText: formDmMessage.trim(),
          dmLink: formDmLink.trim() || undefined,
          followRequired: false,
        }),
      });
      if (res.data) {
        setTemplates((prev) => [res.data!, ...prev]);
        setCreateOpen(false);
        setFormName("");
        setFormDescription("");
        setFormDmLink("");
      }
    } catch (err) {
      setCreateError(
        err instanceof ApiClientError ? err.message : "Failed to create template."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDuplicateTemplate = async (id: string) => {
    try {
      const res = await apiRequest<Template>(`/templates/${id}/duplicate`, {
        method: "POST",
      });
      if (res.data) {
        setTemplates((prev) => [res.data!, ...prev]);
        toast.success("Template duplicated");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to duplicate template."
      );
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await apiRequest(`/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to delete template."
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl ig-gradient text-white">
              <LayoutTemplate className="h-4 w-4" />
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#17131D]">
              Automation Templates
            </h1>
          </div>
          <p className="text-xs text-[#827D87]">
            Pre-built and custom comment-to-DM strategies. Pick a template to launch in seconds.
          </p>
        </div>

        <Button variant="gradient" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Template
        </Button>
      </div>

      {/* Search & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filterCategory === cat
                  ? "bg-[#17131D] text-[#FFFDFB]"
                  : "text-[#827D87] bg-[#FFFDFB] border border-[#17131D]/10 hover:text-[#17131D]"
              }`}
            >
              {cat === "ALL" ? "All Templates" : cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-6 w-6 text-[#833AB4]" />}
          title="No matching templates"
          description="Try clearing your search or create a reusable custom template."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((tmpl) => (
            <div key={tmpl.id} className="relative group">
              <TemplateCard template={tmpl} />
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => void handleDuplicateTemplate(tmpl.id)}
                  className="p-1.5 rounded-full bg-[#FFFDFB] border border-[#17131D]/10 text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8] cursor-pointer"
                  title="Duplicate template"
                  aria-label="Duplicate template"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {!tmpl.isSystem && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteTemplate(tmpl.id)}
                    className="p-1.5 rounded-full bg-[#FFFDFB] border border-[#17131D]/10 text-[#827D87] hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    title="Delete custom template"
                    aria-label="Delete custom template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Custom Template Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Custom Template"
        description="Save a reusable comment-to-DM blueprint for future automations."
      >
        <form onSubmit={handleCreateTemplate} className="space-y-4 pt-2">
          {createError && (
            <ErrorAlert message={createError} onDismiss={() => setCreateError(null)} />
          )}

          <Input
            label="Template Name"
            required
            placeholder="e.g. Black Friday VIP Link"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Category"
              placeholder="Custom"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#17131D]">
                Trigger Type
              </label>
              <select
                value={formTrigger}
                onChange={(e) => setFormTrigger(e.target.value as AutomationTrigger)}
                className="w-full rounded-xl border border-[#17131D]/12 bg-[#FFFDFB] px-3 py-2.5 text-sm text-[#17131D]"
              >
                <option value="KEYWORD">Keyword Match</option>
                <option value="ANY_COMMENT">Any Comment</option>
              </select>
            </div>
          </div>

          {formTrigger === "KEYWORD" && (
            <Input
              label="Keywords (comma separated)"
              placeholder="LINK, GUIDE, VIP"
              value={formKeywords}
              onChange={(e) => setFormKeywords(e.target.value)}
            />
          )}

          <Textarea
            label="Public Reply Text"
            required
            rows={2}
            value={formPublicReply}
            onChange={(e) => setFormPublicReply(e.target.value)}
          />

          <Textarea
            label="Private DM Text"
            required
            rows={3}
            value={formDmMessage}
            onChange={(e) => setFormDmMessage(e.target.value)}
          />

          <Input
            label="Optional Link URL"
            type="url"
            placeholder="https://yourbrand.com/offer"
            value={formDmLink}
            onChange={(e) => setFormDmLink(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gradient" size="sm" isLoading={isCreating}>
              Save Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
