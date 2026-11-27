"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  User,
  Shield,
  Key,
  LogOut,
  Server,
  CheckCircle2,
  AlertCircle,
  Info,
  Trash2,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  // Cuelinks Integration State
  const [cuelinksConnected, setCuelinksConnected] = useState(false);
  const [cuelinksPublisherId, setCuelinksPublisherId] = useState("");
  const [cuelinksApiKey, setCuelinksApiKey] = useState("");
  const [cuelinksHasApiKey, setCuelinksHasApiKey] = useState(false);
  const [isSavingCuelinks, setIsSavingCuelinks] = useState(false);
  const [isTestingCuelinks, setIsTestingCuelinks] = useState(false);
  const [isDisconnectingCuelinks, setIsDisconnectingCuelinks] = useState(false);
  const [cuelinksTestResult, setCuelinksTestResult] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await apiRequest<{ status: string }>("/health", {
          skipAuth: true,
        });
        setHealthStatus(res.data?.status || "ok");
      } catch {
        setHealthStatus("unavailable");
      }
    }

    async function loadCuelinks() {
      try {
        const res = await apiRequest<{
          connected: boolean;
          publisherId: string | null;
          hasApiKey: boolean;
        }>("/integrations/cuelinks");
        if (res.data) {
          setCuelinksConnected(res.data.connected);
          setCuelinksPublisherId(res.data.publisherId || "");
          setCuelinksHasApiKey(res.data.hasApiKey);
        }
      } catch {
        // Ignore if unauthenticated or unavailable
      }
    }

    checkHealth();
    loadCuelinks();
  }, []);

  const handleSaveCuelinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuelinksPublisherId.trim()) {
      toast.error("Cuelinks Publisher ID is required");
      return;
    }
    setIsSavingCuelinks(true);
    setCuelinksTestResult(null);
    try {
      const payload: { publisherId: string; apiKey?: string } = {
        publisherId: cuelinksPublisherId.trim(),
      };
      if (cuelinksApiKey.trim()) {
        payload.apiKey = cuelinksApiKey.trim();
      }
      const res = await apiRequest<{
        connected: boolean;
        publisherId: string | null;
        hasApiKey: boolean;
      }>("/integrations/cuelinks", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (res.data) {
        setCuelinksConnected(res.data.connected);
        setCuelinksHasApiKey(res.data.hasApiKey);
        setCuelinksApiKey("");
        toast.success("Cuelinks integration saved");
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save Cuelinks settings");
    } finally {
      setIsSavingCuelinks(false);
    }
  };

  const handleTestCuelinks = async () => {
    setIsTestingCuelinks(true);
    setCuelinksTestResult(null);
    try {
      const res = await apiRequest<{
        affiliateUrl: string;
        method: "api" | "deeplink";
      }>("/integrations/cuelinks/convert", {
        method: "POST",
        body: JSON.stringify({
          url: "https://www.amazon.in/dp/B09G9BL5CP",
          subid: "settings_test",
        }),
      });
      if (res.data?.affiliateUrl) {
        setCuelinksTestResult(`Converted (${res.data.method}): ${res.data.affiliateUrl}`);
        toast.success("Cuelinks link conversion succeeded");
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Test conversion failed");
    } finally {
      setIsTestingCuelinks(false);
    }
  };

  const handleDisconnectCuelinks = async () => {
    setIsDisconnectingCuelinks(true);
    try {
      await apiRequest("/integrations/cuelinks", { method: "DELETE" });
      setCuelinksConnected(false);
      setCuelinksPublisherId("");
      setCuelinksApiKey("");
      setCuelinksHasApiKey(false);
      setCuelinksTestResult(null);
      toast.success("Cuelinks integration disconnected");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to disconnect Cuelinks");
    } finally {
      setIsDisconnectingCuelinks(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await apiRequest("/auth/delete-account", {
        method: "POST",
      });
      router.push("/login?deleted=1");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">
          Account Settings
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          View your session information, security credentials, and system status
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4 text-indigo-600" />
            <CardTitle>Account Profile</CardTitle>
          </div>
          <CardDescription>
            Account details linked to your Replyza workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80">
              <span className="text-zinc-500 font-medium">Email Address</span>
              <p className="font-semibold text-zinc-900 mt-0.5">
                {user?.email || "—"}
              </p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80">
              <span className="text-zinc-500 font-medium">User Identifier (UUID)</span>
              <p className="font-mono text-zinc-700 mt-0.5 truncate">
                {user?.id || "—"}
              </p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80">
              <span className="text-zinc-500 font-medium">Member Since</span>
              <p className="font-semibold text-zinc-900 mt-0.5">
                {user?.createdAt ? formatDate(user.createdAt) : "—"}
              </p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80">
              <span className="text-zinc-500 font-medium">System API Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {healthStatus === "ok" ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-semibold text-emerald-700">Healthy</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-semibold text-zinc-600 capitalize">
                      {healthStatus || "Checking..."}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-zinc-400 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            Profile editing and password change endpoints are not yet supported by the current backend.
          </span>
        </CardFooter>
      </Card>

      {/* Integrations: Cuelinks */}
      <Card id="integrations">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Link2 className="h-4 w-4 text-indigo-600" />
              <CardTitle>Integrations — Cuelinks</CardTitle>
            </div>
            {cuelinksConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            )}
          </div>
          <CardDescription>
            Connect your own Cuelinks account to convert Amazon, Flipkart, Myntra, and Ajio links into tracked affiliate URLs in one click.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveCuelinks}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Cuelinks Publisher ID (Channel ID) *"
                value={cuelinksPublisherId}
                onChange={(e) => setCuelinksPublisherId(e.target.value)}
                placeholder="e.g. 123456"
              />
              <Input
                label="Cuelinks API Key (Optional)"
                type="password"
                value={cuelinksApiKey}
                onChange={(e) => setCuelinksApiKey(e.target.value)}
                placeholder={
                  cuelinksHasApiKey
                    ? "Saved (enter new key to replace)"
                    : "Optional — for short clnk.in links"
                }
              />
            </div>

            <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 text-xs text-zinc-600 flex items-start gap-2">
              <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Find your <strong>Publisher ID (Channel ID)</strong> in your Cuelinks dashboard under{" "}
                <strong>Channels → Manage Channels</strong>. An API key is optional; without it, Replyza uses instant{" "}
                <code>linksredirect.com</code> deep-link wrapping.
              </span>
            </div>

            {cuelinksTestResult && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 break-all font-mono">
                {cuelinksTestResult}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" isLoading={isSavingCuelinks}>
                Save Cuelinks Settings
              </Button>
              {cuelinksConnected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={isTestingCuelinks}
                  onClick={handleTestCuelinks}
                >
                  Test Conversion
                </Button>
              )}
            </div>
            {cuelinksConnected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isDisconnectingCuelinks}
                onClick={handleDisconnectCuelinks}
                className="text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                Disconnect
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      {/* Security & Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-indigo-600" />
            <CardTitle>Session & Security</CardTitle>
          </div>
          <CardDescription>
            Strict authentication security and token rotation mechanisms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-zinc-600">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Key className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900">
                  Dual-Token Architecture
                </p>
                <p className="text-zinc-500 leading-relaxed">
                  Access tokens are held strictly in browser memory (15-minute lifespan). Refresh tokens are stored in an <code>HttpOnly</code>, <code>SameSite=Lax</code> cookie (30-day lifespan) with automatic cryptographic rotation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <Server className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900">
                  CSRF Header Protection
                </p>
                <p className="text-zinc-500 leading-relaxed">
                  All sensitive session refresh and logout requests are verified via <code>x-csrf-protection</code> custom origin checks to prevent cross-site request forgery.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-zinc-900">Sign Out</p>
              <p className="text-zinc-500">
                Invalidates your refresh token family and clears the browser session.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              isLoading={isLoggingOut}
              onClick={handleLogout}
              className="text-red-600 hover:bg-red-50 hover:border-red-200 gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-2.5 text-red-600">
            <Trash2 className="h-4 w-4" />
            <CardTitle className="text-red-700">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Permanently delete your account and all associated workspace data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-zinc-600">
          <p className="leading-relaxed">
            Deleting your account will immediately and permanently revoke and delete your connected Instagram accounts,
            all configured automations, webhook event logs, and your user credentials. This action cannot be reversed.
          </p>

          {deleteError && (
            <p className="text-red-600 font-medium">{deleteError}</p>
          )}

          <div className="pt-3 flex items-center justify-between">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={isDeletingAccount}
                  onClick={handleDeleteAccount}
                >
                  Yes, Permanently Delete My Account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                Delete Account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legal & Compliance Footer Links */}
      <div className="flex items-center justify-center gap-6 pt-4 text-[11px] text-zinc-400">
        <Link href="/privacy" className="hover:text-zinc-600 transition-colors">Privacy Policy</Link>
        <span>•</span>
        <Link href="/terms" className="hover:text-zinc-600 transition-colors">Terms of Service</Link>
        <span>•</span>
        <Link href="/data-deletion" className="hover:text-zinc-600 transition-colors">User Data Deletion</Link>
      </div>
    </div>
  );
}
