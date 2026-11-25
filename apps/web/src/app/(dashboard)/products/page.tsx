"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AffiliateProduct } from "@/types/automation";
import { ProductCard } from "@/components/products/product-card";
import { ProductFormModal } from "@/components/products/product-form-modal";
import { BulkImportModal } from "@/components/products/bulk-import-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";
import { Layers, Plus, Search, ShoppingBag } from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AffiliateProduct | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    apiRequest<AffiliateProduct[]>("/products")
      .then((res) => {
        if (!ignore && res.data) {
          setProducts(res.data);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load product library."
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const categories = useMemo(
    () => [
      "ALL",
      ...Array.from(
        new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
      ),
    ],
    [products]
  );

  const brands = useMemo(
    () => [
      "ALL",
      ...Array.from(
        new Set(products.map((p) => p.brand).filter((b): b is string => Boolean(b)))
      ),
    ],
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = categoryFilter === "ALL" || p.category === categoryFilter;
      const matchesBrand = brandFilter === "ALL" || p.brand === brandFilter;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.affiliatePartner || "").toLowerCase().includes(q);
      return matchesCategory && matchesBrand && matchesSearch;
    });
  }, [products, search, categoryFilter, brandFilter]);

  const handleSaved = (saved: AffiliateProduct, isEdit: boolean) => {
    if (isEdit) {
      setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    } else {
      setProducts((prev) => [saved, ...prev]);
    }
  };

  const handleDuplicate = async (product: AffiliateProduct) => {
    try {
      const res = await apiRequest<AffiliateProduct>(`/products/${product.id}/duplicate`, {
        method: "POST",
      });
      if (res.data) {
        setProducts((prev) => [res.data!, ...prev]);
        toast.success("Product duplicated");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to duplicate product"
      );
    }
  };

  const handleDelete = async (product: AffiliateProduct) => {
    try {
      await apiRequest(`/products/${product.id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success("Product removed from library");
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to delete product"
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
              <ShoppingBag className="h-4 w-4" />
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#17131D]">
              Affiliate Product Library
            </h1>
          </div>
          <p className="text-xs text-[#827D87]">
            Save your brand collaborations and affiliate links once, and reuse them across any Instagram automation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBulkOpen(true)}
            className="gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            Bulk Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingProduct(null);
              setFormOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-[#827D87] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, brands, partners..."
            className="pl-10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-[#17131D]/12 bg-[#FFFDFB] px-3 py-2 text-xs font-medium text-[#17131D] focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "ALL" ? "All Categories" : c}
            </option>
          ))}
        </select>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="rounded-xl border border-[#17131D]/12 bg-[#FFFDFB] px-3 py-2 text-xs font-medium text-[#17131D] focus:outline-none"
        >
          {brands.map((b) => (
            <option key={b} value={b}>
              {b === "ALL" ? "All Brands" : b}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Spinner size="md" label="Loading product library..." />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6 text-[#833AB4]" />}
          title={products.length === 0 ? "No affiliate products yet" : "No matching products"}
          description={
            products.length === 0
              ? "Add your first affiliate product or bulk-import links to reuse across automations."
              : "Try clearing your search or category filter."
          }
          action={
            products.length === 0 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={(p) => {
                setEditingProduct(p);
                setFormOpen(true);
              }}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialProduct={editingProduct}
        onSaved={handleSaved}
      />

      <BulkImportModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={(imported) => setProducts((prev) => [...imported, ...prev])}
      />
    </div>
  );
}
