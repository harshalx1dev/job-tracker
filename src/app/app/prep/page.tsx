import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS, type PlanKind } from "@/lib/prep";
import { listPlans } from "@/server/prep/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Interview prep" };

export default function PrepPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">
          Interview prep
        </h1>
        <p className="mt-1 mb-6 max-w-prose text-sm text-muted-foreground">
          Questions from the curated bank, matched to each job&rsquo;s skills.
          Build plans from a job&rsquo;s drawer on the board.
        </p>
        <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
          <PlansLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function PlansLoader() {
  const user = await requireUser();
  const plans = await listPlans(user.id);
  if (plans.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
        <GraduationCap className="size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No prep plans yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Open a job on the board and choose &ldquo;Build prep plans&rdquo;
          under Interview prep.
        </p>
        <Link
          href="/app/jobs"
          className="mt-4 text-sm underline underline-offset-4"
        >
          Go to the board
        </Link>
      </div>
    );
  }
  const byJob = new Map<string, typeof plans>();
  for (const p of plans)
    byJob.set(p.plan.jobId, [...(byJob.get(p.plan.jobId) ?? []), p]);
  const order = { crash: 0, multiday: 1, full: 2 } as Record<string, number>;

  return (
    <div className="space-y-6">
      {[...byJob.values()].map((group) => (
        <section key={group[0].plan.jobId}>
          <h2 className="mb-2 text-sm font-medium">
            {group[0].company}{" "}
            <span className="font-normal text-muted-foreground">
              · {group[0].title}
            </span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {group
              .sort((a, b) => order[a.plan.kind] - order[b.plan.kind])
              .map((p) => {
                const kind = p.plan.kind as PlanKind;
                const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
                return (
                  <li key={p.plan.id}>
                    <Link
                      href={`/app/prep/${p.plan.id}`}
                      className="group block rounded-2xl border bg-card p-4 transition-[translate,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/20"
                    >
                      <p className="flex items-center justify-between text-sm font-medium">
                        {kind === "multiday"
                          ? `${p.plan.days}-day plan`
                          : PLAN_LABELS[kind]}
                        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.total} questions ·{" "}
                        {Math.max(1, Math.round(p.minutes / 60))} h
                      </p>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {pct}% done
                      </p>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
