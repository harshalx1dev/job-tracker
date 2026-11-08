import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ResumeBuilder } from "@/features/resumes/resume-builder";
import { getResume } from "@/server/resumes/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Resume builder" };

export default function ResumeBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[30rem_1fr]">
          <Skeleton className="h-full min-h-96 rounded-2xl" />
          <Skeleton className="h-full min-h-96 rounded-2xl max-lg:hidden" />
        </div>
      }
    >
      <BuilderLoader params={params} />
    </Suspense>
  );
}

async function BuilderLoader({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const row = await getResume(user.id, id);
  if (!row) notFound();
  return (
    <ResumeBuilder
      key={row.resume.id}
      resume={row.resume}
      job={
        row.jobCompany
          ? {
              company: row.jobCompany,
              title: row.jobTitle ?? "",
              match: row.jobMatch ?? null,
            }
          : null
      }
    />
  );
}
