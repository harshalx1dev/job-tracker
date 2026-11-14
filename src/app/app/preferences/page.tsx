import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PreferencesForm } from "@/features/profile/preferences-form";
import { getPreferences } from "@/server/profile/preferences";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Preferences" };

export default function PreferencesPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Preferences</h1>
        <p className="mt-1 mb-6 max-w-prose text-sm text-muted-foreground">
          What you want from a job search. Claude reads this before it looks for
          jobs, so it only adds roles that fit.
        </p>
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <Loader />
        </Suspense>
      </div>
    </div>
  );
}

async function Loader() {
  const user = await requireUser();
  return <PreferencesForm initial={await getPreferences(user.id)} />;
}
