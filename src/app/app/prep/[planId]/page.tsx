import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PrepWorkspace } from "@/features/prep/prep-workspace";
import { loadPlan } from "@/server/prep/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Prep plan" };

export default function PrepPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <PlanLoader params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function PlanLoader({ params }: { params: Promise<{ planId: string }> }) {
  const [{ planId }, user] = await Promise.all([params, requireUser()]);
  const view = await loadPlan({ planId, ownerId: user.id }, user.id);
  if (!view) notFound();
  return <PrepWorkspace view={view} mode="owner" canTrack />;
}
