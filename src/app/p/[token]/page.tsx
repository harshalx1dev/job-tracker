import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { PrepWorkspace } from "@/features/prep/prep-workspace";
import { loadPlan } from "@/server/prep/queries";
import { getCurrentUser } from "@/server/session";

// Shared links are unlisted: never indexed or followed.
export const metadata: Metadata = {
  title: "Shared prep plan",
  robots: { index: false, follow: false },
};

export default function SharedPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
          <Suspense>
            <SignInHint />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <SharedLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function SignInHint() {
  const user = await getCurrentUser();
  if (user)
    return (
      <span className="text-sm text-muted-foreground">
        Tracking as {user.name.split(" ")[0]}
      </span>
    );
  return (
    <Link href="/login" className="text-sm underline underline-offset-4">
      Sign in to track your progress
    </Link>
  );
}

async function SharedLoader({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, user] = await Promise.all([params, getCurrentUser()]);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const view = await loadPlan({ token }, user?.id ?? null);
  if (!view) notFound();
  return <PrepWorkspace view={view} mode="shared" canTrack={Boolean(user)} />;
}
