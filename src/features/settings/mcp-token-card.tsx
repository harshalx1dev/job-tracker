"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_EXPIRY_DAYS, hasScope, tokenState } from "@/lib/mcp-token";
import { createMcpToken, revokeMcpToken } from "@/server/mcp/token-actions";
import type { PublicToken } from "@/server/mcp/tokens";

const LIFETIMES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "0", label: "Never expires" },
];

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy. Select it and copy by hand.");
  }
}

/**
 * Tokens for the Claude connector. The token is shown once, right after it is
 * created, and only its hash is stored. Anyone holding it can do what its scope
 * allows with this account's job-search data, so it is treated like a password.
 */
export function McpTokenCard({
  tokens,
  endpoint,
}: {
  tokens: PublicToken[];
  endpoint: string;
}) {
  const [name, setName] = useState("Claude");
  const [write, setWrite] = useState(false);
  const [days, setDays] = useState(String(DEFAULT_EXPIRY_DAYS));
  const [created, setCreated] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [revoking, startRevoke] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    startCreate(async () => {
      const res = await createMcpToken({
        name,
        write,
        expiresInDays: Number(days),
      });
      if (!res.ok) return void toast.error(res.error);
      setCreated(res.data.token);
      setWrite(false);
    });
  }

  return (
    <div className="space-y-4">
      {created && (
        <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium">
            Your token is ready. Copy it now: it won&rsquo;t be shown again.
          </p>
          <CopyRow
            label="Header value for Claude"
            value={`Bearer ${created}`}
          />
          <CopyRow label="Server URL" value={endpoint} />
          <Button variant="outline" size="sm" onClick={() => setCreated(null)}>
            <Check /> I&rsquo;ve copied it
          </Button>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {tokens.map((t) => {
            const state = tokenState(t);
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-surface">
                  <Plug className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.prefix}…
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasScope(t.scopes, "write")
                      ? "Read and write"
                      : "Read only"}{" "}
                    ·{" "}
                    {state === "revoked"
                      ? "Revoked"
                      : state === "expired"
                        ? "Expired"
                        : t.expiresAt
                          ? `Expires ${t.expiresAt.toLocaleDateString()}`
                          : "Never expires"}{" "}
                    ·{" "}
                    {t.lastUsedAt ? (
                      <>
                        Used <RelativeTime date={t.lastUsedAt} />
                      </>
                    ) : (
                      "Never used"
                    )}
                  </p>
                </div>
                {state === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={revoking}
                    onClick={() => {
                      if (
                        !confirm(
                          `Revoke "${t.name}"? Claude loses access straight away.`,
                        )
                      )
                        return;
                      startRevoke(async () => {
                        const res = await revokeMcpToken(t.id);
                        if (!res.ok) return void toast.error(res.error);
                        toast("Token revoked");
                      });
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={create} className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-medium">New token</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
          <Input
            aria-label="Token name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="h-9"
          />
          <Select
            items={LIFETIMES}
            value={days}
            onValueChange={(v) => v && setDays(v)}
          >
            <SelectTrigger size="sm" className="w-full" aria-label="Lifetime">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIFETIMES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={write}
            onCheckedChange={(v) => setWrite(v === true)}
            className="mt-0.5"
          />
          <span>
            Let Claude add things (jobs, resume versions, drafts, answers).
            <span className="block text-xs text-muted-foreground">
              It can never edit or delete what you already have. Start read-only
              if you&rsquo;re unsure.
            </span>
          </span>
        </label>
        <Button type="submit" size="sm" disabled={creating || !name.trim()}>
          {creating && <Loader2 className="animate-spin" />}
          Create token
        </Button>
      </form>

      <details className="rounded-xl border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium select-none">
          How to connect Claude
        </summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>
            In Claude, open <b>Customize → Connectors → Add custom connector</b>
            .
          </li>
          <li>
            Name it <b>Trackr</b>, paste the server URL, then click Continue.
          </li>
          <li>
            Set Authentication to <b>No sign-in</b>. Under{" "}
            <b>Request headers</b> add a header named <code>authorization</code>{" "}
            with the value above (it starts with <code>Bearer </code>), and mark
            it Required.
          </li>
          <li>Click Add.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Claude can&rsquo;t edit a header after saving. To rotate a token,
          remove the connector and add it again with a new one. Never share a
          token: it works like a password for your job-search data.
        </p>
      </details>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => copy(value, label)}
        >
          <Copy /> Copy
        </Button>
      </div>
    </div>
  );
}
