"use client";

import React from "react";
import { AffiliateProduct } from "@/types/automation";
import {
  Copy,
  Edit2,
  ExternalLink,
  Package,
  Tag,
  Trash2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface ProductCardProps {
  product: AffiliateProduct;
  onEdit?: (product: AffiliateProduct) => void;
  onDuplicate?: (product: AffiliateProduct) => void;
  onDelete?: (product: AffiliateProduct) => void;
  onSelect?: (product: AffiliateProduct) => void;
  selected?: boolean;
  compact?: boolean;
}

export function ProductCard({
  product,
  onEdit,
  onDuplicate,
  onDelete,
  onSelect,
  selected = false,
  compact = false,
}: ProductCardProps) {
  const displayPrice = product.discountPrice || product.price;
  const strikePrice = product.discountPrice && product.price ? product.price : null;

  return (
    <div
      className={`group flex flex-col rounded-2xl border bg-[#FFFFFF] overflow-hidden transition-all duration-200 ${
        selected
          ? "border-[#E1306C] ring-2 ring-[#E1306C]/20"
          : "border-[#E6DFD8] hover:border-[#D5CCC3]"
      }`}
    >
      {/* Product Image */}
      <div
        className={`relative w-full bg-[#F8F5F8] overflow-hidden ${
          compact ? "h-36" : "h-44"
        }`}
      >
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-[#827D87] gap-1.5">
            <Package className="h-7 w-7 opacity-40" />
            <span className="text-[11px] font-medium opacity-70">No image</span>
          </div>
        )}

        {/* Category / Status badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {product.category && (
            <span className="rounded-md bg-white/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-[#17131D] border border-[#17131D]/8">
              {product.category}
            </span>
          )}
          {product.discountInfo && (
            <span className="rounded-md bg-[#E1306C] px-2 py-0.5 text-[10px] font-semibold text-white">
              {product.discountInfo}
            </span>
          )}
        </div>

        {selected && (
          <div className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#17131D] text-white shadow-xs">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-[#17131D] line-clamp-2 leading-snug">
            {product.name}
          </h3>
        </div>

        {(product.brand || product.affiliatePartner) && (
          <p className="mt-1 text-[11px] text-[#827D87] truncate">
            {product.brand ? `Brand: ${product.brand}` : ""}
            {product.brand && product.affiliatePartner ? " · " : ""}
            {product.affiliatePartner ? `Partner: ${product.affiliatePartner}` : ""}
          </p>
        )}

        {/* Pricing + Coupon */}
        {(displayPrice || product.couponCode) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {displayPrice && (
              <span className="text-sm font-bold text-[#17131D]">
                {displayPrice}
              </span>
            )}
            {strikePrice && (
              <span className="text-xs text-[#827D87] line-through">
                {strikePrice}
              </span>
            )}
            {product.couponCode && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-amber-800">
                <Tag className="h-2.5 w-2.5" />
                {product.couponCode}
              </span>
            )}
          </div>
        )}

        {product.description && (
          <p className="mt-2 text-xs text-[#827D87] line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Link preview + One-click Copy */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-[#E1306C] hover:underline truncate min-w-0"
            title={product.affiliateUrl}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="font-mono-num truncate">{product.affiliateUrl}</span>
          </a>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(product.affiliateUrl);
              toast.success("Affiliate URL copied");
            }}
            className="p-1 rounded-md text-[#6E655F] hover:text-[#161413] hover:bg-[#F2EBE4] shrink-0 cursor-pointer"
            title="Copy affiliate URL"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>

        {/* Actions Footer */}
        <div className="mt-auto pt-3.5 border-t border-[#17131D]/6 flex items-center justify-between gap-2">
          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(product)}
              className={`w-full rounded-xl py-2 px-3 text-xs font-semibold transition-colors cursor-pointer ${
                selected
                  ? "bg-[#17131D] text-white"
                  : "bg-[#F8F5F8] text-[#17131D] hover:bg-[#17131D] hover:text-white"
              }`}
            >
              {selected ? "Selected" : product.ctaLabel || "Select Product"}
            </button>
          ) : (
            <>
              <span className="inline-flex items-center rounded-lg bg-[#F8F5F8] px-2.5 py-1 text-[11px] font-semibold text-[#17131D]">
                {product.ctaLabel || "Shop Now"}
              </span>
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    className="p-1.5 rounded-lg text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8] transition-colors cursor-pointer"
                    title="Edit product"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDuplicate && (
                  <button
                    type="button"
                    onClick={() => onDuplicate(product)}
                    className="p-1.5 rounded-lg text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8] transition-colors cursor-pointer"
                    title="Duplicate product"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(product)}
                    className="p-1.5 rounded-lg text-[#827D87] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete product"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
