"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PROFILE_SECTIONS, sectionSize, type Profile } from "@/lib/profile";
import { saveProfile } from "@/server/profile/actions";
import { ProfileFields } from "./profile-fields";
import { ResumeUpload, type PendingUpload } from "./resume-upload";

export function ProfileEditor({
  initial,
  pending,
  aiReady,
  questions,
}: {
  initial: Profile;
  pending: PendingUpload | null;
  aiReady: boolean;
  /** The "Questions for you" section, shown after the form. It is not part of the profile being edited. */
  questions?: React.ReactNode;
}) {
  const [profile, setProfile] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  // Server data changed (e.g. parsed sections applied): take it and reset the editor.
  const [epoch, setEpoch] = useState(0);
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setProfile(initial);
    setEpoch((e) => e + 1);
  }
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(profile) !== JSON.stringify(initial);

  function save() {
    startSave(async () => {
      const res = await saveProfile(profile);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Profile saved");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
      <nav aria-label="Profile sections" className="max-lg:hidden">
        <ul className="sticky top-6 space-y-0.5 text-sm">
          {[
            ...PROFILE_SECTIONS,
            { key: "extra" as const, label: "Extra context" },
            ...(questions
              ? [{ key: "questions" as const, label: "Questions for you" }]
              : []),
          ].map((s) => {
            const n =
              s.key === "extra"
                ? profile.extra.trim()
                  ? 1
                  : 0
                : s.key === "questions"
                  ? 0
                  : sectionSize(profile, s.key);
            return (
              <li key={s.key}>
                <a
                  href={`#${s.key}`}
                  className="flex h-8 items-center justify-between rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  {s.label}
                  {/* A filled/empty dot says nothing useful about a list of questions. */}
                  {s.key !== "questions" && (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        n ? "bg-emerald-500" : "bg-foreground/15",
                      )}
                    />
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-10">
        {/* Re-keyed (reset) when server data is applied or changes are discarded. */}
        <div key={`upload-${epoch}`}>
          <ResumeUpload pending={pending} aiReady={aiReady} />
        </div>
        <div key={`fields-${epoch}`} className="space-y-10">
          <ProfileFields profile={profile} onChange={setProfile} />
        </div>
        {/* Outside the keyed parts: discarding profile edits must not reset it. */}
        {questions}
      </div>

      {/* Save bar: appears when there are unsaved changes. */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 transition-[translate,opacity] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]",
          dirty
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border bg-popover px-4 py-2.5 shadow-2xl">
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProfile(initial);
              setEpoch((e) => e + 1);
            }}
            disabled={saving}
          >
            Discard
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save profile
          </Button>
        </div>
      </div>

      {!aiReady && (
        <p className="text-xs text-muted-foreground lg:col-start-2">
          Resume parsing needs a Gemini key.{" "}
          <Link className="underline underline-offset-4" href="/app/settings">
            Connect one in Settings
          </Link>
          .
        </p>
      )}
    </div>
  );
}
