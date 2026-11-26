"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import type {
  Automation,
  ExecutionListResponse,
  ExecutionRecord,
  InstagramAccountInfo,
} from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDate } from "@/lib/utils";
import {
  Bot,
  Plus,
  ArrowRight,
  ShoppingBag,
  LayoutTemplate,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

export default function DashboardPage() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccountInfo[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [totalExecutions, setTotalExecutions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData() {
      try {
        const [autoRes, accRes, execRes] = await Promise.all([
          apiRequest<Automation[]>("/automations"),
          apiRequest<InstagramAccountInfo[]>("/instagram/accounts").catch(() => null),
          apiRequest<ExecutionListResponse>("/automations/executions?limit=10").catch(() => null),
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
          setError("Unable to load dashboard data right now.");
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

  const totalCount = automations.length;
  const activeCount = automations.filter((a) => a.status === "ACTIVE").length;
  const dmsSent = executions.filter((e) => e.privateReplyStatus === "SUCCESS").length;
  const completedExecutions = executions.filter((e) => e.status === "COMPLETED").length;
  const successRate =
    executions.length > 0
      ? Math.round((completedExecutions / executions.length) * 100)
      : null;

  const needsReconnect = accounts.some((a) => a.status === "NEEDS_RECONNECT");

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141413]">
            Welcome back, {user?.email.split("@")[0]}
          </h2>
          <p className="text-xs text-[#5C5B57] mt-0.5">
            Monitor connected Instagram accounts, active automations, and DM delivery logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products">
            <Button variant="secondary" size="sm">
              <ShoppingBag className="h-3.5 w-3.5" />
              Product Library
            </Button>
          </Link>
          <Link href="/automations/new">
            <Button variant="accent" size="sm">
              <Plus className="h-3.5 w-3.5" />
              New Automation
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-[#C81E1E]">
          {error}
        </div>
      )}

      {needsReconnect && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              An Instagram account token expired or needs reconnection.
            </span>
          </div>
          <Link href="/instagram">
            <Button size="sm" variant="secondary">
              Reconnect
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Stat Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#E6E5E1] rounded-xl border border-[#E6E5E1] overflow-hidden">
        <div className="bg-[#FFFFFF] p-4 sm:p-5">
          <div className="text-[11px] font-medium text-[#5C5B57]">Active Automations</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono-num text-2xl font-bold text-[#141413]">
              {isLoading ? "—" : activeCount}
            </span>
            <span className="font-mono-num text-xs text-[#8C8A84]">
              / {totalCount} total
            </span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] p-4 sm:p-5">
          <div className="text-[11px] font-medium text-[#5C5B57]">Total Triggers</div>
          <div className="mt-1.5">
            <span className="font-mono-num text-2xl font-bold text-[#141413]">
              {isLoading ? "—" : totalExecutions}
            </span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] p-4 sm:p-5">
          <div className="text-[11px] font-medium text-[#5C5B57]">Recent DMs Sent</div>
          <div className="mt-1.5">
            <span className="font-mono-num text-2xl font-bold text-[#0D7A5F]">
              {isLoading ? "—" : dmsSent}
            </span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] p-4 sm:p-5">
          <div className="text-[11px] font-medium text-[#5C5B57]">Completion Rate</div>
          <div className="mt-1.5">
            <span className="font-mono-num text-2xl font-bold text-[#141413]">
              {isLoading ? "—" : successRate !== null ? `${successRate}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Triggers + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent DM Triggers Table */}
        <div className="lg:col-span-8 rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E6E5E1] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#D94E28]" />
              <h3 className="font-display text-sm font-semibold text-[#141413]">
                Recent Comment Triggers
              </h3>
            </div>
            <Link
              href="/activity"
              className="text-xs font-medium text-[#5C5B57] hover:text-[#141413] flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-[#F3F2EE] animate-pulse" />
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Bot className="h-5 w-5" />}
                title="No comment triggers yet"
                description="Once an active automation matches an Instagram comment, delivery logs appear here."
                action={
                  <Link href="/automations/new">
                    <Button size="sm" variant="primary">
                      Create Automation
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E5E1] bg-[#FAF9F6] text-[11px] font-mono-num uppercase text-[#5C5B57]">
                    <th className="py-2.5 px-4 font-medium">Commenter</th>
                    <th className="py-2.5 px-4 font-medium">Automation</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E5E1] text-xs">
                  {executions.slice(0, 6).map((exec) => (
                    <tr key={exec.id} className="hover:bg-[#FAF9F6]">
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#141413]">
                          @{exec.webhookEvent.commenterUsername || "instagram_user"}
                        </div>
                        <div className="text-[11px] text-[#8C8A84] truncate max-w-[180px]">
                          {exec.webhookEvent.commentText}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#5C5B57] font-medium">
                        {exec.automation.name}
                      </td>
                      <td className="py-3 px-4">
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
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-[11px] text-[#8C8A84]">
                        {formatDate(exec.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Connected Accounts & Shortcuts */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-[#141413]">
                Instagram Accounts
              </h3>
              <Link href="/instagram" className="text-xs text-[#D94E28] font-medium">
                Manage
              </Link>
            </div>
            {accounts.length === 0 ? (
              <p className="text-xs text-[#5C5B57]">
                No Instagram account connected yet.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-lg border border-[#E6E5E1] bg-[#FAF9F6] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <InstagramIcon className="h-3.5 w-3.5 text-[#D94E28] shrink-0" />
                      <span className="font-medium text-[#141413] truncate">
                        @{acc.username || acc.instagramUserId}
                      </span>
                    </div>
                    <Badge
                      variant={acc.status === "NEEDS_RECONNECT" ? "danger" : "active"}
                    >
                      {acc.status === "NEEDS_RECONNECT" ? "Reconnect" : "Active"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E6E5E1] bg-[#FFFFFF] p-5 space-y-2.5">
            <h3 className="font-display text-sm font-semibold text-[#141413]">
              Quick Links
            </h3>
            <Link
              href="/templates"
              className="flex items-center justify-between rounded-lg border border-[#E6E5E1] px-3 py-2.5 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6]"
            >
              <span className="flex items-center gap-2">
                <LayoutTemplate className="h-3.5 w-3.5 text-[#5C5B57]" />
                Browse 9 DM Template Categories
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-[#8C8A84]" />
            </Link>
            <Link
              href="/products"
              className="flex items-center justify-between rounded-lg border border-[#E6E5E1] px-3 py-2.5 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6]"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-3.5 w-3.5 text-[#5C5B57]" />
                Manage Affiliate Products
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-[#8C8A84]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
