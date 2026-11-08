import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsWorkspace } from "@/features/jobs/jobs-workspace";
import { getBoard } from "@/server/jobs/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <JobsLoader />
    </Suspense>
  );
}

async function JobsLoader() {
  const user = await requireUser();
  const { statuses, jobs } = await getBoard(user.id);
  return <JobsWorkspace statuses={statuses} jobs={jobs} />;
}

function BoardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 sm:px-6">
        <div className="mr-auto space-y-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="flex gap-3 overflow-hidden px-4 sm:px-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="w-72 shrink-0 space-y-2 rounded-2xl bg-muted/40 p-3"
          >
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 - (i % 2) }, (_, j) => (
              <Skeleton key={j} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
