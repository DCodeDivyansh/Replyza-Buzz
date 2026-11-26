"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import type {
  Automation,
  ExecutionListResponse,
  ExecutionRecord,
  InstagramAccountInfo,
} from "@/types/automation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  ArrowRight,
  AlertTriangle,
  Activity,
  Pause,
  Play,
  Send,
  ShoppingBag,
  UserCheck,
  MessageSquare,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccountInfo[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [totalExecutions, setTotalExecutions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData() {
      try {
        const [autoRes, accRes, execRes] = await Promise.all([
          apiRequest<Automation[]>("/automations"),
          apiRequest<InstagramAccountInfo[]>("/instagram/accounts").catch(() => null),
          apiRequest<ExecutionListResponse>("/automations/executions?limit=12").catch(() => null),
        ]);

        if (!cancelled) {
          setAutomations(autoRes.data || []);
          if (accRes?.data) setAccounts(accRes.data);
          if (execRes?.data) {
            setExecutions(execRes.data.items);
            setTotalExecutions(execRes.data.pagination.total);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load dashboard data at this time.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchDashboardData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleQuickToggle = async (auto: Automation) => {
    const next = auto.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setTogglingId(auto.id);
    try {
      await apiRequest(`/automations/${auto.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setAutomations((prev) =>
        prev.map((a) => (a.id === auto.id ? { ...a, status: next } : a))
      );
      toast.success(next === "ACTIVE" ? "Automation activated" : "Automation paused");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to toggle status");
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = automations.filter((a) => a.status === "ACTIVE").length;
  const dmsSent = executions.filter((e) => e.privateReplyStatus === "SUCCESS").length;
  const followVerified = executions.filter(
    (e) => e.followVerificationOutcome === "VERIFIED"
  ).length;
  const attachedProducts = automations.reduce(
    (sum, a) => sum + (a.products?.length ?? (a.dmLink ? 1 : 0)),
    0
  );

  const needsReconnect = accounts.some((a) => a.status === "NEEDS_RECONNECT");

  const kpis = [
    {
      label: "Comments Matched",
      value: isLoading ? "—" : totalExecutions,
      badge: `${activeCount} active`,
      icon: MessageSquare,
    },
    {
      label: "DMs Sent",
      value: isLoading ? "—" : dmsSent,
      badge: "Meta API",
      icon: Send,
    },
    {
      label: "Follow-Gate Verified",
      value: isLoading ? "—" : followVerified,
      badge: "Quick Reply",
      icon: UserCheck,
    },
    {
      label: "Product Links Active",
      value: isLoading ? "—" : attachedProducts,
      badge: "UTM Safe",
      icon: ShoppingBag,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Editorial Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E655F]">
            CREATOR WORKSPACE
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#161413] mt-0.5">
            Welcome back, {user?.email.split("@")[0]}
          </h2>
        </div>

        <Link
          href="/automations/new"
          className="group self-start sm:self-auto inline-flex items-center gap-2.5 rounded-full bg-[#161413] pl-5 pr-2 py-2 text-xs sm:text-sm font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors"
        >
          <span>Create Automation</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 group-hover:rotate-90">
            <Plus className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {needsReconnect && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F77737]/40 bg-[#FDF2EE] px-4 py-3">
          <div className="flex items-center gap-2.5 text-xs text-[#161413]">
            <AlertTriangle className="h-4 w-4 text-[#F77737] shrink-0" />
            <span>
              An Instagram account token expired or needs reconnection.
            </span>
          </div>
          <Link
            href="/instagram"
            className="rounded-full bg-[#161413] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#E1306C] transition-colors"
          >
            Reconnect
          </Link>
        </div>
      )}

      {/* 4-Column KPI Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] p-5 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#6E655F]">
                  {kpi.label}
                </span>
                <span className="h-7 w-7 rounded-full bg-[#FCE8EC] text-[#E1306C] flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono-num text-2xl sm:text-3xl font-bold text-[#161413]">
                  {kpi.value}
                </span>
                <span className="font-mono-num rounded-full bg-[#FCE8EC] text-[#E1306C] px-2.5 py-0.5 text-[10px] font-semibold">
                  {kpi.badge}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Split Main Grid (8 cols / 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Active Automations Performance Table */}
        <div className="lg:col-span-8 rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6DFD8] flex items-center justify-between">
            <div>
              <p className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E655F]">
                WORKFLOWS
              </p>
              <h3 className="font-display text-sm sm:text-base font-bold text-[#161413]">
                Automations Performance
              </h3>
            </div>
            <Link
              href="/automations"
              className="text-xs font-semibold text-[#E1306C] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-[#F2EBE4] animate-pulse" />
              ))}
            </div>
          ) : automations.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Bot className="h-5 w-5" />}
                title="No automations created yet"
                description="Build your first Instagram comment-to-DM flow to send product links automatically."
                action={
                  <Link
                    href="/automations/new"
                    className="inline-flex items-center gap-2 rounded-full bg-[#161413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#E1306C] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Automation
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6DFD8] bg-[#F7F1EC]/60 font-mono-num text-[10px] uppercase tracking-wider text-[#6E655F]">
                    <th className="py-2.5 px-5 font-semibold">Automation</th>
                    <th className="py-2.5 px-4 font-semibold">Keywords</th>
                    <th className="py-2.5 px-4 font-semibold">Products</th>
                    <th className="py-2.5 px-5 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DFD8] text-xs">
                  {automations.slice(0, 6).map((auto) => {
                    const prodCount = auto.products?.length ?? (auto.dmLink ? 1 : 0);
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
                            {auto.mediaId ? "Specific Post" : "All Posts & Reels"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {auto.triggerType === "ANY_COMMENT" ? (
                            <span className="font-mono-num rounded-full bg-[#FCE8EC] text-[#E1306C] px-2.5 py-0.5 text-[10px] font-semibold">
                              ANY
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {auto.keywords.slice(0, 2).map((kw) => (
                                <span
                                  key={kw}
                                  className="font-mono-num rounded-full bg-[#FCE8EC] text-[#E1306C] px-2.5 py-0.5 text-[10px] font-semibold"
                                >
                                  {kw}
                                </span>
                              ))}
                              {auto.keywords.length > 2 && (
                                <span className="font-mono-num text-[10px] text-[#6E655F]">
                                  +{auto.keywords.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono-num font-semibold text-[#161413]">
                          {prodCount}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            disabled={togglingId === auto.id}
                            onClick={() => handleQuickToggle(auto)}
                            className="inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Toggle Active / Paused"
                          >
                            <Badge status={auto.status} />
                            {auto.status === "ACTIVE" ? (
                              <Pause className="h-3 w-3 text-[#6E655F]" />
                            ) : (
                              <Play className="h-3 w-3 text-[#6E655F]" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Live Webhook Activity Feed */}
        <div className="lg:col-span-4 rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6DFD8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#E1306C]" />
              <h3 className="font-display text-sm sm:text-base font-bold text-[#161413]">
                Webhook Stream
              </h3>
            </div>
            <Link
              href="/activity"
              className="font-mono-num text-[11px] font-semibold text-[#6E655F] hover:text-[#161413]"
            >
              Logs →
            </Link>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-[#F2EBE4] animate-pulse" />
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6E655F]">
              No comment webhooks received yet. Activate an automation and comment on a Reel to see live events.
            </div>
          ) : (
            <div className="divide-y divide-[#E6DFD8]">
              {executions.slice(0, 6).map((exec, idx) => (
                <motion.div
                  key={exec.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className="p-4 hover:bg-[#F7F1EC]/50 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#161413] truncate">
                      @{exec.webhookEvent.commenterUsername || "ig_user"}
                    </span>
                    <span className="font-mono-num text-[10px] text-[#6E655F] shrink-0">
                      {formatDate(exec.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E655F] truncate">
                    commented &ldquo;{exec.webhookEvent.commentText}&rdquo;
                  </p>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] font-medium text-[#161413] truncate">
                      {exec.automation.name}
                    </span>
                    <Badge
                      variant={
                        exec.status === "COMPLETED"
                          ? "active"
                          : exec.status === "FAILED"
                          ? "danger"
                          : "default"
                      }
                    >
                      {exec.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
