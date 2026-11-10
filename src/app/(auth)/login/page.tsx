import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Sign in to pick up where you left off.
      </p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
