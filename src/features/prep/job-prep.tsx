"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { suggestPlan } from "@/lib/prep";
import { generatePrepPlans } from "@/server/prep/actions";
import { getJobExtras } from "@/server/jobs/contact-actions";
import { JobPrepSection } from "./prep-workspace";

type PlanSummary = {
  id: string;
  kind: string;
  days: number;
  total: number;
  minutes: number;
  done: number;
};

export function JobPrep({
  jobId,
  interviewAt,
  initial,
}: {
  jobId: string;
  interviewAt: Date | null;
  initial: PlanSummary[] | null;
}) {
  const [plans, setPlans] = useState<PlanSummary[] | null>(initial);
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setPlans(initial);
  }
  const [pending, start] = useTransition();
  if (plans === null) return null;

  return (
    <JobPrepSection
      jobId={jobId}
      plans={plans}
      suggested={
        suggestPlan(interviewAt ? new Date(interviewAt) : null, new Date()).kind
      }
      generating={pending}
      onGenerate={() =>
        start(async () => {
          const res = await generatePrepPlans(jobId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`${res.data.matched} questions matched this job`);
          const extras = await getJobExtras(jobId);
          setPlans(extras.plans);
        })
      }
    />
  );
}
