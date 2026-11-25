"use client";

import React, { useState } from "react";
import { AffiliateProduct } from "@/types/automation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";
import { AlertCircle, Link2, Sparkles, Upload } from "lucide-react";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  initialProduct?: AffiliateProduct | null;
  onSaved: (product: AffiliateProduct, isEdit: boolean) => void;
}

export function ProductFormModal({
  open,
  onClose,
  initialProduct,
  onSaved,
}: ProductFormModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={initialProduct ? "Edit Affiliate Product" : "Add Affiliate Product"}
      description="Tracking parameters on your affiliate URL are always preserved verbatim."
      className="max-w-2xl"
    >
      {open && (
        <ProductFormContent
          key={initialProduct?.id ?? "new"}
          onClose={onClose}
          initialProduct={initialProduct}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function ProductFormContent({
  onClose,
  initialProduct,
  onSaved,
}: Omit<ProductFormModalProps, "open">) {
  const isEdit = Boolean(initialProduct);

  const [name, setName] = useState(initialProduct?.name || "");
  const [brand, setBrand] = useState(initialProduct?.brand || "");
  const [affiliatePartner, setAffiliatePartner] = useState(initialProduct?.affiliatePartner || "");
  const [category, setCategory] = useState(initialProduct?.category || "");
  const [affiliateUrl, setAffiliateUrl] = useState(initialProduct?.affiliateUrl || "");
  const [originalUrl, setOriginalUrl] = useState(initialProduct?.originalUrl || "");
  const [imageUrl, setImageUrl] = useState(initialProduct?.imageUrl || "");
  const [price, setPrice] = useState(initialProduct?.price || "");
  const [discountPrice, setDiscountPrice] = useState(initialProduct?.discountPrice || "");
  const [discountInfo, setDiscountInfo] = useState(initialProduct?.discountInfo || "");
  const [couponCode, setCouponCode] = useState(initialProduct?.couponCode || "");
  const [ctaLabel, setCtaLabel] = useState(initialProduct?.ctaLabel || "Shop Now");
  const [description, setDescription] = useState(initialProduct?.description || "");
  const [notes] = useState(initialProduct?.notes || "");

  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtractMetadata = async () => {
    const target = affiliateUrl.trim() || originalUrl.trim();
    if (!target) {
      setError("Paste a product or affiliate URL first to fetch details.");
      return;
    }
    try {
      new URL(target);
    } catch {
      setError("Please enter a valid http(s) URL before fetching metadata.");
      return;
    }

    setIsExtracting(true);
    setError(null);
    try {
      const res = await apiRequest<{
        title: string | null;
        imageUrl: string | null;
        description: string | null;
        price: string | null;
        extracted: boolean;
        warning?: string;
      }>("/products/import-metadata", {
        method: "POST",
        body: JSON.stringify({ url: target }),
      });

      if (res.data) {
        if (res.data.title && !name) setName(res.data.title);
        if (res.data.imageUrl && !imageUrl) setImageUrl(res.data.imageUrl);
        if (res.data.description && !description) setDescription(res.data.description);
        if (res.data.price && !price) setPrice(res.data.price);

        if (res.data.extracted) {
          toast.success("Product details prefilled! Review and save.");
        } else {
          toast.info(
            res.data.warning || "Could not extract metadata; please enter details manually."
          );
        }
      }
    } catch (err) {
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : "Metadata extraction unavailable; please enter details manually."
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setError("Uploaded image must be under 1.5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!affiliateUrl.trim()) {
      setError("Affiliate / Product URL is required.");
      return;
    }
    try {
      const parsed = new URL(affiliateUrl.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("URL must start with https:// or http://");
        return;
      }
    } catch {
      setError("Please enter a valid Affiliate URL (including https://).");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || null,
        affiliatePartner: affiliatePartner.trim() || null,
        category: category.trim() || null,
        affiliateUrl: affiliateUrl.trim(),
        originalUrl: originalUrl.trim() || null,
        imageUrl: imageUrl.trim() || null,
        price: price.trim() || null,
        discountPrice: discountPrice.trim() || null,
        discountInfo: discountInfo.trim() || null,
        couponCode: couponCode.trim() || null,
        ctaLabel: ctaLabel.trim() || "Shop Now",
        description: description.trim() || null,
        notes: notes.trim() || null,
      };

      const res = isEdit
        ? await apiRequest<AffiliateProduct>(`/products/${initialProduct!.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiRequest<AffiliateProduct>("/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (res.data) {
        toast.success(isEdit ? "Product updated" : "Product added to library");
        onSaved(res.data, isEdit);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to save product."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Affiliate URL + Auto-Extract */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#17131D] flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-[#827D87]" />
            Affiliate / Product URL *
          </label>
          <div className="flex gap-2">
            <Input
              value={affiliateUrl}
              onChange={(e) => setAffiliateUrl(e.target.value)}
              placeholder="https://example.com/product?tag=creator-20"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExtractMetadata}
              isLoading={isExtracting}
              className="shrink-0 rounded-xl"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-fill
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Product Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vitamin C Glow Serum"
          />
          <Input
            label="Brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Minimalist"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. ₹1,499"
          />
          <Input
            label="Discount Price"
            value={discountPrice}
            onChange={(e) => setDiscountPrice(e.target.value)}
            placeholder="e.g. ₹999"
          />
          <Input
            label="Coupon Code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="e.g. SAVE20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Beauty"
          />
          <Input
            label="Affiliate Partner"
            value={affiliatePartner}
            onChange={(e) => setAffiliatePartner(e.target.value)}
            placeholder="e.g. Amazon / LTK"
          />
          <Input
            label="CTA Button Label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            maxLength={20}
            placeholder="Shop Now"
          />
        </div>

        {/* Image URL + Upload */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#17131D]">
            Product Image (HTTPS URL or Upload)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://cdn.example.com/product.jpg"
              className="flex-1"
            />
            <label className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#17131D]/15 bg-[#FFFDFB] px-3 py-2 text-xs font-medium text-[#17131D] hover:bg-[#F8F5F8] cursor-pointer shrink-0">
              <Upload className="h-3.5 w-3.5" />
              Upload
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
          {imageUrl.startsWith("data:image/") && (
            <p className="text-[11px] text-amber-700">
              Note: Uploaded local images preview here, but Instagram Generic Card carousels require a public HTTPS image URL.
            </p>
          )}
        </div>

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Short description shown on product cards..."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Original URL (optional)"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            placeholder="https://brand.com/product"
          />
          <Input
            label="Discount Badge (optional)"
            value={discountInfo}
            onChange={(e) => setDiscountInfo(e.target.value)}
            placeholder="e.g. 30% OFF"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#17131D]/8">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
            {isEdit ? "Save Changes" : "Add Product"}
          </Button>
        </div>
      </form>
  );
}
