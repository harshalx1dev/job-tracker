"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/relative-time";
import { removeAiKey, saveAiKey } from "@/server/ai/key-actions";
import type { AiStatus } from "@/server/ai/status";

export const GEMINI_KEY_URL = "https://aistudio.google.com/app/apikey";

export function AiKeyCard({ status }: { status: AiStatus }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();
  const [replacing, setReplacing] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      const res = await saveAiKey(key);
      if (!res.ok) return setError(res.error);
      setKey("");
      setReplacing(false);
      toast.success(`Key ending ${res.data.last4} connected`);
    });
  }

  const hasOwn = status.source === "user";
  const showForm = !hasOwn || replacing;

  return (
    <div className="space-y-3">
      {hasOwn && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <span className="grid size-9 place-items-center rounded-lg bg-surface">
            <CheckCircle2 className="size-4 text-emerald-500" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              Gemini key connected{" "}
              <span className="font-mono text-muted-foreground">
                •••• {status.last4}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {status.validatedAt ? (
                <>
                  Checked <RelativeTime date={status.validatedAt} />
                </>
              ) : (
                "Saved"
              )}{" "}
              · {status.usedToday} of {status.limitPerDay} requests used today ·{" "}
              {status.model}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplacing((r) => !r)}
            >
              {replacing ? "Cancel" : "Replace"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={removing}
              onClick={() =>
                startRemove(async () => {
                  await removeAiKey();
                  toast("Key removed");
                })
              }
            >
              {removing && <Loader2 className="animate-spin" />}
              Remove
            </Button>
          </div>
        </div>
      )}

      {status.source === "admin" && (
        <div className="flex items-center gap-3 rounded-xl border p-4 text-sm">
          <ShieldCheck className="size-4 shrink-0 text-brand" />
          <p>
            Using the app&rsquo;s key (admins only).{" "}
            <span className="text-muted-foreground">
              {status.usedToday} of {status.limitPerDay} requests used today.
              Add your own key below to use that instead.
            </span>
          </p>
        </div>
      )}

      {showForm && (
        <form
          method="post"
          onSubmit={submit}
          className="rounded-xl border p-4"
          noValidate
        >
          <label className="block text-sm font-medium" htmlFor="gemini-key">
            {hasOwn ? "New Gemini API key" : "Gemini API key"}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Free from Google AI Studio. It&rsquo;s tested once, stored encrypted
            and never shown again.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="gemini-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste your key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                aria-invalid={!!error}
                className="h-9 pl-8 font-mono"
              />
            </div>
            <Button
              type="submit"
              className="h-9"
              disabled={saving || key.trim().length < 20}
            >
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Testing key" : "Test and save"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <a
            href={GEMINI_KEY_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Get a free key in Google AI Studio{" "}
            <ExternalLink className="size-3" />
          </a>
        </form>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        On Gemini&rsquo;s free tier, Google may use what you send to improve its
        models. Your resume text and job descriptions are sent only when you use
        an AI feature. Use a paid key if that matters for you.
      </p>
    </div>
  );
}
