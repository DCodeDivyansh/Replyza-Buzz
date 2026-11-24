"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Automation, AutomationStatus } from "@/types/automation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { formatDate } from "@/lib/utils";
import {
  Bot,
  Plus,
  Search,
  ExternalLink,
  Play,
  Pause,
  Trash2,
  Edit2,
  Eye,
  UserCheck,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AutomationStatus>(
    "ALL"
  );

  // Status updating state
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Delete modal state
  const [deletingAutomation, setDeletingAutomation] =
    useState<Automation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAutomations() {
      try {
        const res = await apiRequest<Automation[]>("/automations");
        if (isMounted) {
          setAutomations(res.data || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiClientError) {
            setError(err.message);
          } else {
            setError("Failed to load automations list.");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAutomations();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered automations
  const filteredAutomations = useMemo(() => {
    return automations.filter((auto) => {
      const matchesSearch =
        auto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        auto.mediaId.includes(searchQuery) ||
        auto.keywords.some((kw) =>
          kw.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesStatus =
        statusFilter === "ALL" || auto.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [automations, searchQuery, statusFilter]);

  // Handle status toggle (ACTIVE <-> PAUSED)
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
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Failed to update status.");
      }
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Handle delete
  const handleDeleteConfirm = async () => {
    if (!deletingAutomation) return;
    setIsDeleting(true);

    try {
      await apiRequest(`/automations/${deletingAutomation.id}`, {
        method: "DELETE",
      });

      setAutomations((prev) =>
        prev.filter((a) => a.id !== deletingAutomation.id)
      );
      setDeletingAutomation(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Failed to delete automation.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            Automations
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Create and monitor comment-triggered automation rules for your Instagram posts
          </p>
        </div>
        <Link href="/automations/new">
          <Button size="sm" className="gap-1.5 shadow-xs">
            <Plus className="h-4 w-4" />
            <span>Create Automation</span>
          </Button>
        </Link>
      </div>

      <ErrorAlert message={error || ""} onDismiss={() => setError(null)} />

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by name, post ID, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(["ALL", "ACTIVE", "PAUSED", "DRAFT"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {status === "ALL" ? "All Automations" : status}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Automations List / Grid */}
      {isLoading ? (
        <div className="py-16">
          <Spinner size="md" label="Loading your automations..." />
        </div>
      ) : filteredAutomations.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-6 w-6 text-zinc-400" />}
          title={
            automations.length === 0
              ? "No automations created yet"
              : "No matching automations found"
          }
          description={
            automations.length === 0
              ? "Set up your first rule to automatically reply to comments and send direct messages."
              : "Try adjusting your search query or filter."
          }
          action={
            automations.length === 0 ? (
              <Link href="/automations/new">
                <Button size="sm">Create Automation</Button>
              </Link>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredAutomations.map((auto) => {
            const isUpdating = updatingStatusId === auto.id;

            return (
              <Card
                key={auto.id}
                className="hover:border-zinc-300 transition-colors"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={`/automations/${auto.id}`}
                        className="text-sm font-semibold text-zinc-900 hover:text-indigo-600 hover:underline truncate"
                      >
                        {auto.name}
                      </Link>
                      <Badge status={auto.status} />
                      <span className="text-[11px] text-zinc-500 font-mono bg-zinc-100 px-2 py-0.5 rounded">
                        {auto.triggerType === "KEYWORD"
                          ? `Keyword (${auto.keywords.length})`
                          : "Any Comment"}
                      </span>
                      {auto.followRequired && (
                        <span className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> Follow-to-Get-Link
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <InstagramIcon className="h-3 w-3 text-pink-600" />
                        {auto.instagramAccount?.username
                          ? `@${auto.instagramAccount.username}`
                          : `Account: ${auto.instagramAccountId.slice(0, 8)}...`}
                      </span>
                      <span>Media ID: {auto.mediaId}</span>
                      <span>Created {formatDate(auto.createdAt)}</span>
                      {auto.mediaPermalink && (
                        <a
                          href={auto.mediaPermalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Post
                        </a>
                      )}
                    </div>

                    {auto.triggerType === "KEYWORD" && auto.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {auto.keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                    {/* Status Toggle Button */}
                    {auto.status === "ACTIVE" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={isUpdating}
                        onClick={() => handleToggleStatus(auto, "PAUSED")}
                        className="gap-1.5 text-amber-700 hover:bg-amber-50"
                        title="Pause automation"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={isUpdating}
                        onClick={() => handleToggleStatus(auto, "ACTIVE")}
                        className="gap-1.5 text-emerald-700 hover:bg-emerald-50"
                        title="Activate automation"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Activate</span>
                      </Button>
                    )}

                    <Link href={`/automations/${auto.id}`}>
                      <Button variant="ghost" size="sm" title="View details">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>

                    <Link href={`/automations/${auto.id}/edit`}>
                      <Button variant="ghost" size="sm" title="Edit automation">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingAutomation(auto)}
                      className="text-zinc-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete automation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingAutomation}
        onClose={() => setDeletingAutomation(null)}
        title="Delete Automation"
        description="Are you sure you want to permanently delete this automation?"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-zinc-600">
            Deleting <strong>{deletingAutomation?.name}</strong> will cease all automated comment replies and direct messages for post ID{" "}
            <code>{deletingAutomation?.mediaId}</code>. This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeletingAutomation(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
