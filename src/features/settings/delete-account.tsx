"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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
import { deleteAccount } from "@/server/account-actions";

export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Permanently deletes your account, jobs, resumes, answers, prep plans
          and saved AI key. This can&rsquo;t be undone.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 /> Delete account
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Everything is removed for good. Type{" "}
              <span className="font-mono text-foreground">{email}</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={email}
            autoComplete="off"
            aria-label="Your email, to confirm"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                pending || typed.trim().toLowerCase() !== email.toLowerCase()
              }
              onClick={() =>
                start(async () => {
                  const res = await deleteAccount(typed);
                  if (!res.ok) return void toast.error(res.error);
                  router.replace("/");
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
