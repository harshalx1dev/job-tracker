"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobMatch } from "@/lib/ai-schemas";
import type { Profile } from "@/lib/profile";
import {
  RESUME_ACCENTS,
  RESUME_SECTIONS,
  TEMPLATES,
  type ResumeDesign,
} from "@/lib/resume";
import type { Resume } from "@/server/db/schema";
import { syncResumeFromProfile, updateResume } from "@/server/resumes/actions";
import { ProfileFields } from "@/features/profile/profile-fields";
import { ScaledPage } from "./scaled-page";

type SaveState = "saved" | "saving" | "error";

export function ResumeBuilder({
  resume,
  job,
}: {
  resume: Resume;
  job: { company: string; title: string; match: JobMatch | null } | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(resume.title);
  const [content, setContent] = useState<Profile>(resume.content);
  const [design, setDesign] = useState<ResumeDesign>(resume.design);
  const [tab, setTab] = useState<"content" | "design">("content");
  const [save, setSave] = useState<SaveState>("saved");
  const [epoch, setEpoch] = useState(0);
  const [syncing, startSync] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const first = useRef(true);
  // Server sent fresh content ("From profile"): take it and re-key the form.
  const [seenContent, setSeenContent] = useState(resume.content);
  if (resume.content !== seenContent) {
    setSeenContent(resume.content);
    setContent(resume.content);
    setEpoch((e) => e + 1);
  }

  // Autosave: 700ms after the last change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setSave("saving");
      const res = await updateResume(resume.id, {
        title: title.trim() || "Untitled resume",
        content,
        design,
      });
      setSave(res.ok ? "saved" : "error");
      if (!res.ok) toast.error(res.error);
    }, 700);
    return () => clearTimeout(t);
  }, [title, content, design, resume.id]);

  const setD = (patch: Partial<ResumeDesign>) =>
    setDesign((d) => ({ ...d, ...patch }));
  const moveSection = (i: number, dir: -1 | 1) =>
    setDesign((d) => {
      const order = [...d.order];
      [order[i], order[i + dir]] = [order[i + dir], order[i]];
      return { ...d, order };
    });
  const toggleHidden = (key: ResumeDesign["order"][number]) =>
    setDesign((d) => ({
      ...d,
      hidden: d.hidden.includes(key)
        ? d.hidden.filter((k) => k !== key)
        : [...d.hidden, key],
    }));

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/resumes/${resume.id}/pdf`);
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => null))?.error ?? "PDF failed",
        );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `${(content.basics.name || "resume").replace(/[^\w\- ]+/g, "").trim()} - ${title}.pdf`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
        <Link
          href="/app/resumes"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          aria-label="Back to resumes"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Resume title"
          maxLength={120}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-base font-medium outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {save === "saving" && <Loader2 className="size-3 animate-spin" />}
          {save === "saved" && <Check className="size-3" />}
          {save === "saving"
            ? "Saving"
            : save === "saved"
              ? "Saved"
              : "Not saved"}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={() => {
            if (
              !confirm(
                "Replace this resume's content with your current profile? The design stays.",
              )
            )
              return;
            startSync(async () => {
              const res = await syncResumeFromProfile(resume.id);
              if (!res.ok) return void toast.error(res.error);
              router.refresh();
              toast.success("Updated from your profile");
            });
          }}
        >
          {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          From profile
        </Button>
        <Button
          size="sm"
          onClick={download}
          disabled={downloading || save === "saving"}
        >
          {downloading ? <Loader2 className="animate-spin" /> : <Download />}
          Download PDF
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
        <div className="scrollbar-thin min-h-0 overflow-y-auto border-r">
          <div
            role="tablist"
            className="sticky top-0 z-10 flex gap-1 border-b bg-background px-4 py-2"
          >
            {(["content", "design"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "h-8 rounded-md px-3 text-sm capitalize transition-colors",
                  tab === t
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-8 p-4 sm:p-5">
            {tab === "content" ? (
              <>
                {job && (
                  <div className="rounded-xl border p-4 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      <Sparkles className="size-4 text-brand" />
                      Tailoring for {job.company}
                    </p>
                    {job.match?.suggestions.length ? (
                      <ul className="mt-2 space-y-1.5 text-muted-foreground">
                        {job.match.suggestions.map((s) => (
                          <li key={s} className="flex gap-2">
                            <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/50" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-muted-foreground">
                        Run &ldquo;Check my fit&rdquo; on the job to get
                        specific edits for this role.
                      </p>
                    )}
                  </div>
                )}
                <div key={epoch} className="space-y-8">
                  <ProfileFields
                    profile={content}
                    onChange={setContent}
                    showExtra={false}
                  />
                </div>
              </>
            ) : (
              <DesignPanel
                design={design}
                setD={setD}
                moveSection={moveSection}
                toggleHidden={toggleHidden}
              />
            )}
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 overflow-y-auto bg-surface p-4 max-lg:hidden sm:p-8">
          <ScaledPage
            content={content}
            design={design}
            className="mx-auto max-w-[820px]"
          />
        </div>
      </div>
    </div>
  );
}

function DesignPanel({
  design,
  setD,
  moveSection,
  toggleHidden,
}: {
  design: ResumeDesign;
  setD: (patch: Partial<ResumeDesign>) => void;
  moveSection: (i: number, dir: -1 | 1) => void;
  toggleHidden: (key: ResumeDesign["order"][number]) => void;
}) {
  return (
    <>
      <Group title="Template">
        <div className="grid gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={design.template === t.id}
              onClick={() => setD({ template: t.id })}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-surface",
                design.template === t.id && "border-foreground/40 bg-surface",
              )}
            >
              <span>
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {t.note}
                </span>
              </span>
              {design.template === t.id && <Check className="size-4" />}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Accent">
        <div className="flex flex-wrap gap-2">
          {RESUME_ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Accent ${c}`}
              aria-pressed={design.accent === c}
              onClick={() => setD({ accent: c })}
              className={cn(
                "grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                design.accent === c && "ring-2 ring-foreground",
              )}
              style={{ background: c }}
            >
              {design.accent === c && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Type and spacing">
        <div className="grid grid-cols-2 gap-2">
          <Segmented
            value={design.font}
            options={[
              { value: "serif", label: "Serif" },
              { value: "sans", label: "Sans" },
            ]}
            onChange={(font) => setD({ font })}
          />
          <Segmented
            value={design.density}
            options={[
              { value: "comfortable", label: "Roomy" },
              { value: "compact", label: "Tight" },
            ]}
            onChange={(density) => setD({ density })}
          />
        </div>
      </Group>

      <Group title="Sections">
        <ul className="divide-y rounded-xl border">
          {design.order.map((key, i) => {
            const label =
              RESUME_SECTIONS.find((s) => s.key === key)?.label ?? key;
            const hidden = design.hidden.includes(key);
            return (
              <li key={key} className="flex items-center gap-1 px-3 py-1.5">
                <span
                  className={cn(
                    "flex-1 text-sm",
                    hidden && "text-muted-foreground line-through",
                  )}
                >
                  {label}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${label} up`}
                  disabled={i === 0}
                  onClick={() => moveSection(i, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${label} down`}
                  disabled={i === design.order.length - 1}
                  onClick={() => moveSection(i, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
                  onClick={() => toggleHidden(key)}
                >
                  {hidden ? <EyeOff /> : <Eye />}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          In the Column template, skills, education and certifications sit in
          the side column.
        </p>
      </Group>
    </>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 flex-1 rounded-md text-xs transition-colors",
            value === o.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
