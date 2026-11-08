"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Sparkles, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createJob, updateJob } from "@/server/jobs/actions";
import { aiImportJob } from "@/server/ai/job-actions";
import type { JobInput } from "@/lib/validators/job";
import { cn } from "@/lib/utils";
import { StatusSelect } from "./status-select";
import type { Job, Status } from "./utils";

type FormState = {
  company: string;
  title: string;
  statusId: string;
  location: string;
  workMode: "" | "remote" | "hybrid" | "onsite";
  url: string;
  priority: "low" | "medium" | "high";
  salaryMin: string;
  salaryMax: string;
  currency: string;
  skills: string[];
  appliedAt: string;
  interviewAt: string;
  description: string;
  notes: string;
};

function toForm(job: Job | undefined, statusId: string): FormState {
  return {
    company: job?.company ?? "",
    title: job?.title ?? "",
    statusId: job?.statusId ?? statusId,
    location: job?.location ?? "",
    workMode: job?.workMode ?? "",
    url: job?.url ?? "",
    priority: job?.priority ?? "medium",
    salaryMin: job?.salaryMin?.toString() ?? "",
    salaryMax: job?.salaryMax?.toString() ?? "",
    currency: job?.currency ?? "",
    skills: job?.skills ?? [],
    appliedAt: job?.appliedAt
      ? format(new Date(job.appliedAt), "yyyy-MM-dd")
      : "",
    interviewAt: job?.interviewAt
      ? format(new Date(job.interviewAt), "yyyy-MM-dd'T'HH:mm")
      : "",
    description: job?.description ?? "",
    notes: job?.notes ?? "",
  };
}

function toInput(f: FormState): JobInput {
  const num = (v: string) => (v.trim() ? Number(v) : undefined);
  return {
    company: f.company,
    title: f.title,
    statusId: f.statusId,
    location: f.location,
    workMode: f.workMode || undefined,
    url: f.url,
    priority: f.priority,
    salaryMin: num(f.salaryMin),
    salaryMax: num(f.salaryMax),
    currency: f.currency,
    skills: f.skills,
    appliedAt: f.appliedAt ? new Date(f.appliedAt) : undefined,
    interviewAt: f.interviewAt ? new Date(f.interviewAt) : undefined,
    description: f.description,
    notes: f.notes,
  };
}

const WORK_MODES = [
  { value: "none", label: "Not set" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];
const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function JobFormDialog({
  open,
  onOpenChange,
  statuses,
  job,
  defaultStatusId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: Status[];
  job?: Job;
  defaultStatusId?: string;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{job ? "Edit job" : "Add a job"}</DialogTitle>
          <DialogDescription>
            {job
              ? "Update the details for this application."
              : "Only company and role are required. Add more any time."}
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts on close, and the key resets state when switching jobs. */}
        <JobForm
          key={job?.id ?? `new:${defaultStatusId ?? ""}`}
          statuses={statuses}
          job={job}
          defaultStatusId={defaultStatusId}
          onCancel={() => onOpenChange(false)}
          onSaved={(id) => {
            onOpenChange(false);
            onSaved?.(id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function JobForm({
  statuses,
  job,
  defaultStatusId,
  onCancel,
  onSaved,
}: {
  statuses: Status[];
  job?: Job;
  defaultStatusId?: string;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    toForm(job, defaultStatusId ?? statuses[0]?.id ?? ""),
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [skillDraft, setSkillDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function addSkill(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setForm((f) => ({
      ...f,
      skills: Array.from(new Set([...f.skills, ...parts])).slice(0, 40),
    }));
    setSkillDraft("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = toInput({
      ...form,
      skills: skillDraft.trim()
        ? [...form.skills, skillDraft.trim()]
        : form.skills,
    });
    startTransition(async () => {
      const res = job ? await updateJob(job.id, input) : await createJob(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(
        job ? "Job updated" : `Added ${form.title} at ${form.company}`,
      );
      onSaved(job ? job.id : (res.data as { id: string }).id);
    });
  }

  const err = (k: keyof FormState) => errors[k]?.[0];

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {!job && (
        <AiImport
          onFill={(r, description) =>
            setForm((f) => ({
              ...f,
              company: r.company || f.company,
              title: r.title || f.title,
              location: r.location || f.location,
              workMode: r.workMode === "unknown" ? f.workMode : r.workMode,
              salaryMin: r.salaryMin?.toString() ?? f.salaryMin,
              salaryMax: r.salaryMax?.toString() ?? f.salaryMax,
              currency: r.currency || f.currency,
              skills: Array.from(new Set([...f.skills, ...r.skills])).slice(
                0,
                40,
              ),
              description,
            }))
          }
        />
      )}
      <Field label="Company" error={err("company")}>
        <Input
          autoFocus
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
          aria-invalid={!!err("company")}
        />
      </Field>
      <Field label="Role" error={err("title")}>
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          aria-invalid={!!err("title")}
        />
      </Field>
      <Field label="Status">
        <StatusSelect
          className="w-full"
          statuses={statuses}
          value={form.statusId}
          onChange={(v) => set("statusId", v)}
        />
      </Field>
      <Field label="Priority">
        <Select
          items={PRIORITIES}
          value={form.priority}
          onValueChange={(v) =>
            v && set("priority", v as FormState["priority"])
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Location">
        <Input
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="e.g. Pune, India"
        />
      </Field>
      <Field label="Work mode">
        <Select
          items={WORK_MODES}
          value={form.workMode || "none"}
          onValueChange={(v) =>
            set(
              "workMode",
              !v || v === "none" ? "" : (v as FormState["workMode"]),
            )
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORK_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Job posting URL"
        error={err("url")}
        className="sm:col-span-2"
      >
        <Input
          type="url"
          value={form.url}
          onChange={(e) => set("url", e.target.value)}
          placeholder="https://"
          aria-invalid={!!err("url")}
        />
      </Field>
      <div className="grid grid-cols-[1fr_1fr_5rem] gap-2 sm:col-span-2">
        <Field label="Salary from" error={err("salaryMin")}>
          <Input
            inputMode="numeric"
            value={form.salaryMin}
            onChange={(e) =>
              set("salaryMin", e.target.value.replace(/[^\d]/g, ""))
            }
          />
        </Field>
        <Field label="Salary to" error={err("salaryMax")}>
          <Input
            inputMode="numeric"
            value={form.salaryMax}
            onChange={(e) =>
              set("salaryMax", e.target.value.replace(/[^\d]/g, ""))
            }
          />
        </Field>
        <Field label="Currency">
          <Input
            value={form.currency}
            maxLength={8}
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
            placeholder="INR"
          />
        </Field>
      </div>
      <Field label="Applied on">
        <Input
          type="date"
          value={form.appliedAt}
          onChange={(e) => set("appliedAt", e.target.value)}
        />
      </Field>
      <Field label="Interview at">
        <Input
          type="datetime-local"
          value={form.interviewAt}
          onChange={(e) => set("interviewAt", e.target.value)}
        />
      </Field>
      <Field
        label="Skills"
        className="sm:col-span-2"
        hint="Press Enter or comma to add. Used to match interview prep later."
      >
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          {form.skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs"
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() =>
                  set(
                    "skills",
                    form.skills.filter((x) => x !== s),
                  )
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            aria-label="Add skill"
            value={skillDraft}
            onChange={(e) =>
              e.target.value.endsWith(",")
                ? addSkill(e.target.value)
                : setSkillDraft(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill(skillDraft);
              } else if (
                e.key === "Backspace" &&
                !skillDraft &&
                form.skills.length
              ) {
                set("skills", form.skills.slice(0, -1));
              }
            }}
            placeholder={form.skills.length ? "" : "React, TypeScript, Next.js"}
            className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </Field>
      <Field label="Job description" className="sm:col-span-2">
        <Textarea
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Paste the job description"
        />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {job ? "Save changes" : "Add job"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Wrapping label ties the text to the first control inside. */}
      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {children}
      </label>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Paste a posting, let Gemini fill the fields; the user checks them before saving. */
function AiImport({
  onFill,
}: {
  onFill: (
    r: import("@/lib/ai-schemas").JobImport,
    description: string,
  ) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground sm:col-span-2"
      >
        <Sparkles className="size-4 text-brand" />
        Paste a job description and fill these fields with AI
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border p-3 sm:col-span-2">
      <Textarea
        autoFocus
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the full job posting here"
        aria-label="Job description to import"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          You can review and edit everything before saving.
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || text.trim().length < 40}
            onClick={() =>
              start(async () => {
                const res = await aiImportJob(text);
                if (!res.ok) {
                  toast.error(
                    res.error,
                    res.code === "KEY_REQUIRED"
                      ? {
                          action: {
                            label: "Settings",
                            onClick: () => router.push("/app/settings"),
                          },
                        }
                      : undefined,
                  );
                  return;
                }
                onFill(res.data, text.trim());
                setOpen(false);
                toast.success(
                  "Fields filled from the posting. Check them, then save.",
                );
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Reading posting" : "Fill with AI"}
          </Button>
        </div>
      </div>
    </div>
  );
}
