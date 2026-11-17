"use client";

import { ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import { CompanyMark } from "./job-card";
import type { Job } from "./utils";

export type ArchivedJob = Job & { archiveReason: string | null };

export function ArchivedView({
  jobs,
  onUnarchive,
}: {
  jobs: ArchivedJob[];
  onUnarchive: (job: ArchivedJob) => void;
}) {
  if (!jobs.length)
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
        Nothing archived.
      </p>
    );
  return (
    <ul className="divide-y px-4 sm:px-6">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-start gap-3 py-3">
          <CompanyMark company={job.company} className="size-8 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium tracking-[-0.01em]">
              {job.title}
            </p>
            <p className="truncate text-[13px] text-muted-foreground">
              {job.company}
              {job.archivedAt && (
                <>
                  {" · archived "}
                  <RelativeTime date={job.archivedAt} />
                </>
              )}
            </p>
            {job.archiveReason && (
              <p className="mt-1 text-[13px]">{job.archiveReason}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUnarchive(job)}
          >
            <ArchiveRestore /> Unarchive
          </Button>
        </li>
      ))}
    </ul>
  );
}
