import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        You&rsquo;ll be signed out on your other devices.
      </p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
