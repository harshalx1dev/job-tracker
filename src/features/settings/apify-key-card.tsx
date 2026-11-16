"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/relative-time";
import { removeApifyToken, saveApifyToken } from "@/server/search/key-actions";
import type { ApifyStatus } from "@/server/search/credentials";

export const APIFY_TOKEN_URL =
  "https://console.apify.com/settings/integrations";

export function ApifyKeyCard({ status }: { status: ApifyStatus }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();
  const [replacing, setReplacing] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      const res = await saveApifyToken(token);
      if (!res.ok) return setError(res.error);
      setToken("");
      setReplacing(false);
      toast.success(`Connected to Apify as ${res.data.username}`);
    });
  }

  const showForm = !status.connected || replacing;

  return (
    <div className="space-y-3">
      {status.connected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <span className="grid size-9 place-items-center rounded-lg bg-surface">
            <CheckCircle2 className="size-4 text-emerald-500" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              Apify connected as {status.username}{" "}
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
              · {status.usedToday} of {status.limit} searches used in the last
              24 hours
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
                  await removeApifyToken();
                  toast("Apify token removed");
                })
              }
            >
              {removing && <Loader2 className="animate-spin" />}
              Remove
            </Button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          method="post"
          onSubmit={submit}
          className="rounded-xl border p-4"
          noValidate
        >
          <label className="block text-sm font-medium" htmlFor="apify-token">
            {status.connected ? "New Apify API token" : "Apify API token"}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            It&rsquo;s checked once, stored encrypted and never shown again.
            Claude can use it only through Trackr, which limits each search to
            30 listings, about a cent of your Apify credit.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="apify-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="apify_api_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                aria-invalid={!!error}
                className="h-9 pl-8 font-mono"
              />
            </div>
            <Button
              type="submit"
              className="h-9"
              disabled={saving || token.trim().length < 20}
            >
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Checking" : "Check and save"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <a
            href={APIFY_TOKEN_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Create a token in your Apify account (free plan: $5 a month){" "}
            <ExternalLink className="size-3" />
          </a>
        </form>
      )}
    </div>
  );
}
