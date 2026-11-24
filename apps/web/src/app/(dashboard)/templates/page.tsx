"use client";

import React, { useState, useEffect } from "react";
import { Template } from "@/types/automation";
import { TemplateCard } from "@/components/templates/template-card";
import { Spinner } from "@/components/ui/spinner";
import { apiRequest } from "@/lib/api-client";
import { LayoutTemplate } from "lucide-react";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

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
    loadTemplates();
    return () => {
      ignore = true;
    };
  }, []);

  const categories = ["ALL", ...Array.from(new Set(templates.map((t) => t.category)))];

  const filtered = templates.filter((t) => {
    if (filterCategory === "ALL") return true;
    return t.category === filterCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <LayoutTemplate className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Automation Templates
          </h1>
        </div>
        <p className="text-xs text-zinc-500">
          Pre-built comment-to-DM strategies optimized for conversion and engagement. Pick a template to launch in seconds.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterCategory === cat
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 bg-white border border-zinc-200/80 hover:bg-zinc-50"
            }`}
          >
            {cat === "ALL" ? "All Templates" : cat}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((tmpl) => (
            <TemplateCard key={tmpl.id} template={tmpl} />
          ))}
        </div>
      )}
    </div>
  );
}
