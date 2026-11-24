"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { InstagramMedia } from "@/types/automation";
import { MediaCard } from "./media-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { apiRequest } from "@/lib/api-client";
import { Film, Image as ImageIcon, Layers, RefreshCw } from "lucide-react";

interface AccountOption {
  id: string;
  username: string | null;
  instagramUserId: string;
}

interface MediaGridProps {
  onSelectForAutomation?: (media: InstagramMedia) => void;
  selectedMediaId?: string;
  initialAccountId?: string;
}

export function MediaGrid({
  onSelectForAutomation,
  selectedMediaId,
  initialAccountId,
}: MediaGridProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || "");
  const [mediaList, setMediaList] = useState<InstagramMedia[]>([]);
  const [loading, setLoading] = useState(Boolean(initialAccountId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "REELS" | "PHOTOS" | "CAROUSELS">("ALL");
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    let ignore = false;
    async function loadAccounts() {
      try {
        const res = await apiRequest<AccountOption[]>("/instagram/accounts");
        if (!ignore && res.success && res.data) {
          setAccounts(res.data);
          if (res.data.length > 0 && !selectedAccountId) {
            setSelectedAccountId(res.data[0].id);
            setLoading(true);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load accounts");
        }
      }
    }
    loadAccounts();
    return () => {
      ignore = true;
    };
  }, [selectedAccountId]);

  // Fetch media when selected account changes
  useEffect(() => {
    if (!selectedAccountId) return;

    let ignore = false;
    async function loadMedia() {
      try {
        const res = await apiRequest<InstagramMedia[]>(
          `/instagram/accounts/${selectedAccountId}/media`
        );
        if (!ignore && res.success && res.data) {
          setMediaList(res.data);
          setNextCursor(res.paging?.cursors?.after || null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load media");
          setMediaList([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMedia();
    return () => {
      ignore = true;
    };
  }, [selectedAccountId]);

  // Handle Load More
  async function handleLoadMore() {
    if (!selectedAccountId || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiRequest<InstagramMedia[]>(
        `/instagram/accounts/${selectedAccountId}/media?after=${encodeURIComponent(nextCursor)}`
      );
      if (res.success && res.data) {
        setMediaList((prev) => [...prev, ...(res.data || [])]);
        setNextCursor(res.paging?.cursors?.after || null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more media");
    } finally {
      setLoadingMore(false);
    }
  }

  // Refresh
  function handleRefresh() {
    if (!selectedAccountId) return;
    setLoading(true);
    setError(null);
    apiRequest<InstagramMedia[]>(`/instagram/accounts/${selectedAccountId}/media`)
      .then((res) => {
        if (res.success && res.data) {
          setMediaList(res.data);
          setNextCursor(res.paging?.cursors?.after || null);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to refresh media");
      })
      .finally(() => setLoading(false));
  }

  const filteredMedia = mediaList.filter((m) => {
    if (filterType === "ALL") return true;
    if (filterType === "REELS") {
      return m.media_product_type === "REELS" || m.media_type === "VIDEO";
    }
    if (filterType === "PHOTOS") {
      return m.media_type === "IMAGE" && m.media_product_type !== "REELS";
    }
    if (filterType === "CAROUSELS") {
      return m.media_type === "CAROUSEL_ALBUM";
    }
    return true;
  });

  if (accounts.length === 0 && !loading) {
    return (
      <EmptyState
        title="No connected Instagram account"
        description="Connect your Instagram Professional or Creator account to browse and automate your posts and reels."
        action={
          <Link href="/instagram">
            <Button variant="primary" size="sm">
              Connect Instagram
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-2xs">
        {/* Account Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="account-select" className="text-xs font-medium text-zinc-600 shrink-0">
            Account:
          </label>
          <select
            id="account-select"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                @{acc.username || acc.instagramUserId}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 h-8 w-8 text-zinc-500 hover:text-zinc-800"
            title="Refresh media"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterType === "ALL"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            All ({mediaList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("REELS")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterType === "REELS"
                ? "bg-purple-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <Film className="h-3 w-3" /> Reels
          </button>
          <button
            type="button"
            onClick={() => setFilterType("PHOTOS")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterType === "PHOTOS"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <ImageIcon className="h-3 w-3" /> Photos
          </button>
          <button
            type="button"
            onClick={() => setFilterType("CAROUSELS")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterType === "CAROUSELS"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <Layers className="h-3 w-3" /> Carousels
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredMedia.length === 0 ? (
        <EmptyState
          title="No media found"
          description="We couldn't find any media items matching your criteria. Try changing the filter or publishing a post on Instagram."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMedia.map((item) => (
              <MediaCard
                key={item.id}
                media={item}
                onSelectForAutomation={onSelectForAutomation}
                isSelected={selectedMediaId === item.id}
              />
            ))}
          </div>

          {/* Load More */}
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="gap-2"
              >
                {loadingMore && <Spinner size="sm" />}
                Load more posts
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
