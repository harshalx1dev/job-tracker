"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const target = next && next.startsWith("/app") ? next : "/app/jobs";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const res =
      mode === "signup"
        ? await signUp.email({
            email,
            password,
            name: String(form.get("name") ?? ""),
          })
        : await signIn.email({ email, password });
    if (res.error) {
      setError(
        res.error.status === 403
          ? "Confirm your email first: open the link we sent you."
          : (res.error.message ?? "Something went wrong. Try again."),
      );
      setPending(false);
      return;
    }
    // Email verification is on: no session until the link is opened.
    if (
      mode === "signup" &&
      !(res.data as { token?: string | null } | null)?.token
    ) {
      setSentTo(email);
      setPending(false);
      return;
    }
    router.push(target);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="space-y-2 text-sm" role="status">
        <p className="font-medium">Check your inbox</p>
        <p className="text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="text-foreground">{sentTo}</span>. Open it to finish
          signing up.
        </p>
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="animate-in space-y-4 duration-300 fade-in-0 slide-in-from-bottom-2"
    >
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={80}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
        />
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        )}
      </div>

      {mode === "login" && params.get("reset") === "1" && !error && (
        <p
          role="status"
          className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
        >
          Password changed. Sign in with your new password.
        </p>
      )}
      {error && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </motion.p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account? " : "New here? "}
        <Link
          href={mode === "signup" ? "/login" : "/signup"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
