"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/** Step 1: ask for a reset link. Always answers the same way, so it can't reveal which emails exist. */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const email = String(
      new FormData(e.currentTarget).get("email") ?? "",
    ).trim();
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    // Rate limits and network errors are worth showing; "no such user" never is.
    if (res.error && res.error.status !== 404 && res.error.status !== 400) {
      setError(
        res.error.message ?? "Couldn't send the link. Try again in a minute.",
      );
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="space-y-3 text-sm" role="status">
        <p className="font-medium">Check your inbox</p>
        <p className="text-muted-foreground">
          If an account exists for{" "}
          <span className="text-foreground">{sentTo}</span>, we&rsquo;ve sent a
          link to reset its password. The link works for one hour.
        </p>
        <Link
          href="/login"
          className="inline-block text-foreground underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="animate-in space-y-4 duration-300 fade-in-0 slide-in-from-bottom-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Send reset link
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Step 2: the link from the email lands here with ?token=… (or ?error=INVALID_TOKEN). */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const linkError = params.get("error");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || linkError) {
    return (
      <div className="space-y-3 text-sm" role="alert">
        <p className="font-medium">This link has expired or was already used</p>
        <p className="text-muted-foreground">
          Reset links work once, for one hour. Ask for a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-foreground underline underline-offset-4"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setPending(true);
    const res = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });
    if (res.error) {
      setPending(false);
      setError(
        res.error.code === "INVALID_TOKEN"
          ? "This link has expired or was already used. Ask for a new one."
          : (res.error.message ?? "Couldn't reset the password. Try again."),
      );
      return;
    }
    router.replace("/login?reset=1");
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="animate-in space-y-4 duration-300 fade-in-0 slide-in-from-bottom-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Save new password
      </Button>
    </form>
  );
}
