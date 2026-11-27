"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Automation, AutomationStatus } from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  Search,
  Play,
  Pause,
  Trash2,
  Edit2,
  Eye,
  ShoppingBag,
} from "lucide-react";

const STATUS_TABS: Array<{ id: "ALL" | AutomationStatus; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "PAUSED", label: "Paused" },
  { id: "DRAFT", label: "Drafts" },
  { id: "EXPIRED", label: "Expired" },
];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AutomationStatus>("ALL");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [deletingAutomation, setDeletingAutomation] = useState<Automation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    apiRequest<Automation[]>("/automations")
      .then((res) => {
        if (isMounted) {
          setAutomations(res.data || []);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load automations list."
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAutomations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return automations.filter((auto) => {
      const matchesSearch =
        auto.name.toLowerCase().includes(q) ||
        (auto.mediaId ?? "all posts").toLowerCase().includes(q) ||
        auto.keywords.some((kw) => kw.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "ALL" || auto.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [automations, searchQuery, statusFilter]);

  const handleToggleStatus = async (
    auto: Automation,
    newStatus: "ACTIVE" | "PAUSED"
  ) => {
    setUpdatingStatusId(auto.id);
    try {
      const res = await apiRequest<Automation>(`/automations/${auto.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.data) {
        setAutomations((prev) =>
          prev.map((item) =>
            item.id === auto.id ? { ...item, status: newStatus } : item
          )
        );
        toast.success(
          newStatus === "ACTIVE" ? "Automation activated" : "Automation paused"
        );
      }
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to update status."
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingAutomation) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/automations/${deletingAutomation.id}`, {
        method: "DELETE",
      });
      setAutomations((prev) =>
        prev.filter((item) => item.id !== deletingAutomation.id)
      );
      setDeletingAutomation(null);
      toast.success("Automation deleted");
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to delete automation."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E655F]">
            WORKFLOWS
          </p>
          <h2 className="font-display text-2xl font-bold text-[#161413] mt-0.5">
            Automations
          </h2>
        </div>

        <Link
          href="/automations/new"
          className="group self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-[#161413] pl-4 pr-1.5 py-1.5 text-xs font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
        >
          <span>New Automation</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 group-hover:rotate-90">
            <Plus className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>

      {/* Filter Bar with layoutId active indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-[#E6DFD8] bg-[#FFFFFF] p-1 self-start overflow-x-auto max-w-full">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active ? "text-[#FFFFFF]" : "text-[#6E655F] hover:text-[#161413]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="automations-filter-pill"
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-[#161413]"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="w-full md:w-72">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, keyword, or media..."
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {isLoading ? (
        <div className="rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-[#F2EBE4] animate-pulse" />
          ))}
        </div>
      ) : filteredAutomations.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-5 w-5" />}
          title={automations.length === 0 ? "No automations yet" : "No matching automations"}
          description={
            automations.length === 0
              ? "Create your first comment-to-DM automation to deliver product links automatically."
              : "Try clearing your search or status filter."
          }
          action={
            automations.length === 0 ? (
              <Link
                href="/automations/new"
                className="inline-flex items-center gap-2 rounded-full bg-[#161413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#E1306C] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Automation
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Table (>= 768px) */}
          <div className="hidden md:block rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6DFD8] bg-[#F7F1EC]/60 font-mono-num text-[11px] uppercase text-[#6E655F]">
                    <th className="py-3 px-5 font-semibold">Automation</th>
                    <th className="py-3 px-4 font-semibold">Keywords</th>
                    <th className="py-3 px-4 font-semibold">Products</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Updated</th>
                    <th className="py-3 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DFD8] text-xs">
                  {filteredAutomations.map((auto) => {
                    const productCount = auto.products?.length ?? (auto.dmLink ? 1 : 0);
                    return (
                      <tr key={auto.id} className="hover:bg-[#F7F1EC]/50 transition-colors">
                        <td className="py-3.5 px-5">
                          <Link
                            href={`/automations/${auto.id}`}
                            className="font-semibold text-[#161413] hover:text-[#E1306C] transition-colors"
                          >
                            {auto.name}
                          </Link>
                          <div className="font-mono-num text-[10px] text-[#6E655F] mt-0.5">
                            @{auto.instagramAccount?.username || "instagram"} ·{" "}
                            {auto.mediaId
                              ? "Specific Post"
                              : auto.targetMode === "SCHEDULED_TIME"
                                ? "Scheduled Post"
                                : auto.targetMode === "NEXT_POST"
                                  ? "Next Post"
                                  : "All Posts"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {auto.triggerType === "ANY_COMMENT" ? (
                            <span className="font-mono-num rounded-full bg-[#FCE8EC] text-[#E1306C] px-2.5 py-0.5 text-[10px] font-semibold">
                              ANY_COMMENT
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {auto.keywords.slice(0, 3).map((kw) => (
                                <span
                                  key={kw}
                                  className="font-mono-num rounded-full bg-[#FCE8EC] text-[#E1306C] px-2.5 py-0.5 text-[10px] font-semibold"
                                >
                                  {kw}
                                </span>
                              ))}
                              {auto.keywords.length > 3 && (
                                <span className="font-mono-num text-[10px] text-[#6E655F]">
                                  +{auto.keywords.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono-num font-semibold text-[#161413]">
                          <span className="inline-flex items-center gap-1">
                            <ShoppingBag className="h-3.5 w-3.5 text-[#6E655F]" />
                            {productCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={auto.status}>
                            {auto.status === "SCHEDULED" && auto.scheduledActivateAt
                              ? `Scheduled for ${new Date(auto.scheduledActivateAt).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}`
                              : auto.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-[11px] text-[#6E655F]">
                          {formatDate(auto.updatedAt)}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-1">
                            {auto.status === "ACTIVE" ? (
                              <button
                                type="button"
                                disabled={updatingStatusId === auto.id}
                                onClick={() => handleToggleStatus(auto, "PAUSED")}
                                className="p-1.5 rounded-lg text-[#6E655F] hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                                title="Pause automation"
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={updatingStatusId === auto.id}
                                onClick={() => handleToggleStatus(auto, "ACTIVE")}
                                className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#0D7A5F] hover:bg-[#ECF7F3] cursor-pointer"
                                title="Activate automation"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <Link
                              href={`/automations/${auto.id}`}
                              className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#161413] hover:bg-[#F2EBE4]"
                              title="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            <Link
                              href={`/automations/${auto.id}/edit`}
                              className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#161413] hover:bg-[#F2EBE4]"
                              title="Edit automation"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeletingAutomation(auto)}
                              className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#E1306C] hover:bg-[#FCE8EC] cursor-pointer"
                              title="Delete automation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Stacked Cards (< 768px) */}
          <div className="md:hidden space-y-3">
            {filteredAutomations.map((auto) => {
              const productCount = auto.products?.length ?? (auto.dmLink ? 1 : 0);
              return (
                <div
                  key={auto.id}
                  className="rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/automations/${auto.id}`}
                        className="font-display text-sm font-bold text-[#161413] truncate block"
                      >
                        {auto.name}
                      </Link>
                      <span className="font-mono-num text-[10px] text-[#6E655F]">
                        {productCount} product(s) · {formatDate(auto.updatedAt)}
                      </span>
                    </div>
                    <Badge status={auto.status} />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {auto.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="font-mono-num rounded-full bg-[#FCE8EC] text-[#E1306C] px-2.5 py-0.5 text-[10px] font-semibold"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#E6DFD8] flex items-center justify-between">
                    <button
                      type="button"
                      disabled={updatingStatusId === auto.id}
                      onClick={() =>
                        handleToggleStatus(
                          auto,
                          auto.status === "ACTIVE" ? "PAUSED" : "ACTIVE"
                        )
                      }
                      className="text-xs font-semibold text-[#161413] flex items-center gap-1.5"
                    >
                      {auto.status === "ACTIVE" ? (
                        <>
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 text-[#0D7A5F]" /> Activate
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/automations/${auto.id}/edit`}
                        className="text-xs font-semibold text-[#6E655F] hover:text-[#161413]"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeletingAutomation(auto)}
                        className="text-xs font-semibold text-[#E1306C]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingAutomation)}
        onClose={() => setDeletingAutomation(null)}
        title="Delete Automation"
        description={`Are you sure you want to delete "${deletingAutomation?.name}"? This cannot be undone.`}
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDeletingAutomation(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            isLoading={isDeleting}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
