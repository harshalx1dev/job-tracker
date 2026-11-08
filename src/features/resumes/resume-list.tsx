"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RelativeTime } from "@/components/relative-time";
import {
  createResume,
  deleteResume,
  duplicateResume,
} from "@/server/resumes/actions";
import type { ResumeListItem } from "@/server/resumes/queries";
import { ScaledPage } from "./scaled-page";

export function ResumeList({
  resumes,
  jobs,
  profileReady,
}: {
  resumes: ResumeListItem[];
  jobs: { id: string; company: string; title: string }[];
  profileReady: boolean;
}) {
  const router = useRouter();
  const [creating, startCreate] = useTransition();
  const [tailorOpen, setTailorOpen] = useState(false);

  const create = (jobId?: string) =>
    startCreate(async () => {
      const res = await createResume({ jobId });
      if (!res.ok) return void toast.error(res.error);
      router.push(`/app/resumes/${res.data.id}`);
    });

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={() => create()} disabled={creating}>
          {creating ? <Loader2 className="animate-spin" /> : <Plus />}
          New resume
        </Button>
        <Button
          variant="outline"
          onClick={() => setTailorOpen(true)}
          disabled={creating || jobs.length === 0}
        >
          <Target /> Tailor for a job
        </Button>
      </div>

      {!profileReady && (
        <p className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          New resumes start from your profile, which is empty.{" "}
          <Link
            href="/app/profile"
            className="text-foreground underline underline-offset-4"
          >
            Fill your profile
          </Link>{" "}
          first (uploading your current resume is the quickest way).
        </p>
      )}

      {resumes.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <FileText className="size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No resumes yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Make one from your profile, then a tailored copy for each job that
            matters.
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((r) => (
            <li key={r.id} className="group relative">
              <Link
                href={`/app/resumes/${r.id}`}
                className="block overflow-hidden rounded-2xl border bg-card transition-[translate,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/20"
              >
                <div className="h-56 overflow-hidden bg-surface px-6 pt-6">
                  <ScaledPage content={r.content} design={r.design} />
                </div>
                <div className="border-t p-4">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.jobCompany ? `For ${r.jobCompany} · ` : ""}Edited{" "}
                    <RelativeTime date={r.updatedAt} />
                  </p>
                </div>
              </Link>
              <RowMenu id={r.id} />
            </li>
          ))}
        </ul>
      )}

      {tailorOpen && (
        <TailorDialog
          jobs={jobs}
          onClose={() => setTailorOpen(false)}
          onCreate={(id) => create(id)}
        />
      )}
    </>
  );
}

function RowMenu({ id }: { id: string }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg border bg-card opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
        aria-label="Resume actions"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={async () => {
            const res = await duplicateResume(id);
            if (!res.ok) return void toast.error(res.error);
            router.push(`/app/resumes/${res.data.id}`);
          }}
        >
          <Copy /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            if (!confirm("Delete this resume? This can't be undone.")) return;
            const res = await deleteResume(id);
            if (!res.ok) toast.error(res.error);
          }}
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TailorDialog({
  jobs,
  onClose,
  onCreate,
}: {
  jobs: { id: string; company: string; title: string }[];
  onClose: () => void;
  onCreate: (jobId: string) => void;
}) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const items = jobs.map((j) => ({
    value: j.id,
    label: `${j.company} · ${j.title}`,
  }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tailor a resume for a job</DialogTitle>
          <DialogDescription>
            Starts from your profile. If you&rsquo;ve run &ldquo;Check my
            fit&rdquo; on the job, its suggestions show beside the editor.
          </DialogDescription>
        </DialogHeader>
        <Select
          items={items}
          value={jobId}
          onValueChange={(v) => v && setJobId(String(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!jobId}
            onClick={() => {
              onClose();
              onCreate(jobId);
            }}
          >
            Create tailored resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
