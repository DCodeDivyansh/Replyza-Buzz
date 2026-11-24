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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDate } from "@/lib/utils";
import {
  Bot,
  MessageSquare,
  Send,
  Plus,
  ArrowRight,
  Images,
  LayoutTemplate,
  CheckCircle2,
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
          apiRequest<ExecutionListResponse>("/automations/executions?limit=25").catch(() => null),
        ]);

        if (!cancelled) {
          setAutomations(autoRes.data || []);
          if (accRes?.data) {
            setAccounts(accRes.data);
          }
          if (execRes?.data) {
            setExecutions(execRes.data.items);
            setTotalExecutions(execRes.data.pagination.total);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load dashboard data:", err);
          setError("Unable to load dashboard data at this time.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchDashboardData();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalCount = automations.length;
  const activeCount = automations.filter((a) => a.status === "ACTIVE").length;
  const publicRepliesSent = executions.filter(
    (e) => e.publicReplyStatus === "SUCCESS"
  ).length;
  const dmsSent = executions.filter(
    (e) => e.privateReplyStatus === "SUCCESS"
  ).length;
  const completedExecutions = executions.filter(
    (e) => e.status === "COMPLETED"
  ).length;
  const successRate =
    executions.length > 0
      ? Math.round((completedExecutions / executions.length) * 100)
      : null;

  return (
    <div className="space-y-8">
      {/* Editorial Welcome Banner */}
      <div className="rounded-3xl bg-[#FFFDFB] border border-[#17131D]/8 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E1306C]">
            Workspace Overview
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#17131D]">
            Welcome back, {user?.email.split("@")[0]}
          </h2>
          <p className="text-xs sm:text-sm text-[#827D87]">
            Monitor your Instagram connections, active comment-to-DM workflows, and live delivery outcomes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/instagram">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <InstagramIcon className="h-3.5 w-3.5 text-[#E1306C]" />
              <span>Instagram Health</span>
            </Button>
          </Link>
          <Link href="/automations/new">
            <Button variant="gradient" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>Create Automation</span>
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Real Database Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#827D87]">Connected Accounts</p>
              <div className="h-8 w-8 rounded-xl bg-[#E1306C]/10 text-[#E1306C] flex items-center justify-center">
                <InstagramIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-7 w-14 bg-[#F8F5F8] rounded animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-[#17131D]">
                    {accounts.length}
                  </span>
                  <span className="text-[11px] text-[#827D87]">
                    {accounts.filter((a) => a.webhookSubscribed).length} subscribed
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#827D87]">Active Automations</p>
              <div className="h-8 w-8 rounded-xl bg-[#833AB4]/10 text-[#833AB4] flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-7 w-14 bg-[#F8F5F8] rounded animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-[#17131D]">
                    {activeCount}
                  </span>
                  <span className="text-[11px] text-[#827D87]">
                    of {totalCount} total
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#827D87]">Comments Processed</p>
              <div className="h-8 w-8 rounded-xl bg-[#F77737]/10 text-[#F77737] flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-7 w-14 bg-[#F8F5F8] rounded animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-[#17131D]">
                    {totalExecutions}
                  </span>
                  <span className="text-[11px] text-[#827D87]">
                    {publicRepliesSent} public / {dmsSent} DMs
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#827D87]">Delivery Success</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-7 w-14 bg-[#F8F5F8] rounded animate-pulse" />
              ) : successRate !== null ? (
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-[#17131D]">
                    {successRate}%
                  </span>
                  <span className="text-[11px] text-[#827D87]">
                    recent {executions.length} runs
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[#827D87]">No executions yet</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/media" className="group">
          <div className="flex items-start gap-4 p-5 rounded-2xl border border-[#17131D]/8 bg-[#FFFDFB] hover:border-[#E1306C]/40 transition-all">
            <div className="h-10 w-10 rounded-xl bg-[#F8F5F8] text-[#17131D] flex items-center justify-center shrink-0 group-hover:ig-gradient group-hover:text-white transition-all">
              <Images className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-[#17131D] flex items-center gap-1.5">
                Instagram Media Library <ArrowRight className="h-3.5 w-3.5 text-[#E1306C]" />
              </h3>
              <p className="text-xs text-[#827D87] mt-1">
                Browse your live Instagram posts and Reels and launch an automation in one click.
              </p>
            </div>
          </div>
        </Link>

        <Link href="/templates" className="group">
          <div className="flex items-start gap-4 p-5 rounded-2xl border border-[#17131D]/8 bg-[#FFFDFB] hover:border-[#833AB4]/40 transition-all">
            <div className="h-10 w-10 rounded-xl bg-[#F8F5F8] text-[#17131D] flex items-center justify-center shrink-0 group-hover:ig-gradient group-hover:text-white transition-all">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-[#17131D] flex items-center gap-1.5">
                Strategy Templates <ArrowRight className="h-3.5 w-3.5 text-[#833AB4]" />
              </h3>
              <p className="text-xs text-[#827D87] mt-1">
                Start with tested Comment-to-DM, Promo Code, and Follow-to-Get-Link templates.
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Two-Column Overview: Recent Executions + Connected Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#E1306C]" />
              Recent Executions
            </CardTitle>
            <Link
              href="/activity"
              className="text-xs font-semibold text-[#E1306C] hover:underline"
            >
              View Activity
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-[#F8F5F8] animate-pulse" />
                ))}
              </div>
            ) : executions.length === 0 ? (
              <EmptyState
                icon={<Bot className="h-5 w-5 text-[#833AB4]" />}
                title="No comment executions yet"
                description="Once an active automation matches an Instagram comment, live execution logs will appear here."
                className="border-0 bg-transparent p-4"
              />
            ) : (
              <div className="space-y-2.5">
                {executions.slice(0, 5).map((exec) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F8F5F8] text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#17131D] truncate">
                        {exec.automation.name}
                      </p>
                      <p className="text-[11px] text-[#827D87] truncate">
                        {exec.webhookEvent.commenterUsername
                          ? `@${exec.webhookEvent.commenterUsername}`
                          : "Instagram User"}
                        : &ldquo;{exec.webhookEvent.commentText}&rdquo;
                      </p>
                    </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <InstagramIcon className="h-4 w-4 text-[#E1306C]" />
              Connected Accounts
            </CardTitle>
            <Link
              href="/instagram"
              className="text-xs font-semibold text-[#E1306C] hover:underline"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-24 rounded-xl bg-[#F8F5F8] animate-pulse" />
            ) : accounts.length === 0 ? (
              <EmptyState
                icon={<InstagramIcon className="h-5 w-5 text-[#E1306C]" />}
                title="No Instagram account connected"
                description="Connect your Instagram Professional account to start automating replies and DMs."
                action={
                  <Link href="/instagram">
                    <Button size="sm" variant="gradient">
                      Connect Instagram
                    </Button>
                  </Link>
                }
                className="border-0 bg-transparent p-4"
              />
            ) : (
              <div className="space-y-2.5">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-xl bg-[#F8F5F8] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#17131D] truncate">
                        {acc.username ? `@${acc.username}` : acc.instagramUserId}
                      </p>
                      <p className="text-[11px] text-[#827D87]">
                        {acc.status === "NEEDS_RECONNECT"
                          ? "Token expired — reconnect required"
                          : acc.webhookSubscribed
                            ? "Webhooks subscribed"
                            : "Webhook subscription missing"}
                      </p>
                    </div>
                    {acc.status === "NEEDS_RECONNECT" || !acc.webhookSubscribed ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Automations */}
      {automations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Automations</CardTitle>
            <Link
              href="/automations"
              className="text-xs font-semibold text-[#E1306C] hover:underline"
            >
              All Automations
            </Link>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {automations.slice(0, 4).map((auto) => (
              <Link
                key={auto.id}
                href={`/automations/${auto.id}`}
                className="p-4 rounded-2xl bg-[#F8F5F8] hover:bg-[#F3EDF3] transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-[#17131D] truncate">
                    {auto.name}
                  </p>
                  <p className="text-[11px] text-[#827D87] mt-0.5">
                    {auto.triggerType === "ANY_COMMENT"
                      ? "Any comment"
                      : `Keywords: ${auto.keywords.join(", ")}`}{" "}
                    • Updated {formatDate(auto.updatedAt)}
                  </p>
                </div>
                <Badge status={auto.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
