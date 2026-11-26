"use client";

import React, { useState } from "react";
import { AffiliateProduct } from "@/types/automation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";
import { AlertCircle, Layers, Sparkles } from "lucide-react";

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (products: AffiliateProduct[]) => void;
}

export function BulkImportModal({
  open,
  onClose,
  onImported,
}: BulkImportModalProps) {
  const [rawText, setRawText] = useState("");
  const [extractMetadata, setExtractMetadata] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!rawText.trim()) {
      setError("Paste at least one product link.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await apiRequest<AffiliateProduct[]>("/products/bulk", {
        method: "POST",
        body: JSON.stringify({
          rawText: rawText.trim(),
          extractMetadata,
        }),
      });
      if (res.data) {
        toast.success(`Imported ${res.data.length} product(s)`);
        onImported(res.data);
        setRawText("");
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to import products."
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Bulk Import Product Links"
      description="Paste one link per line, or use Name | URL format. All affiliate query parameters are preserved."
      className="max-w-lg"
    >
      <form onSubmit={handleImport} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Textarea
          label="Product Links"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
          placeholder={`Serum | https://affiliate.example.com/serum?tag=me-20\nMoisturizer | https://affiliate.example.com/cream?ref=ig\nhttps://shop.example.com/sunscreen`}
        />

        <label className="flex items-start gap-2.5 rounded-xl border border-[#17131D]/10 bg-[#F8F5F8] p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={extractMetadata}
            onChange={(e) => setExtractMetadata(e.target.checked)}
            className="mt-0.5 rounded border-[#17131D]/20"
          />
          <div className="text-xs">
            <span className="font-semibold text-[#17131D] flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-[#E1306C]" />
              Best-effort metadata prefill
            </span>
            <p className="text-[#827D87] mt-0.5">
              Attempts to fetch product titles, images, and prices from public pages. Sites that block scrapers will still be imported with your links intact.
            </p>
          </div>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#17131D]/8">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isImporting}>
            <Layers className="h-3.5 w-3.5" />
            Import Products
          </Button>
        </div>
      </form>
    </Modal>
  );
}
