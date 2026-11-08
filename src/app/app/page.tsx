import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Clock3 } from "lucide-react";
import { LocalDateTime, RelativeTime } from "@/components/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import { StageBars, WeeklyColumns } from "@/features/dashboard/charts";
import { CompanyMark } from "@/features/jobs/job-card";
import { FOLLOW_UP_AFTER_DAYS, type Dashboard } from "@/lib/dashboard";
import { getDashboard } from "@/server/dashboard/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardLoader() {
  const user = await requireUser();
  const data = await getDashboard(user.id);
  return <DashboardView name={user.name.split(" ")[0]} data={data} />;
}

function DashboardView({ name, data }: { name: string; data: Dashboard }) {
  const empty = data.totals.all === 0;
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empty
              ? `Welcome, ${name}. Add a job to see your pipeline here.`
              : `Your search at a glance, ${name}.`}
          </p>
        </div>
        <Link
          href="/app/jobs"
          className="group inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:border-foreground/20 hover:bg-surface"
        >
          Open board
          <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active applications" value={data.totals.active} />
        <Stat label="Sent this week" value={data.appliedThisWeek} />
        <Stat
          label="Response rate"
          value={data.responseRate === null ? "—" : `${data.responseRate}%`}
          hint={
            data.totals.sent
              ? `${data.totals.responded} of ${data.totals.sent} sent`
              : "No applications sent yet"
          }
        />
        <Stat label="Offers" value={data.totals.offers} />
      </dl>

      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <Panel
          title="Applications per week"
          sub="Last 8 weeks"
          className="lg:col-span-7"
        >
          <WeeklyColumns weeks={data.weekly} />
        </Panel>
        <Panel
          title="Jobs in each stage"
          sub={`${data.totals.all} total`}
          className="lg:col-span-5"
        >
          <StageBars stages={data.stages} />
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Upcoming interviews" icon={CalendarClock}>
          {data.upcoming.length === 0 ? (
            <Empty>
              No interviews scheduled. Add a date on a job to see it here.
            </Empty>
          ) : (
            <ul className="-my-1">
              {data.upcoming.map((j) => (
                <JobRow
                  key={j.id}
                  id={j.id}
                  company={j.company}
                  title={j.title}
                >
                  <LocalDateTime date={j.interviewAt!} />
                </JobRow>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Follow-ups due"
          icon={Clock3}
          sub={`${FOLLOW_UP_AFTER_DAYS}+ days quiet`}
        >
          {data.followUps.length === 0 ? (
            <Empty>
              Nothing waiting. Applications with no update for a week show up
              here.
            </Empty>
          ) : (
            <ul className="-my-1">
              {data.followUps.map((j) => (
                <JobRow
                  key={j.id}
                  id={j.id}
                  company={j.company}
                  title={j.title}
                >
                  <>
                    Last update <RelativeTime date={j.updatedAt} />
                  </>
                </JobRow>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent activity">
          {data.activity.length === 0 ? (
            <Empty>Moves and edits on your jobs appear here.</Empty>
          ) : (
            <ol className="space-y-3">
              {data.activity.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="truncate">
                    {e.type === "created" && "Added "}
                    {e.type === "status_changed" && "Moved "}
                    {e.type === "updated" && "Edited "}
                    {e.type === "archived" && "Archived "}
                    {e.type === "restored" && "Restored "}
                    <span className="font-medium">
                      {e.job?.company ?? "a deleted job"}
                    </span>
                    {e.type === "status_changed" && e.to && <> to {e.to}</>}
                  </p>
                  <RelativeTime
                    date={e.createdAt}
                    className="text-xs text-muted-foreground"
                  />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-mono text-3xl font-medium tracking-[-0.03em] tabular">
        {value}
      </dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function Panel({
  title,
  sub,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  sub?: string;
  icon?: typeof Clock3;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-card p-4 sm:p-5 ${className ?? ""}`}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {Icon && <Icon className="size-3.5 text-muted-foreground" />}
          {title}
        </h2>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </header>
      {children}
    </section>
  );
}

function JobRow({
  id,
  company,
  title,
  children,
}: {
  id: string;
  company: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={`/app/jobs?job=${id}`}
        className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface"
      >
        <CompanyMark company={company} className="mt-0.5 size-7" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {company} · {children}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="mb-6 h-12 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-2xl lg:col-span-7" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-5" />
      </div>
    </div>
  );
}
