"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importQuestionFile } from "@/server/prep/actions";

export function QuestionImportForm() {
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    imported: number;
    total: number;
    skipped: { row: number; reason: string }[];
  } | null>(null);

  return (
    <form
      ref={form}
      className="space-y-3 rounded-2xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await importQuestionFile(data);
          if (!res.ok) return void toast.error(res.error);
          setResult(res.data);
          toast.success(`Imported ${res.data.imported} questions`);
          form.current?.reset();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            Source name
          </span>
          <Input name="name" placeholder="Used for CSV; JSON brings its own" />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            Source URL
          </span>
          <Input name="url" placeholder="https://" />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            Licence
          </span>
          <Input name="license" placeholder="e.g. CC BY 4.0, with permission" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".json,.csv,application/json,text/csv"
          required
          className="text-sm file:mr-3 file:h-8 file:rounded-md file:border file:bg-surface file:px-3 file:text-sm file:text-foreground"
        />
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? <Loader2 className="animate-spin" /> : <FileUp />}
          Import
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Re-importing the same source updates its questions in place. Rows
        without a priority are set to P2 and marked for review. Format: see{" "}
        <code className="font-mono">src/lib/question-import.ts</code>.
      </p>
      {result && (
        <div className="rounded-xl bg-surface p-3 text-sm">
          <p>
            {result.imported} imported · source now has {result.total} questions
            {result.skipped.length > 0 &&
              ` · ${result.skipped.length} rows skipped`}
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 text-xs text-muted-foreground">
              {result.skipped.map((s) => (
                <li key={s.row}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
