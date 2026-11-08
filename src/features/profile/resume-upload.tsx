"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  PROFILE_SECTIONS,
  sectionSize,
  type Profile,
  type ProfileSection,
} from "@/lib/profile";
import {
  applyParsedResume,
  discardUpload,
  uploadResume,
} from "@/server/profile/actions";

export type PendingUpload = {
  id: string;
  fileName: string;
  parsed: Profile | null;
};

const MAX = 4 * 1024 * 1024;

export function ResumeUpload({
  pending,
  aiReady,
}: {
  pending: PendingUpload | null;
  aiReady: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, startUpload] = useTransition();
  const [review, setReview] = useState<PendingUpload | null>(null);

  function send(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX) return void toast.error("Files up to 4 MB, please.");
    if (!/\.(pdf|docx)$/i.test(file.name))
      return void toast.error("Upload a PDF or a Word (.docx) file.");
    const form = new FormData();
    form.set("file", file);
    startUpload(async () => {
      const res = await uploadResume(form);
      if (!res.ok) return void toast.error(res.error);
      setReview({
        id: res.data.uploadId,
        fileName: res.data.fileName,
        parsed: res.data.parsed,
      });
    });
  }

  return (
    <>
      {pending?.parsed && !review && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
          <Sparkles className="size-4 text-brand" />
          <span className="flex-1">
            <span className="font-medium">{pending.fileName}</span> was parsed
            and is waiting for your review.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReview(pending)}
          >
            Review
          </Button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (aiReady) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (aiReady && !busy) send(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors duration-150",
          over ? "border-primary bg-primary/5" : "bg-card",
          !aiReady && "opacity-60",
        )}
      >
        <span className="grid size-11 place-items-center rounded-xl bg-surface">
          {busy ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <FileUp className="size-5 text-muted-foreground" />
          )}
        </span>
        <div>
          <p className="text-sm font-medium">
            {busy
              ? "Reading your resume…"
              : "Fill your profile from your resume"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {busy
              ? "Extracting the text and structuring it with Gemini. This takes a few seconds."
              : "PDF or Word, up to 4 MB. You review every section before anything changes."}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e) => {
            send(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!aiReady || busy}
          onClick={() => input.current?.click()}
        >
          Choose file
        </Button>
      </div>

      {review?.parsed && (
        <ReviewDialog
          key={review.id}
          upload={review as Required<PendingUpload> & { parsed: Profile }}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}

function ReviewDialog({
  upload,
  onClose,
}: {
  upload: PendingUpload & { parsed: Profile };
  onClose: () => void;
}) {
  const p = upload.parsed;
  const found = PROFILE_SECTIONS.filter((s) => sectionSize(p, s.key) > 0);
  const [chosen, setChosen] = useState<Set<ProfileSection>>(
    new Set(found.map((s) => s.key)),
  );
  const [applying, startApply] = useTransition();
  const [discarding, startDiscard] = useTransition();

  const toggle = (k: ProfileSection) =>
    setChosen((c) => {
      const n = new Set(c);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review what was found</DialogTitle>
          <DialogDescription>
            From {upload.fileName}. Chosen sections replace the same sections in
            your profile; the rest stay as they are. You can edit everything
            afterwards.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-xl border">
          {PROFILE_SECTIONS.map((s) => {
            const n = sectionSize(p, s.key);
            return (
              <li
                key={s.key}
                className={cn("flex gap-3 p-3", n === 0 && "opacity-50")}
              >
                <Checkbox
                  checked={chosen.has(s.key)}
                  disabled={n === 0}
                  onCheckedChange={() => toggle(s.key)}
                  aria-label={`Use ${s.label}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {s.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      {n === 0
                        ? "· nothing found"
                        : Array.isArray(p[s.key])
                          ? `· ${n}`
                          : ""}
                    </span>
                  </p>
                  <Preview profile={p} section={s.key} />
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            disabled={discarding || applying}
            onClick={() =>
              startDiscard(async () => {
                await discardUpload(upload.id);
                onClose();
              })
            }
          >
            Discard
          </Button>
          <Button
            disabled={applying || chosen.size === 0}
            onClick={() =>
              startApply(async () => {
                const res = await applyParsedResume(upload.id, [...chosen]);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Profile updated from your resume");
                onClose();
              })
            }
          >
            {applying && <Loader2 className="animate-spin" />}
            Use {chosen.size} {chosen.size === 1 ? "section" : "sections"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Preview({
  profile: p,
  section,
}: {
  profile: Profile;
  section: ProfileSection;
}) {
  const muted = "mt-1 text-xs text-muted-foreground";
  switch (section) {
    case "basics":
      return (
        <p className={muted}>
          {[p.basics.name, p.basics.headline, p.basics.location, p.basics.email]
            .filter(Boolean)
            .join(" · ")}
          {p.basics.links.length > 0 && ` · ${p.basics.links.length} links`}
        </p>
      );
    case "summary":
      return p.summary ? (
        <p className={cn(muted, "line-clamp-2")}>{p.summary}</p>
      ) : null;
    case "experience":
      return (
        <ul className={muted}>
          {p.experience.slice(0, 4).map((e, i) => (
            <li key={i} className="truncate">
              {e.title} · {e.company}{" "}
              <span className="font-mono">
                {e.start}–{e.end}
              </span>{" "}
              · {e.highlights.length} bullets
            </li>
          ))}
        </ul>
      );
    case "projects":
      return (
        <p className={muted}>{p.projects.map((x) => x.name).join(", ")}</p>
      );
    case "education":
      return (
        <p className={muted}>
          {p.education.map((x) => `${x.degree} ${x.school}`.trim()).join(" · ")}
        </p>
      );
    case "skills":
      return (
        <p className={cn(muted, "line-clamp-2")}>
          {p.skills.flatMap((g) => g.items).join(", ")}
        </p>
      );
    case "certifications":
      return (
        <p className={muted}>
          {p.certifications.map((c) => c.name).join(", ")}
        </p>
      );
  }
}
