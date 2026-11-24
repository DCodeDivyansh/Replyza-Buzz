"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { Eye, EyeOff, Lock, Mail, CheckCircle2 } from "lucide-react";
import { ApiClientError } from "@/lib/api-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ field?: string; message: string }>
  >([]);

  const isExpired = searchParams.get("expired") === "1";
  const isRegistered = searchParams.get("registered") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setValidationErrors([]);

    // Client-side quick check
    if (!email.trim()) {
      setErrorMessage("Email is required");
      return;
    }
    if (!password) {
      setErrorMessage("Password is required");
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
        if (err.validationErrors) {
          setValidationErrors(err.validationErrors);
        }
      } else {
        setErrorMessage("An unexpected error occurred during login.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold tracking-tight text-[#17131D]">
          Sign in to your account
        </h2>
        <p className="mt-1 text-xs text-[#827D87]">
          Enter your credentials to access your automations
        </p>
      </div>

      {isExpired && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-800">
          Your session expired. Please sign in again.
        </div>
      )}

      {isRegistered && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Account created successfully! Please sign in below.</span>
        </div>
      )}

      <ErrorAlert
        message={errorMessage || ""}
        errors={validationErrors}
        onDismiss={() => {
          setErrorMessage(null);
          setValidationErrors([]);
        }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          required
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="h-4 w-4" />}
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="h-4 w-4" />}
          rightAction={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="text-[11px] text-zinc-400">
            Secure HTTP-only session cookie
          </span>
        </div>

        <Button
          type="submit"
          variant="gradient"
          className="w-full"
          size="md"
          isLoading={isLoading}
        >
          Sign In
        </Button>
      </form>

      <div className="text-center pt-2">
        <p className="text-xs text-[#827D87]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#E1306C] hover:text-[#833AB4] underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-6 text-xs text-zinc-400">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
