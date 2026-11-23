"use client";

import React, { useState, useEffect } from "react";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Automation } from "@/types/automation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/feedback/error-alert";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Info,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

interface OAuthStartResponse {
  testPageUrl: string;
}

export default function InstagramPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthSessionUrl, setOauthSessionUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadConnectedAccountsFromAutomations() {
      try {
        const res = await apiRequest<Automation[]>("/automations");
        setAutomations(res.data || []);
      } catch (err) {
        console.warn("Could not retrieve automations for Instagram status:", err);
      } finally {
        setIsLoadingAccounts(false);
      }
    }

    loadConnectedAccountsFromAutomations();
  }, []);

  // Extract unique accounts from automations
  const knownAccounts = Array.from(
    new Map(
      automations
        .filter((a) => a.instagramAccount)
        .map((a) => [a.instagramAccount!.id, a.instagramAccount!])
    ).values()
  );

  const handleStartOAuth = async () => {
    setIsStartingOAuth(true);
    setOauthError(null);
    setOauthSessionUrl(null);

    try {
      // Backend OAuth initiation endpoint
      const res = await apiRequest<OAuthStartResponse>("/instagram/oauth/start");

      if (res.data?.testPageUrl) {
        setOauthSessionUrl(res.data.testPageUrl);
        // Open the Meta OAuth page in a new window/tab
        window.open(res.data.testPageUrl, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("Backend did not return an OAuth test URL");
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setOauthError(err.message);
      } else {
        setOauthError("Failed to initiate Instagram OAuth session.");
      }
    } finally {
      setIsStartingOAuth(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">
          Instagram Account Connection
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Connect your Instagram Professional or Creator account to enable comment triggers and automated direct messaging.
        </p>
      </div>

      <ErrorAlert
        message={oauthError || ""}
        onDismiss={() => setOauthError(null)}
      />

      {/* Connection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
              <InstagramIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Meta Instagram OAuth</CardTitle>
              <CardDescription>
                Uses official Meta Graph API v27.0 with encrypted token storage.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status block */}
          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700">
                Connection Status
              </span>
              {isLoadingAccounts ? (
                <div className="h-4 w-24 bg-zinc-200 rounded animate-pulse" />
              ) : knownAccounts.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Connected ({knownAccounts.length} account{knownAccounts.length > 1 ? "s" : ""})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200">
                  <AlertCircle className="h-3.5 w-3.5 text-zinc-400" />
                  No accounts linked to automations
                </span>
              )}
            </div>

            {knownAccounts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-200/80 space-y-2">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Discovered Active Accounts
                </p>
                {knownAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-zinc-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <InstagramIcon className="h-4 w-4 text-pink-600" />
                      <span className="font-semibold text-zinc-800">
                        {account.username ? `@${account.username}` : "Instagram Account"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[11px] text-zinc-500">
                        ID: {account.id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OAuth Session Action */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-800">
              Initiate Meta Authorization
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Clicking below contacts the backend to generate a secure HMAC-signed OAuth session and opens Meta&apos;s authorization flow. Once authorized, Meta assigns permissions to Replyza to detect comments and send direct messages.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={handleStartOAuth}
                isLoading={isStartingOAuth}
                className="gap-2 shadow-xs"
              >
                <InstagramIcon className="h-4 w-4" />
                <span>Connect Instagram with Meta</span>
              </Button>

              {oauthSessionUrl && (
                <a
                  href={oauthSessionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                >
                  <span>Re-open Authorization Window</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Requirements & Guidelines */}
          <div className="border-t border-zinc-100 pt-5 space-y-3">
            <h4 className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Meta Prerequisites for Automation
            </h4>
            <ul className="space-y-2 text-xs text-zinc-600">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Professional Account:</strong> Your Instagram account must be set to <em>Creator</em> or <em>Business</em> (personal accounts do not support API automation).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Connected Facebook Page:</strong> The Instagram account must be linked to a Facebook Page where you have admin permissions.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Connected Tools Permission:</strong> In Instagram App settings, allow &quot;Access to Messages&quot; under <em>Settings &gt; Messages and story replies &gt; Message controls</em>.
                </span>
              </li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="text-xs text-zinc-400 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            Replyza encrypts all Meta access tokens with AES-256-GCM before database storage.
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
