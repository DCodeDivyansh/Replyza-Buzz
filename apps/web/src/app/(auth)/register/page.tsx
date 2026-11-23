"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/feedback/error-alert";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { ApiClientError } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ field?: string; message: string }>
  >([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setValidationErrors([]);

    // Client-side validation matching backend
    const clientErrors: Array<{ field?: string; message: string }> = [];

    if (!email.trim() || !email.includes("@")) {
      clientErrors.push({
        field: "email",
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 12) {
      clientErrors.push({
        field: "password",
        message: "Password must contain at least 12 characters",
      });
    } else if (password.length > 128) {
      clientErrors.push({
        field: "password",
        message: "Password must not exceed 128 characters",
      });
    }

    if (password !== confirmPassword) {
      clientErrors.push({
        field: "confirmPassword",
        message: "Passwords do not match",
      });
    }

    if (clientErrors.length > 0) {
      setErrorMessage("Please fix the validation errors below.");
      setValidationErrors(clientErrors);
      return;
    }

    setIsLoading(true);
    try {
      await register(email.trim(), password, confirmPassword);
      // Registration successful. Backend does not automatically log the user in.
      router.push("/login?registered=1");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
        if (err.validationErrors) {
          setValidationErrors(err.validationErrors);
        }
      } else {
        setErrorMessage("An unexpected error occurred during registration.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900">
          Create your account
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Get started with automated Instagram comment replies and DMs
        </p>
      </div>

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
          autoComplete="new-password"
          required
          placeholder="At least 12 characters"
          helperText="Minimum 12 characters, maximum 128 characters"
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

        <Input
          label="Confirm password"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock className="h-4 w-4" />}
          rightAction={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors p-1"
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        <Button
          type="submit"
          className="w-full shadow-xs mt-2"
          size="md"
          isLoading={isLoading}
        >
          Create Account
        </Button>
      </form>

      <div className="text-center pt-2">
        <p className="text-xs text-zinc-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
