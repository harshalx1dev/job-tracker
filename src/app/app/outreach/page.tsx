import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { OutreachStudio } from "@/features/ai/outreach-studio";
import { jobOptions, listOutreach } from "@/server/ai/page-data";
import { getAiStatus } from "@/server/ai/status";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Outreach" };

export default function OutreachPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Outreach</h1>
        <p className="mt-1 mb-6 max-w-prose text-sm text-muted-foreground">
          Emails and LinkedIn messages written from your profile, inside each
          channel&rsquo;s character limit.
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
  const [jobs, saved, ai] = await Promise.all([
    jobOptions(user.id),
    listOutreach(user.id),
    getAiStatus(user),
  ]);
  return (
    <OutreachStudio jobs={jobs} saved={saved} aiReady={ai.source !== null} />
  );
}
