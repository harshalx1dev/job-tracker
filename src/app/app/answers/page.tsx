import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { AnswersStudio } from "@/features/ai/answers-studio";
import { jobOptions, listAnswers } from "@/server/ai/page-data";
import { getAiStatus } from "@/server/ai/status";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Answer bank" };

export default function AnswersPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Answer bank</h1>
        <p className="mt-1 mb-6 max-w-prose text-sm text-muted-foreground">
          Draft answers to application questions once, then find and adapt them
          for the next form.
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
    listAnswers(user.id),
    getAiStatus(user),
  ]);
  return (
    <AnswersStudio jobs={jobs} saved={saved} aiReady={ai.source !== null} />
  );
}
