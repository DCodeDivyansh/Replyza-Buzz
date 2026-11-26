"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141413]">
            Automations
          </h2>
          <p className="text-xs text-[#5C5B57] mt-0.5">
            Manage comment-to-DM triggers, product attachments, and activation status.
          </p>
        </div>

        <Link href="/automations/new">
          <Button variant="accent" size="sm">
            <Plus className="h-3.5 w-3.5" />
            New Automation
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, keyword, or media ID..."
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[#E6E5E1] bg-[#FFFFFF] p-1 self-start">
          {(["ALL", "ACTIVE", "DRAFT", "PAUSED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === status
                  ? "bg-[#141413] text-[#FAF9F6]"
                  : "text-[#5C5B57] hover:text-[#141413]"
              }`}
            >
              {status === "ALL" ? "All" : status}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Table / List */}
      {isLoading ? (
        <div className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-[#F3F2EE] animate-pulse" />
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
              <Link href="/automations/new">
                <Button variant="primary" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Create Automation
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E5E1] bg-[#FAF9F6] text-[11px] font-mono-num uppercase text-[#5C5B57]">
                  <th className="py-3 px-4 font-medium">Automation</th>
                  <th className="py-3 px-4 font-medium">Keywords</th>
                  <th className="py-3 px-4 font-medium">Products</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Updated</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E5E1] text-xs">
                {filteredAutomations.map((auto) => {
                  const productCount = auto.products?.length ?? (auto.dmLink ? 1 : 0);
                  return (
                    <tr key={auto.id} className="hover:bg-[#FAF9F6]">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/automations/${auto.id}`}
                          className="font-semibold text-[#141413] hover:text-[#D94E28] transition-colors"
                        >
                          {auto.name}
                        </Link>
                        <div className="text-[11px] text-[#8C8A84] mt-0.5">
                          @{auto.instagramAccount?.username || "instagram"} ·{" "}
                          {auto.mediaId ? "Specific Post" : "All Posts"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {auto.triggerType === "ANY_COMMENT" ? (
                          <span className="font-mono-num text-[11px] text-[#5C5B57]">
                            ANY_COMMENT
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {auto.keywords.slice(0, 3).map((kw) => (
                              <span
                                key={kw}
                                className="font-mono-num rounded bg-[#F3F2EE] px-1.5 py-0.5 text-[10px] font-medium text-[#141413]"
                              >
                                {kw}
                              </span>
                            ))}
                            {auto.keywords.length > 3 && (
                              <span className="font-mono-num text-[10px] text-[#8C8A84]">
                                +{auto.keywords.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono-num text-xs text-[#141413]">
                          <ShoppingBag className="h-3.5 w-3.5 text-[#5C5B57]" />
                          {productCount}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge status={auto.status} />
                      </td>

                      <td className="py-3.5 px-4 font-mono-num text-[11px] text-[#8C8A84]">
                        {formatDate(auto.updatedAt)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {auto.status === "ACTIVE" ? (
                            <button
                              type="button"
                              disabled={updatingStatusId === auto.id}
                              onClick={() => handleToggleStatus(auto, "PAUSED")}
                              className="p-1.5 rounded-md text-[#5C5B57] hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                              title="Pause automation"
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={updatingStatusId === auto.id}
                              onClick={() => handleToggleStatus(auto, "ACTIVE")}
                              className="p-1.5 rounded-md text-[#5C5B57] hover:text-[#0D7A5F] hover:bg-[#ECF7F3] cursor-pointer"
                              title="Activate automation"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <Link
                            href={`/automations/${auto.id}`}
                            className="p-1.5 rounded-md text-[#5C5B57] hover:text-[#141413] hover:bg-[#F3F2EE]"
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/automations/${auto.id}/edit`}
                            className="p-1.5 rounded-md text-[#5C5B57] hover:text-[#141413] hover:bg-[#F3F2EE]"
                            title="Edit automation"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeletingAutomation(auto)}
                            className="p-1.5 rounded-md text-[#5C5B57] hover:text-[#C81E1E] hover:bg-red-50 cursor-pointer"
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
