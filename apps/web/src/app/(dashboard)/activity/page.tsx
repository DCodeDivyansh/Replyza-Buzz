"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Activity, Terminal, Clock, Cpu } from "lucide-react";

export default function ActivityPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">
          Activity & Execution History
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Real-time execution status and comment trigger logs
        </p>
      </div>

      <Card>
        <CardContent className="p-8">
          <EmptyState
            icon={<Activity className="h-6 w-6 text-indigo-600" />}
            title="Activity Logs API Unavailable"
            description="The current Replyza backend API does not yet expose an execution history query endpoint. Background worker jobs process webhook events asynchronously directly into PostgreSQL."
            className="border-0 bg-transparent p-0"
          />

          <div className="mt-8 border-t border-zinc-100 pt-6 space-y-4">
            <h4 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
              Background Architecture Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-900 text-xs font-semibold">
                  <Terminal className="h-4 w-4 text-indigo-600" />
                  <span>Meta Webhooks</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Incoming comment events are verified with HMAC-SHA256 signatures and saved in the <code>webhook_events</code> table.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-900 text-xs font-semibold">
                  <Cpu className="h-4 w-4 text-indigo-600" />
                  <span>Worker Queue</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  The Replyza BullMQ worker processes executions with lease locks, idempotency keys, and exponential backoff.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-900 text-xs font-semibold">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  <span>Future Endpoint</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Once <code>GET /api/v1/automations/:id/executions</code> is released on the API, full live audit logs will render here.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
