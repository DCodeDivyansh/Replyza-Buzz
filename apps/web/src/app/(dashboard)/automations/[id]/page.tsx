"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Automation, ExecutionListResponse, ExecutionRecord } from "@/types/automation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Play,
  Pause,
  ExternalLink,
  MessageSquare,
  Send,
  Link as LinkIcon,
  Clock,
  UserCheck,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

export default function AutomationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    async function loadAutomation() {
      try {
        const [autoRes, execRes] = await Promise.all([
          apiRequest<Automation>(`/automations/${id}`),
          apiRequest<ExecutionListResponse>(`/automations/${id}/executions?limit=5`).catch(() => null),
        ]);
        setAutomation(autoRes.data || null);
        if (execRes?.data?.items) {
          setRecentExecutions(execRes.data.items);
        }
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError("Failed to load automation details.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadAutomation();
  }, [id]);

  const handleToggleStatus = async () => {
    if (!automation) return;
    const nextStatus = automation.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setIsUpdatingStatus(true);

    try {
      const res = await apiRequest<Automation>(`/automations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.data) {
        setAutomation(res.data);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Failed to update status.");
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiRequest(`/automations/${id}`, {
        method: "DELETE",
      });
      router.push("/automations");
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Failed to delete automation.");
      }
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="md" label="Loading automation details..." />
      </div>
    );
  }

  if (error || !automation) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <ErrorAlert message={error || "Automation not found"} />
        <Link href="/automations">
          <Button variant="secondary" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Automations</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/automations">
            <Button variant="ghost" size="sm" className="p-2 text-zinc-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                {automation.name}
              </h2>
              <Badge status={automation.status} />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Created on {formatDate(automation.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {automation.status === "ACTIVE" ? (
            <Button
              variant="secondary"
              size="sm"
              isLoading={isUpdatingStatus}
              onClick={handleToggleStatus}
              className="gap-1.5 text-amber-700 hover:bg-amber-50"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Pause</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              isLoading={isUpdatingStatus}
              onClick={handleToggleStatus}
              className="gap-1.5 text-emerald-700 hover:bg-emerald-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Activate</span>
            </Button>
          )}

          <Link href={`/automations/${id}/edit`}>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-2"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 cols: Main details */}
        <div className="md:col-span-2 space-y-6">
          {/* Triggers & Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Trigger Condition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Trigger Mode</span>
                <span className="font-semibold text-zinc-800">
                  {automation.triggerType === "KEYWORD"
                    ? "Specific Keywords"
                    : "Any Comment"}
                </span>
              </div>

              {automation.triggerType === "KEYWORD" && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">
                    Matching Keywords ({automation.keywords.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {automation.keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-md border border-indigo-100"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Automated Responses */}
          <Card>
            <CardHeader>
              <CardTitle>Automated Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Public reply */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Public Comment Reply</span>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 leading-relaxed">
                  {automation.publicReplyText}
                </div>
              </div>

              {/* Private DM */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                  <Send className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Private Direct Message</span>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {automation.dmMessageText}
                </div>
              </div>

              {/* DM Link */}
              {automation.dmLink && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                    <LinkIcon className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Attached Call-to-Action Link</span>
                  </div>
                  <a
                    href={automation.dmLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                  >
                    <span>{automation.dmLink}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Follow-to-Get-Link Status */}
              {automation.followRequired && (
                <div className="space-y-2 pt-3 border-t border-zinc-150">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                    <UserCheck className="h-3.5 w-3.5 text-purple-600" />
                    <span>Follow-to-Get-Link (Gate Active)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100 text-xs text-purple-900 space-y-1.5">
                    <p>
                      <strong>Instruction:</strong> {automation.followInstructionText || "Follow to get link"}
                    </p>
                    {automation.followSuccessText && (
                      <p>
                        <strong>Success Delivery:</strong> {automation.followSuccessText}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 col: Post & Account Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Instagram Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div>
                <p className="text-zinc-400 font-medium">Connected Account</p>
                <div className="flex items-center gap-1.5 font-semibold text-zinc-800 mt-0.5">
                  <InstagramIcon className="h-3.5 w-3.5 text-pink-600" />
                  <span>
                    {automation.instagramAccount?.username
                      ? `@${automation.instagramAccount.username}`
                      : "Instagram"}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-zinc-400 font-medium">Media ID</p>
                <p className="font-mono text-zinc-700 break-all mt-0.5">
                  {automation.mediaId}
                </p>
              </div>

              {automation.mediaType && (
                <div>
                  <p className="text-zinc-400 font-medium">Media Type</p>
                  <p className="font-medium text-zinc-700 mt-0.5">
                    {automation.mediaType}
                  </p>
                </div>
              )}

              {automation.mediaPermalink && (
                <div className="pt-2">
                  <a
                    href={automation.mediaPermalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    <span>View Post on Instagram</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </CardContent>

            <CardFooter className="text-[11px] text-zinc-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Last updated: {formatDateTime(automation.updatedAt)}</span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Recent Executions</CardTitle>
              <Link href="/activity" className="text-xs font-medium text-indigo-600 hover:underline">
                View All
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {recentExecutions.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No comment executions recorded yet for this automation.
                </p>
              ) : (
                recentExecutions.map((exec) => (
                  <div
                    key={exec.id}
                    className="p-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-800 truncate">
                        {exec.webhookEvent.commenterUsername
                          ? `@${exec.webhookEvent.commenterUsername}`
                          : "Instagram User"}
                      </span>
                      <Badge
                        variant={
                          exec.status === "COMPLETED"
                            ? "green"
                            : exec.status === "FAILED"
                              ? "danger"
                              : "paused"
                        }
                      >
                        {exec.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      &ldquo;{exec.webhookEvent.commentText}&rdquo;
                    </p>
                    {(exec.errorMessage || exec.followCheckError) && (
                      <p className="text-[11px] text-red-600">
                        {exec.followCheckError || exec.errorMessage}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Automation"
        description="Are you sure you want to permanently delete this automation?"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-zinc-600">
            This will permanently remove <strong>{automation.name}</strong>.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDelete}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
