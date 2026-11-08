"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Contact } from "@/server/db/schema";
import { addContact, deleteContact } from "@/server/jobs/contact-actions";

const EMPTY = { name: "", role: "", email: "", linkedinUrl: "" };

export function ContactsSection({
  jobId,
  initial,
}: {
  jobId: string;
  initial: Contact[] | null;
}) {
  const [list, setList] = useState<Contact[] | null>(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setList(initial);
  }
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [pending, start] = useTransition();

  if (list === null) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    start(async () => {
      const res = await addContact(jobId, form);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [...(l ?? []), res.data]);
      setForm(null);
    });
  }

  async function remove(c: Contact) {
    const snapshot = list;
    setList((l) => (l ?? []).filter((x) => x.id !== c.id));
    const res = await deleteContact(c.id);
    if (!res.ok) {
      setList(snapshot);
      toast.error(res.error);
    }
  }

  return (
    <div>
      {list.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {list.map((c) => (
            <li
              key={c.id}
              className="group flex items-center gap-3 px-3 py-2.5"
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-mono text-[11px] text-muted-foreground uppercase"
              >
                {c.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {c.name}
                </span>
                {c.role && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.role}
                  </span>
                )}
              </span>
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  aria-label={`Email ${c.name}`}
                  title={c.email}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  <Mail className="size-3.5" />
                </a>
              )}
              {c.linkedinUrl && (
                <a
                  href={c.linkedinUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${c.name} on LinkedIn`}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={`Remove ${c.name}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-surface hover:text-destructive focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <form
          onSubmit={submit}
          className="mt-2 grid gap-2 rounded-xl border p-3 sm:grid-cols-2"
          noValidate
        >
          <Input
            autoFocus
            placeholder="Name"
            aria-label="Contact name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Role, e.g. Recruiter"
            aria-label="Contact role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <Input
            type="email"
            placeholder="Email"
            aria-label="Contact email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            type="url"
            placeholder="LinkedIn profile URL"
            aria-label="Contact LinkedIn URL"
            value={form.linkedinUrl}
            onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
          />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setForm(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save contact
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant={list.length ? "ghost" : "outline"}
          size="sm"
          className={list.length ? "mt-1 text-muted-foreground" : ""}
          onClick={() => setForm(EMPTY)}
        >
          <Plus /> Add contact
        </Button>
      )}
    </div>
  );
}
