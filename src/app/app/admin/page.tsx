import { Suspense } from "react";
import type { Metadata } from "next";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionImportForm } from "@/features/admin/question-import-form";
import { db } from "@/server/db";
import { aiUsage, questionSources, questions, user } from "@/server/db/schema";
import { requireAdmin } from "@/server/session";
import { daysAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Admin</h1>
        <Suspense fallback={<Skeleton className="mt-6 h-96 rounded-2xl" />}>
          <AdminLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function AdminLoader() {
  await requireAdmin();
  const weekAgo = daysAgo(7);
  const [[users], [newUsers], usage, sources, [review]] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(user).where(gte(user.createdAt, weekAgo)),
    db
      .select({
        feature: aiUsage.feature,
        calls: count(),
        failed: sql<number>`count(*) filter (where not ${aiUsage.ok})::int`,
        tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int + coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
        admin: sql<number>`count(*) filter (where ${aiUsage.keySource} = 'admin')::int`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, weekAgo))
      .groupBy(aiUsage.feature)
      .orderBy(desc(count())),
    db.select().from(questionSources).orderBy(desc(questionSources.importedAt)),
    db
      .select({ n: count() })
      .from(questions)
      .where(eq(questions.needsReview, true)),
  ]);

  return (
    <div className="mt-6 space-y-10">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={users.n} />
        <Stat label="New this week" value={newUsers.n} />
        <Stat
          label="AI calls this week"
          value={usage.reduce((s, u) => s + u.calls, 0)}
        />
        <Stat label="Questions to review" value={review.n} />
      </dl>

      <section>
        <h2 className="mb-3 text-base font-medium">AI usage, last 7 days</h2>
        {usage.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No AI calls yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[13px] text-muted-foreground">
                  <th className="h-10 px-4 font-normal">Feature</th>
                  <th className="px-4 font-normal">Calls</th>
                  <th className="px-4 font-normal">Failed</th>
                  <th className="px-4 font-normal">On app key</th>
                  <th className="px-4 font-normal">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.feature} className="border-b last:border-0">
                    <td className="h-11 px-4">
                      {u.feature.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 font-mono">{u.calls}</td>
                    <td className="px-4 font-mono">{u.failed}</td>
                    <td className="px-4 font-mono">{u.admin}</td>
                    <td className="px-4 font-mono">
                      {u.tokens.toLocaleString("en")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-base font-medium">Question bank</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Curated questions and answers, exactly as each source has them. Prep
          plans only ever pick from here.
        </p>
        {sources.length > 0 && (
          <ul className="mb-4 divide-y rounded-2xl border bg-card">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4 text-sm"
              >
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-muted-foreground">
                  {s.questionCount} questions
                </span>
                {s.license && (
                  <span className="text-xs text-muted-foreground">
                    {s.license}
                  </span>
                )}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs underline underline-offset-4"
                  >
                    {s.url.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <QuestionImportForm />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-mono text-3xl font-medium tracking-[-0.03em]">
        {value}
      </dd>
    </div>
  );
}
