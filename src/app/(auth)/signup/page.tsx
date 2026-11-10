import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <h1 className="text-xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Free to use. Bring your own Gemini key for AI features.
      </p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </>
  );
}
