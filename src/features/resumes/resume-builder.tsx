"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
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
  Minimize2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { JobMatch } from "@/lib/ai-schemas";
import type { Profile } from "@/lib/profile";
import {
  ACCENT_TARGETS,
  normalizeDesign,
  RESUME_ACCENTS,
  RESUME_FONTS,
  RESUME_SECTIONS,
  switchTemplate,
  TEMPLATES,
  type ResumeDesign,
} from "@/lib/resume";
import type { Resume } from "@/server/db/schema";
import { syncResumeFromProfile, updateResume } from "@/server/resumes/actions";
import { ProfileFields } from "@/features/profile/profile-fields";
import { ScaledPage, type FitFn } from "./scaled-page";

type SaveState = "idle" | "saving" | "error";

const AUTOSAVE_KEY = "trackr:resume-autosave";
const AUTOSAVE_EVENT = "trackr:resume-autosave-change";
let memory = true;

/** Autosave on/off, remembered in this browser. On unless switched off. */
function useAutosavePreference() {
  const on = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(AUTOSAVE_EVENT, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(AUTOSAVE_EVENT, notify);
      };
    },
    () => {
      try {
        return localStorage.getItem(AUTOSAVE_KEY) !== "off";
      } catch {
        return memory; // storage blocked
      }
    },
    () => true,
  );
  const set = (value: boolean) => {
    memory = value;
    try {
      localStorage.setItem(AUTOSAVE_KEY, value ? "on" : "off");
    } catch {
      // Blocked: the choice lasts until the page is reloaded.
    }
    window.dispatchEvent(new Event(AUTOSAVE_EVENT));
  };
  return [on, set] as const;
}

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
  const [design, setDesign] = useState<ResumeDesign>(() =>
    normalizeDesign(resume.design),
  );
  const [tab, setTab] = useState<"content" | "design">("content");
  const [save, setSave] = useState<SaveState>("idle");
  const [epoch, setEpoch] = useState(0);
  const [syncing, startSync] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [autosave, setAutosave] = useAutosavePreference();
  // What the database holds (as far as this page knows). The raw values, so
  // "unsaved changes" is a plain comparison with what is on screen.
  const [saved, setSaved] = useState(() => ({
    title: resume.title,
    content: resume.content,
    design: normalizeDesign(resume.design),
  }));
  const dirty = useMemo(
    () =>
      title !== saved.title ||
      JSON.stringify(content) !== JSON.stringify(saved.content) ||
      JSON.stringify(design) !== JSON.stringify(saved.design),
    [title, content, design, saved],
  );
  // Server sent fresh content ("From profile"): take it and re-key the form.
  const [seenContent, setSeenContent] = useState(resume.content);
  if (resume.content !== seenContent) {
    setSeenContent(resume.content);
    setContent(resume.content);
    setSaved((s) => ({ ...s, content: resume.content }));
    setEpoch((e) => e + 1);
  }

  const persist = useCallback(async () => {
    const snapshot = { title, content, design };
    setSave("saving");
    const res = await updateResume(resume.id, {
      title: title.trim() || "Untitled resume",
      content,
      design,
    });
    if (res.ok) {
      setSaved(snapshot);
      setSave("idle");
    } else {
      setSave("error");
      toast.error(res.error);
    }
  }, [title, content, design, resume.id]);

  // Autosave: 700ms after the last change. Turning it on saves pending changes.
  useEffect(() => {
    if (!autosave || !dirty) return;
    const t = setTimeout(persist, 700);
    return () => clearTimeout(t);
  }, [autosave, dirty, persist]);

  // With autosave off, closing or reloading the tab would lose the changes.
  useEffect(() => {
    if (autosave || !dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [autosave, dirty]);

  function discard() {
    if (!confirm("Discard your unsaved changes?")) return;
    setTitle(saved.title);
    setContent(saved.content);
    setDesign(saved.design);
    setSave("idle");
    setEpoch((e) => e + 1); // fields keep their own text; re-key them
  }

  const setD = (patch: Partial<ResumeDesign>) =>
    setDesign((d) => ({ ...d, ...patch }));

  // The preview measures the document; this asks it for a size that fits one page.
  const fitRef = useRef<FitFn | null>(null);
  const onFitReady = useCallback((fn: FitFn) => {
    fitRef.current = fn;
  }, []);
  function fitToOnePage() {
    const r = fitRef.current?.();
    if (!r) {
      toast.error(
        "Even the smallest text doesn't fit one page. Trim some content or lower the margin.",
      );
    } else if (
      r.fontSize === design.fontSize &&
      r.lineHeight === design.lineHeight
    ) {
      toast.success("Already fits on one page.");
    } else {
      setD(r);
      toast.success(
        `Text set to ${r.fontSize}pt, line height ${r.lineHeight}.`,
      );
    }
  }
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
          onClick={(e) => {
            if (dirty && !autosave && !confirm("Leave without saving?"))
              e.preventDefault();
          }}
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
          {save === "idle" && !(dirty && !autosave) && (
            <Check className="size-3" />
          )}
          {save === "saving"
            ? "Saving"
            : save === "error"
              ? "Not saved"
              : dirty && !autosave
                ? "Unsaved changes"
                : "Saved"}
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={autosave}
            onCheckedChange={(v) => setAutosave(v === true)}
          />
          Autosave
        </label>
        {!autosave && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || save === "saving"}
              onClick={discard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              disabled={!dirty || save === "saving"}
              onClick={persist}
            >
              {save === "saving" && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={() => {
            if (
              !confirm(
                `Replace this resume's content with your current profile? The design stays.${dirty && !autosave ? " Unsaved changes to the content will be lost." : ""}`,
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
          // The PDF is made from what is saved, so wait for unsaved changes.
          disabled={downloading || save === "saving" || dirty}
          title={dirty ? "Save your changes first" : undefined}
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
                onFit={fitToOnePage}
              />
            )}
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 overflow-y-auto bg-surface p-4 max-lg:hidden sm:p-8">
          <ScaledPage
            content={content}
            design={design}
            onFitReady={onFitReady}
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
  onFit,
}: {
  design: ResumeDesign;
  setD: (patch: Partial<ResumeDesign>) => void;
  moveSection: (i: number, dir: -1 | 1) => void;
  toggleHidden: (key: ResumeDesign["order"][number]) => void;
  onFit: () => void;
}) {
  const fontItems = RESUME_FONTS.map((f) => ({ value: f.id, label: f.label }));
  const toggleTarget = (id: ResumeDesign["accentOn"][number]) =>
    setD({
      accentOn: design.accentOn.includes(id)
        ? design.accentOn.filter((t) => t !== id)
        : [...design.accentOn, id],
    });
  const accent = design.accent.toLowerCase();
  const customAccent = !(RESUME_ACCENTS as readonly string[]).includes(accent);

  return (
    <div className="space-y-6">
      <Group title="Template">
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={design.template === t.id}
              onClick={() => setD(switchTemplate(design, t.id))}
              className={cn(
                "flex items-start justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors hover:bg-surface",
                design.template === t.id && "border-foreground/40 bg-surface",
              )}
            >
              <span>
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {t.note}
                </span>
              </span>
              {design.template === t.id && (
                <Check className="mt-0.5 size-3.5 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Page">
        <div className="space-y-2.5">
          <Field label="Page size">
            <Segmented
              value={design.pageSize}
              options={[
                { value: "A4", label: "A4" },
                { value: "Letter", label: "Letter" },
              ]}
              onChange={(pageSize) => setD({ pageSize })}
            />
          </Field>
          <Field label="Date format">
            <Segmented
              value={design.dateFormat}
              options={[
                { value: "MM/YYYY", label: "MM/YYYY" },
                { value: "Mon YYYY", label: "Mon YYYY" },
                { value: "YYYY", label: "YYYY" },
              ]}
              onChange={(dateFormat) => setD({ dateFormat })}
            />
          </Field>
        </div>
      </Group>

      <Group title="Font">
        <div className="space-y-2.5">
          <Field label="Family">
            <Select
              items={fontItems}
              value={design.font}
              onValueChange={(v) =>
                v && setD({ font: v as ResumeDesign["font"] })
              }
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontItems.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Slider
            label="Size"
            value={design.fontSize}
            min={8.5}
            max={12.5}
            step={0.5}
            unit="pt"
            onChange={(fontSize) => setD({ fontSize })}
          />
          <Slider
            label="Line height"
            value={design.lineHeight}
            min={1.1}
            max={1.7}
            step={0.05}
            onChange={(lineHeight) => setD({ lineHeight })}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onFit}
          >
            <Minimize2 /> Fit to one page
          </Button>
        </div>
      </Group>

      <Group title="Spacing">
        <div className="space-y-2.5">
          <Slider
            label="Margin"
            value={design.margin}
            min={8}
            max={25}
            step={1}
            unit="mm"
            onChange={(margin) => setD({ margin })}
          />
          <Slider
            label="Section spacing"
            value={design.sectionGap}
            min={2}
            max={10}
            step={0.5}
            unit="mm"
            onChange={(sectionGap) => setD({ sectionGap })}
          />
        </div>
      </Group>

      <Group title="Header">
        <div className="space-y-2.5">
          <Field label="Alignment">
            <Segmented
              value={design.headerAlign}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
              ]}
              onChange={(headerAlign) => setD({ headerAlign })}
            />
          </Field>
          {/* A left header already puts the headline under the name. */}
          {design.headerAlign === "center" && (
            <Field label="Headline">
              <Segmented
                value={design.headlinePosition}
                options={[
                  { value: "beside", label: "Beside name" },
                  { value: "below", label: "Below name" },
                ]}
                onChange={(headlinePosition) => setD({ headlinePosition })}
              />
            </Field>
          )}
          <Field label="Contact details">
            <Segmented
              value={design.contactStyle}
              options={[
                { value: "icons", label: "Icons" },
                { value: "dots", label: "Dots" },
                { value: "bars", label: "Bars" },
              ]}
              onChange={(contactStyle) => setD({ contactStyle })}
            />
          </Field>
        </div>
      </Group>

      <Group title="Section headings">
        <div className="space-y-2.5">
          <Field label="Case">
            <Segmented
              value={design.headingCase}
              options={[
                { value: "upper", label: "Uppercase" },
                { value: "title", label: "Title" },
              ]}
              onChange={(headingCase) => setD({ headingCase })}
            />
          </Field>
          <Field label="Line">
            <Segmented
              value={design.headingRule}
              options={[
                { value: "none", label: "None" },
                { value: "thin", label: "Thin" },
                { value: "thick", label: "Thick" },
              ]}
              onChange={(headingRule) => setD({ headingRule })}
            />
          </Field>
        </div>
      </Group>

      <Group title="Entries">
        <div className="space-y-2.5">
          <Field label="Date & location">
            <Segmented
              value={design.datePosition}
              options={[
                { value: "right", label: "Right" },
                { value: "below", label: "Below" },
              ]}
              onChange={(datePosition) => setD({ datePosition })}
            />
          </Field>
          <Field label="Subtitle">
            <Segmented
              value={design.subtitle}
              options={[
                { value: "inline", label: "Same line" },
                { value: "below", label: "Below" },
              ]}
              onChange={(subtitle) => setD({ subtitle })}
            />
          </Field>
        </div>
      </Group>

      <Group title="Links">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={design.linkUnderline}
            onClick={() => setD({ linkUnderline: !design.linkUnderline })}
          >
            Underline
          </Chip>
          <Chip
            active={design.linkIcon}
            onClick={() => setD({ linkIcon: !design.linkIcon })}
          >
            Link icon
          </Chip>
        </div>
      </Group>

      <Group title="Colour">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {RESUME_ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Accent ${c}`}
                aria-pressed={accent === c}
                onClick={() => setD({ accent: c })}
                className={cn(
                  "grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                  accent === c && "ring-2 ring-foreground",
                )}
                style={{ background: c }}
              >
                {accent === c && <Check className="size-3 text-white" />}
              </button>
            ))}
            <label
              className={cn(
                "relative size-6 cursor-pointer overflow-hidden rounded-full ring-offset-2 ring-offset-background",
                customAccent && "ring-2 ring-foreground",
              )}
              style={{
                background: customAccent
                  ? design.accent
                  : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
              }}
            >
              <span className="sr-only">Custom accent colour</span>
              <input
                type="color"
                value={design.accent}
                onChange={(e) => setD({ accent: e.target.value })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Apply to</p>
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_TARGETS.map((t) => (
                <Chip
                  key={t.id}
                  active={design.accentOn.includes(t.id)}
                  onClick={() => toggleTarget(t.id)}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>
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
      </Group>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-4 w-full cursor-pointer accent-foreground"
      />
      <span className="text-right text-xs tabular-nums">
        {value}
        {unit}
      </span>
    </label>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border px-2.5 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
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
