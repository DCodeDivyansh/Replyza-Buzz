"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AffiliateProduct,
  AutomationProductItem,
  DeliveryMode,
  ProductDeliveryMode,
} from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ProductCard } from "@/components/products/product-card";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Copy,
  Edit2,
  GripVertical,
  Info,
  Layers,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";

interface ProductSelectorStepProps {
  products: AutomationProductItem[];
  onChangeProducts: (next: AutomationProductItem[]) => void;
  productDeliveryMode: ProductDeliveryMode;
  onChangeProductDeliveryMode: (mode: ProductDeliveryMode) => void;
  deliveryMode: DeliveryMode;
  followRequired: boolean;
  productIntroText: string;
  onChangeProductIntroText: (val: string) => void;
  productClosingText: string;
  onChangeProductClosingText: (val: string) => void;
  libraryProducts: AffiliateProduct[];
}

interface SortableProductRowProps {
  item: AutomationProductItem & { _uid: string };
  index: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function SortableProductRow({
  item,
  index,
  onEdit,
  onDuplicate,
  onRemove,
}: SortableProductRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._uid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition-shadow ${
        isDragging
          ? "border-[#161413] shadow-md z-10"
          : "border-[#161413]/10 hover:border-[#161413]/20"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 text-[#6E655F] hover:text-[#161413] cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="h-11 w-11 rounded-lg bg-[#F7F1EC] border border-[#161413]/8 overflow-hidden shrink-0 flex items-center justify-center">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-4 w-4 text-[#6E655F]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold text-[#6E655F]">
            #{index + 1}
          </span>
          <p className="text-xs font-semibold text-[#161413] truncate">{item.name}</p>
          {(item.discountPrice || item.price) && (
            <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
              {item.discountPrice || item.price}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#E1306C] truncate mt-0.5">
          {item.affiliateUrl}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#161413] hover:bg-[#F7F1EC] cursor-pointer"
          title="Edit product"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#161413] hover:bg-[#F7F1EC] cursor-pointer"
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-[#6E655F] hover:text-red-600 hover:bg-red-50 cursor-pointer"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const DELIVERY_FORMAT_OPTIONS: Array<{
  id: ProductDeliveryMode;
  label: string;
  description: string;
  apiNote: string;
}> = [
  {
    id: "SINGLE_MESSAGE",
    label: "Single Message with Links",
    description: "Combines all products and affiliate links into one clean DM.",
    apiNote: "Supported on all Instagram accounts (Direct & Button).",
  },
  {
    id: "SEPARATE_MESSAGES",
    label: "Separate Message per Product",
    description: "Sends each product as its own sequential DM in order.",
    apiNote: "Requires 2-step Button / Follow gate so we can send multiple DMs in the 24h window.",
  },
  {
    id: "GENERIC_CARDS",
    label: "Visual Product Cards (Carousel)",
    description: "Sends Meta Generic Template cards with image, title & Shop button.",
    apiNote: "Supported after user taps a button (2-step flow). Direct Private Replies fall back to text.",
  },
  {
    id: "SELECTION_PROMPT",
    label: "Product Selection Quick Replies",
    description: "Sends quick-reply buttons so commenters pick which product link they want.",
    apiNote: "Max 13 products, 20-char button titles (Meta Quick Reply limit).",
  },
];

export function ProductSelectorStep({
  products,
  onChangeProducts,
  productDeliveryMode,
  onChangeProductDeliveryMode,
  deliveryMode,
  followRequired,
  productIntroText,
  onChangeProductIntroText,
  productClosingText,
  onChangeProductClosingText,
  libraryProducts,
}: ProductSelectorStepProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [inlineModalOpen, setInlineModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Inline product form state
  const [pName, setPName] = useState("");
  const [pUrl, setPUrl] = useState("");
  const [pImage, setPImage] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDiscountPrice, setPDiscountPrice] = useState("");
  const [pCoupon, setPCoupon] = useState("");
  const [pBrand, setPBrand] = useState("");
  const [pCta, setPCta] = useState("Shop Now");
  const [pDesc, setPDesc] = useState("");
  const [pCustomMsg, setPCustomMsg] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Bulk paste state
  const [bulkText, setBulkText] = useState("");
  const [bulkExtract, setBulkExtract] = useState(false);
  const [isBulkParsing, setIsBulkParsing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemsWithIds = products.map((p, idx) => ({
    ...p,
    _uid: p.id || `${p.affiliateUrl}-${idx}`,
  }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemsWithIds.findIndex((i) => i._uid === active.id);
    const newIndex = itemsWithIds.findIndex((i) => i._uid === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(products, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      sortOrder: idx,
    }));
    onChangeProducts(reordered);
  };

  const openAddInline = () => {
    setEditingIndex(null);
    setPName("");
    setPUrl("");
    setPImage("");
    setPPrice("");
    setPDiscountPrice("");
    setPCoupon("");
    setPBrand("");
    setPCta("Shop Now");
    setPDesc("");
    setPCustomMsg("");
    setInlineModalOpen(true);
  };

  const openEditInline = (idx: number) => {
    const item = products[idx];
    setEditingIndex(idx);
    setPName(item.name);
    setPUrl(item.affiliateUrl);
    setPImage(item.imageUrl || "");
    setPPrice(item.price || "");
    setPDiscountPrice(item.discountPrice || "");
    setPCoupon(item.couponCode || "");
    setPBrand(item.brand || "");
    setPCta(item.ctaLabel || "Shop Now");
    setPDesc(item.description || "");
    setPCustomMsg(item.customMessage || "");
    setInlineModalOpen(true);
  };

  const handleExtractInline = async () => {
    if (!pUrl.trim()) return;
    setIsExtracting(true);
    try {
      const res = await apiRequest<{
        title: string | null;
        imageUrl: string | null;
        description: string | null;
        price: string | null;
        extracted: boolean;
      }>("/products/import-metadata", {
        method: "POST",
        body: JSON.stringify({ url: pUrl.trim() }),
      });
      if (res.data) {
        if (res.data.title && !pName) setPName(res.data.title);
        if (res.data.imageUrl && !pImage) setPImage(res.data.imageUrl);
        if (res.data.description && !pDesc) setPDesc(res.data.description);
        if (res.data.price && !pPrice) setPPrice(res.data.price);
        toast.success(
          res.data.extracted ? "Details prefilled!" : "No metadata found; enter manually."
        );
      }
    } catch {
      toast.info("Could not fetch page metadata; enter details manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveInline = () => {
    if (!pName.trim() || !pUrl.trim()) {
      toast.error("Product name and URL are required.");
      return;
    }
    try {
      const parsed = new URL(pUrl.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        toast.error("URL must use http:// or https://");
        return;
      }
    } catch {
      toast.error("Please enter a valid URL.");
      return;
    }

    const nextItem: AutomationProductItem = {
      ...(editingIndex !== null ? products[editingIndex] : {}),
      name: pName.trim(),
      affiliateUrl: pUrl.trim(),
      imageUrl: pImage.trim() || null,
      price: pPrice.trim() || null,
      discountPrice: pDiscountPrice.trim() || null,
      couponCode: pCoupon.trim() || null,
      brand: pBrand.trim() || null,
      ctaLabel: pCta.trim() || "Shop Now",
      description: pDesc.trim() || null,
      customMessage: pCustomMsg.trim() || null,
    };

    if (editingIndex !== null) {
      const updated = [...products];
      updated[editingIndex] = nextItem;
      onChangeProducts(updated);
    } else {
      onChangeProducts([...products, { ...nextItem, sortOrder: products.length }]);
    }
    setInlineModalOpen(false);
  };

  const handleBulkAdd = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setIsBulkParsing(true);
    const added: AutomationProductItem[] = [];
    for (let i = 0; i < lines.length && products.length + added.length < 10; i++) {
      const line = lines[i];
      const pipeIdx = line.indexOf("|");
      const rawName = pipeIdx > 0 ? line.slice(0, pipeIdx).trim() : "";
      const rawUrl = pipeIdx > 0 ? line.slice(pipeIdx + 1).trim() : line;
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
        let name = rawName || `Product ${products.length + added.length + 1}`;
        let imageUrl: string | null = null;
        let description: string | null = null;
        let price: string | null = null;

        if (bulkExtract) {
          try {
            const res = await apiRequest<{
              title: string | null;
              imageUrl: string | null;
              description: string | null;
              price: string | null;
            }>("/products/import-metadata", {
              method: "POST",
              body: JSON.stringify({ url: rawUrl }),
            });
            if (res.data) {
              if (!rawName && res.data.title) name = res.data.title;
              imageUrl = res.data.imageUrl;
              description = res.data.description;
              price = res.data.price;
            }
          } catch {
            // graceful fallback
          }
        }

        added.push({
          name,
          affiliateUrl: rawUrl,
          imageUrl,
          description,
          price,
          ctaLabel: "Shop Now",
          sortOrder: products.length + added.length,
        });
      } catch {
        toast.error(`Skipped invalid URL: ${rawUrl}`);
      }
    }

    if (added.length > 0) {
      onChangeProducts([...products, ...added]);
      toast.success(`Added ${added.length} product(s)`);
    }
    setIsBulkParsing(false);
    setBulkText("");
    setBulkOpen(false);
  };

  const toggleLibraryProduct = (lib: AffiliateProduct) => {
    const existsIdx = products.findIndex((p) => p.affiliateProductId === lib.id);
    if (existsIdx >= 0) {
      onChangeProducts(products.filter((_, i) => i !== existsIdx));
      return;
    }
    if (products.length >= 10) {
      toast.error("Maximum 10 products per automation.");
      return;
    }
    onChangeProducts([
      ...products,
      {
        affiliateProductId: lib.id,
        name: lib.name,
        imageUrl: lib.imageUrl,
        description: lib.description,
        affiliateUrl: lib.affiliateUrl,
        originalUrl: lib.originalUrl,
        price: lib.price,
        discountPrice: lib.discountPrice,
        category: lib.category,
        ctaLabel: lib.ctaLabel || "Shop Now",
        couponCode: lib.couponCode,
        brand: lib.brand,
        sortOrder: products.length,
      },
    ]);
  };

  const showTwoStepWarning =
    deliveryMode === "DIRECT" &&
    !followRequired &&
    (productDeliveryMode === "GENERIC_CARDS" || productDeliveryMode === "SEPARATE_MESSAGES");

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setLibraryOpen(true)}
          className="gap-1.5"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          From Product Library ({libraryProducts.length})
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={openAddInline}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Custom Link
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setBulkOpen(true)}
          className="gap-1.5"
        >
          <Layers className="h-3.5 w-3.5" />
          Bulk Paste Links
        </Button>
      </div>

      {/* Sortable Product List */}
      {products.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemsWithIds.map((i) => i._uid)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {itemsWithIds.map((item, idx) => (
                <SortableProductRow
                  key={item._uid}
                  item={item}
                  index={idx}
                  onEdit={() => openEditInline(idx)}
                  onDuplicate={() => {
                    if (products.length >= 10) {
                      toast.error("Maximum 10 products per automation.");
                      return;
                    }
                    onChangeProducts([
                      ...products,
                      {
                        ...products[idx],
                        id: undefined,
                        name: `${products[idx].name} (Copy)`,
                        sortOrder: products.length,
                      },
                    ]);
                  }}
                  onRemove={() =>
                    onChangeProducts(products.filter((_, i) => i !== idx))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded-xl border border-dashed border-[#161413]/15 bg-[#F7F1EC]/60 p-5 text-center text-xs text-[#6E655F]">
          No products added yet. Pick from your Affiliate Product Library, add a link, or bulk-paste multiple links above.
        </div>
      )}

      {/* Delivery Format Selector */}
      <div className="space-y-2 pt-2">
        <label className="text-xs font-semibold text-[#161413]">
          How should products be delivered in DM?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DELIVERY_FORMAT_OPTIONS.map((opt) => {
            const active = productDeliveryMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeProductDeliveryMode(opt.id)}
                className={`text-left rounded-xl border p-3 transition-all cursor-pointer ${
                  active
                    ? "border-[#161413] bg-[#F7F1EC] ring-1 ring-[#161413]/15"
                    : "border-[#161413]/10 bg-white hover:border-[#161413]/25"
                }`}
              >
                <div className="text-xs font-semibold text-[#161413]">{opt.label}</div>
                <p className="text-[11px] text-[#6E655F] mt-0.5">{opt.description}</p>
                <p className="text-[10px] text-[#E1306C] mt-1.5 font-medium">
                  {opt.apiNote}
                </p>
              </button>
            );
          })}
        </div>

        {showTwoStepWarning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Meta&apos;s Comment Private Reply API only allows 1 text message per comment. Enable the <strong>Interactive Button</strong> in Step 5 to unlock {productDeliveryMode === "GENERIC_CARDS" ? "Visual Product Cards" : "Separate Messages"}, or Direct mode will automatically deliver a clean formatted text list.
            </span>
          </div>
        )}
      </div>

      {/* Optional Intro & Closing Messages */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Input
            label="Product Intro Line (optional)"
            value={productIntroText}
            onChange={(e) => onChangeProductIntroText(e.target.value)}
            placeholder="Here are the links you asked for:"
          />
          <Input
            label="Closing Line (optional)"
            value={productClosingText}
            onChange={(e) => onChangeProductClosingText(e.target.value)}
            placeholder="Tap any link above to shop!"
          />
        </div>
      )}

      {/* Library Picker Modal */}
      <Modal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Select from Affiliate Product Library"
        description="Choose one or multiple products to include in this automation."
        className="max-w-2xl"
      >
        {libraryProducts.length === 0 ? (
          <p className="text-xs text-[#6E655F] py-8 text-center">
            Your Affiliate Product Library is empty. Add products in the Product Library tab or use &ldquo;Add Custom Link&rdquo;.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-1">
            {libraryProducts.map((lib) => (
              <ProductCard
                key={lib.id}
                product={lib}
                compact
                selected={products.some((p) => p.affiliateProductId === lib.id)}
                onSelect={toggleLibraryProduct}
              />
            ))}
          </div>
        )}
        <div className="flex justify-end pt-4 mt-4 border-t border-[#161413]/8">
          <Button type="button" size="sm" onClick={() => setLibraryOpen(false)}>
            Done ({products.length} selected)
          </Button>
        </div>
      </Modal>

      {/* Inline Add/Edit Product Modal */}
      <Modal
        isOpen={inlineModalOpen}
        onClose={() => setInlineModalOpen(false)}
        title={editingIndex !== null ? "Edit Product" : "Add Product Link"}
        className="max-w-lg"
      >
        <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Affiliate / Product URL *"
                value={pUrl}
                onChange={(e) => setPUrl(e.target.value)}
                placeholder="https://affiliate.example.com/item?tag=you"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExtractInline}
              isLoading={isExtracting}
              className="rounded-xl shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-fill
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Product Name *"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder="e.g. Glow Serum"
            />
            <Input
              label="Brand (optional)"
              value={pBrand}
              onChange={(e) => setPBrand(e.target.value)}
              placeholder="e.g. Minimalist"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Price"
              value={pPrice}
              onChange={(e) => setPPrice(e.target.value)}
              placeholder="₹1,499"
            />
            <Input
              label="Discount Price"
              value={pDiscountPrice}
              onChange={(e) => setPDiscountPrice(e.target.value)}
              placeholder="₹999"
            />
            <Input
              label="Coupon Code"
              value={pCoupon}
              onChange={(e) => setPCoupon(e.target.value)}
              placeholder="SAVE20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Image URL (optional)"
              value={pImage}
              onChange={(e) => setPImage(e.target.value)}
              placeholder="https://..."
            />
            <Input
              label="CTA Label"
              value={pCta}
              onChange={(e) => setPCta(e.target.value)}
              maxLength={20}
              placeholder="Shop Now"
            />
          </div>
          <Input
            label="Custom DM Note (optional)"
            value={pCustomMsg}
            onChange={(e) => setPCustomMsg(e.target.value)}
            placeholder="My #1 pick for dry skin!"
          />
          <Textarea
            label="Description (optional)"
            value={pDesc}
            onChange={(e) => setPDesc(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#161413]/8">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setInlineModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSaveInline}>
              Save Product
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Paste Modal */}
      <Modal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Paste Product Links"
        description="Paste Name | URL or one URL per line (up to 10 products per automation)."
        className="max-w-lg"
      >
        <div className="space-y-3.5">
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            placeholder={`Product 1 | https://affiliate-link-1.com\nProduct 2 | https://affiliate-link-2.com\nhttps://affiliate-link-3.com`}
          />
          <label className="flex items-center gap-2 text-xs text-[#161413] cursor-pointer">
            <input
              type="checkbox"
              checked={bulkExtract}
              onChange={(e) => setBulkExtract(e.target.checked)}
            />
            Auto-extract titles & images where supported
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#161413]/8">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setBulkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={isBulkParsing}
              onClick={handleBulkAdd}
            >
              Add Links
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
