"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import { Automation } from "@/types/automation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDate } from "@/lib/utils";
import {
  Bot,
  MessageSquare,
  Send,
  Plus,
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

export default function DashboardPage() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await apiRequest<Automation[]>("/automations");
        setAutomations(res.data || []);
      } catch (err) {
        console.error("Failed to load automations:", err);
        setError("Unable to load automations at this time.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Compute metrics from actual data
  const totalCount = automations.length;
  const activeCount = automations.filter((a) => a.status === "ACTIVE").length;
  const pausedCount = automations.filter((a) => a.status === "PAUSED").length;
  const draftCount = automations.filter((a) => a.status === "DRAFT").length;

  // Discovered Instagram accounts from automations
  const discoveredAccounts = Array.from(
    new Map(
      automations
        .filter((a) => a.instagramAccount)
        .map((a) => [a.instagramAccount!.id, a.instagramAccount!])
    ).values()
  );

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            Welcome back, {user?.email.split("@")[0]}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Manage your Instagram post comment triggers and automated DM workflows.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/instagram">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <InstagramIcon className="h-3.5 w-3.5 text-zinc-600" />
              <span>Instagram Status</span>
            </Button>
          </Link>
          <Link href="/automations/new">
            <Button size="sm" className="gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Create Automation</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Automations (Real backend data) */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">
                Total Automations
              </p>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-7 w-12 bg-zinc-100 rounded animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-zinc-900">
                    {totalCount}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    ({activeCount} active, {pausedCount} paused, {draftCount} draft)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instagram Connection Status (Real backend state) */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">
                Instagram Account
              </p>
              <div className="h-8 w-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                <InstagramIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-7 w-20 bg-zinc-100 rounded animate-pulse" />
              ) : discoveredAccounts.length > 0 ? (
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-xs font-semibold truncate">
                    @{discoveredAccounts[0].username || discoveredAccounts[0].instagramUserId}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="text-xs">No linked accounts</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comments Processed (Honest Empty State: backend metric API not exposed) */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">
                Comments Processed
              </p>
              <div className="h-8 w-8 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-400">—</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />
                Backend metrics endpoint pending
              </p>
            </div>
          </CardContent>
        </Card>

        {/* DMs Sent (Honest Empty State: backend metric API not exposed) */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">
                Direct Messages Sent
              </p>
              <div className="h-8 w-8 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-400">—</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />
                Backend metrics endpoint pending
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Automations Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle>Recent Automations</CardTitle>
            <p className="text-xs text-zinc-500 mt-0.5">
              Your active and draft automation workflows
            </p>
          </div>
          {automations.length > 0 && (
            <Link
              href="/automations"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>View all ({totalCount})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12">
              <Spinner size="md" label="Loading automations..." />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-red-600">{error}</div>
          ) : automations.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Bot className="h-6 w-6 text-zinc-400" />}
                title="No automations created yet"
                description="Connect your Instagram account and build your first automated comment reply workflow."
                action={
                  <div className="flex items-center gap-3">
                    <Link href="/instagram">
                      <Button variant="secondary" size="sm">
                        Connect Instagram
                      </Button>
                    </Link>
                    <Link href="/automations/new">
                      <Button size="sm">Create Automation</Button>
                    </Link>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50/70 border-b border-zinc-100 text-zinc-500 font-medium">
                  <tr>
                    <th className="py-3 px-6">Name</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Trigger</th>
                    <th className="py-3 px-6">Instagram Account</th>
                    <th className="py-3 px-6">Created</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {automations.slice(0, 5).map((auto) => (
                    <tr
                      key={auto.id}
                      className="hover:bg-zinc-50/50 transition-colors"
                    >
                      <td className="py-3.5 px-6 font-medium text-zinc-900">
                        <Link
                          href={`/automations/${auto.id}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {auto.name}
                        </Link>
                        {auto.mediaPermalink && (
                          <a
                            href={auto.mediaPermalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-zinc-400 ml-2 hover:text-zinc-600"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            Post
                          </a>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <Badge status={auto.status} />
                      </td>
                      <td className="py-3.5 px-6 font-mono text-[11px] text-zinc-600">
                        {auto.triggerType === "KEYWORD" ? (
                          <span className="text-indigo-600">
                            {auto.keywords.length} Keyword{auto.keywords.length !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          "Any Comment"
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-zinc-600">
                        {auto.instagramAccount?.username
                          ? `@${auto.instagramAccount.username}`
                          : auto.instagramAccountId.slice(0, 8) + "..."}
                      </td>
                      <td className="py-3.5 px-6 text-zinc-400">
                        {formatDate(auto.createdAt)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          href={`/automations/${auto.id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
