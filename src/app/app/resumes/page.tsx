import { Suspense } from "react";
import type { Metadata } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Skeleton } from "@/components/ui/skeleton";
import { ResumeList } from "@/features/resumes/resume-list";
import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import { getProfile } from "@/server/profile/queries";
import { listResumes } from "@/server/resumes/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Resumes" };

export default function ResumesPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Resumes</h1>
        <p className="mt-1 mb-6 max-w-prose text-sm text-muted-foreground">
          HTML templates exported as real-text PDFs that applicant tracking
          systems can read.
        </p>
        <Suspense
          fallback={
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          }
        >
          <ResumesLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function ResumesLoader() {
  const user = await requireUser();
  const [list, { saved }, jobRows] = await Promise.all([
    listResumes(user.id),
    getProfile(user.id),
    db
      .select({ id: jobs.id, company: jobs.company, title: jobs.title })
      .from(jobs)
      .where(and(eq(jobs.userId, user.id), isNull(jobs.archivedAt)))
      .orderBy(desc(jobs.updatedAt)),
  ]);
  return <ResumeList resumes={list} jobs={jobRows} profileReady={saved} />;
}
