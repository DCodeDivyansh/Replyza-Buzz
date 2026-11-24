"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import type {
  ExecutionListResponse,
  ExecutionRecord,
  ActionStatusType,
  ExecutionStatusType,
} from "@/types/automation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime } from "@/lib/utils";
import {
  Activity,
  RefreshCw,
  MessageSquare,
  Send,
  UserCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

function getExecutionBadge(status: ExecutionStatusType) {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Completed",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "PROCESSING":
      return {
        label: "Processing",
        className: "bg-indigo-50 text-indigo-700 border-indigo-200",
        icon: <Clock className="h-3 w-3" />,
      };
    case "RETRY_PENDING":
      return {
        label: "Retry pending",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <RefreshCw className="h-3 w-3" />,
      };
    case "PARTIAL":
      return {
        label: "Partial / Uncertain",
        className: "bg-amber-50 text-amber-800 border-amber-200",
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    case "FAILED":
      return {
        label: "Failed",
        className: "bg-red-50 text-red-700 border-red-200",
        icon: <XCircle className="h-3 w-3" />,
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        className: "bg-zinc-100 text-zinc-600 border-zinc-200",
        icon: <XCircle className="h-3 w-3" />,
      };
    default:
      return {
        label: "Queued",
        className: "bg-zinc-100 text-zinc-700 border-zinc-200",
        icon: <Clock className="h-3 w-3" />,
      };
  }
}

function getActionLabel(
  kind: "public" | "private",
  status: ActionStatusType
): { label: string; className: string } {
  const successLabel = kind === "public" ? "Comment replied" : "DM sent";
  switch (status) {
    case "SUCCESS":
      return {
        label: successLabel,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "UNKNOWN":
      return {
        label: "Delivery unknown",
        className: "bg-orange-50 text-orange-800 border-orange-200",
      };
    case "RETRY_PENDING":
      return {
        label: "Retry pending",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "FAILED":
      return {
        label: "Failed",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    case "PROCESSING":
      return {
        label: "Processing",
        className: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "SKIPPED":
    case "CANCELLED":
      return {
        label: "Skipped",
        className: "bg-zinc-100 text-zinc-600 border-zinc-200",
      };
    default:
      return {
        label: "Pending",
        className: "bg-zinc-100 text-zinc-700 border-zinc-200",
      };
  }
}

function getFollowBadge(exec: ExecutionRecord): { label: string; className: string } | null {
  if (!exec.automation.followRequired) return null;
  if (exec.followCheckStatus === "SUCCESS" && exec.followVerificationOutcome === "VERIFIED") {
    return {
      label: "Follow verified",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (exec.followCheckStatus === "UNKNOWN") {
    return {
      label: "Follow DM unknown",
      className: "bg-orange-50 text-orange-800 border-orange-200",
    };
  }
  if (exec.followCheckStatus === "RETRY_PENDING") {
    return {
      label: "Follow retry pending",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  if (exec.followCheckStatus === "FAILED") {
    if (exec.followVerificationOutcome === "UNSUPPORTED") {
      return {
        label: "Verification unsupported",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    }
    if (exec.followVerificationOutcome === "PERMISSION_DENIED") {
      return {
        label: "Permission denied",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    }
    if (exec.followVerificationOutcome === "NOT_FOLLOWING") {
      return {
        label: "Not following",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }
    return {
      label: "Follow verification failed",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }
  return {
    label: "Awaiting follow",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
}

export default function ActivityPage() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutionsData = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    });
    if (statusFilter) {
      params.set("status", statusFilter);
    }

    const res = await apiRequest<ExecutionListResponse>(
      `/automations/executions?${params.toString()}`
    );
    return res.data;
  }, [page, statusFilter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchExecutionsData();
      if (data) {
        setExecutions(data.items);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to load execution history.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchExecutionsData()
      .then((data) => {
        if (!cancelled && data) {
          setExecutions(data.items);
          setTotalPages(data.pagination.totalPages);
          setTotal(data.pagination.total);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load execution history."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchExecutionsData]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            Activity & Execution History
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time database-backed status for comment replies, DMs, and follow checks ({total} total)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by execution status"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
            <option value="RETRY_PENDING">Retry Pending</option>
            <option value="PARTIAL">Partial / Unknown</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Queued</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState
              icon={<Activity className="h-6 w-6 text-indigo-600" />}
              title="No Executions Found"
              description={
                statusFilter
                  ? "No automation executions match the selected status filter."
                  : "When users comment on your automated Instagram posts, real-time execution statuses and delivery logs will appear here."
              }
              className="border-0 bg-transparent p-0"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {executions.map((exec) => {
            const execBadge = getExecutionBadge(exec.status);
            const publicBadge = getActionLabel("public", exec.publicReplyStatus);
            const privateBadge = getActionLabel("private", exec.privateReplyStatus);
            const followBadge = getFollowBadge(exec);
            const hasUnknown =
              exec.publicReplyStatus === "UNKNOWN" ||
              exec.privateReplyStatus === "UNKNOWN" ||
              exec.followCheckStatus === "UNKNOWN";

            return (
              <Card key={exec.id} className="overflow-hidden">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/automations/${exec.automation.id}`}
                          className="text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                        >
                          {exec.automation.name}
                        </Link>
                        <span className="text-xs text-zinc-400">
                          {exec.automation.instagramAccount.username
                            ? `@${exec.automation.instagramAccount.username}`
                            : exec.automation.instagramAccount.instagramUserId}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Comment by{" "}
                        <span className="font-medium text-zinc-700">
                          {exec.webhookEvent.commenterUsername
                            ? `@${exec.webhookEvent.commenterUsername}`
                            : "Instagram User"}
                        </span>
                        : &ldquo;{exec.webhookEvent.commentText}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${execBadge.className}`}
                      >
                        {execBadge.icon}
                        {execBadge.label}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {formatDateTime(exec.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Per-action confirmed statuses */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-md border ${publicBadge.className}`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Public: {publicBadge.label}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-md border ${privateBadge.className}`}
                    >
                      <Send className="h-3 w-3" />
                      DM: {privateBadge.label}
                    </span>

                    {followBadge && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-md border ${followBadge.className}`}
                      >
                        <UserCheck className="h-3 w-3" />
                        Follow: {followBadge.label}
                      </span>
                    )}

                    {exec.retryCount > 0 && (
                      <span className="text-[11px] text-zinc-500">
                        Retries: {exec.retryCount}
                      </span>
                    )}
                  </div>

                  {/* Explicit failure or unknown delivery notice */}
                  {hasUnknown && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-900">
                      <HelpCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Delivery outcome uncertain:</span>{" "}
                        {exec.errorMessage ||
                          exec.followCheckError ||
                          "Meta did not return a definitive response. Automatic resend is blocked to prevent duplicate messages."}
                      </div>
                    </div>
                  )}

                  {!hasUnknown && (exec.errorMessage || exec.followCheckError) && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Detail:</span>{" "}
                        {exec.followCheckError || exec.errorMessage}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
