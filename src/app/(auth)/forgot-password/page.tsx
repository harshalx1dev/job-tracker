import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">
        Forgot your password?
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Enter your account email and we&rsquo;ll send you a link to choose a new
        one.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
