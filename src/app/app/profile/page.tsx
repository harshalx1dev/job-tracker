import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileEditor } from "@/features/profile/profile-editor";
import { getAiStatus } from "@/server/ai/status";
import { getPendingUpload, getProfile } from "@/server/profile/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Profile</h1>
        <p className="mt-1 mb-8 max-w-prose text-sm text-muted-foreground">
          Your resume as structured data. Every AI feature reads it: match
          scores, outreach and answers.
        </p>
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <ProfileLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function ProfileLoader() {
  const user = await requireUser();
  const [{ profile }, pending, ai] = await Promise.all([
    getProfile(user.id),
    getPendingUpload(user.id),
    getAiStatus(user),
  ]);
  return (
    <ProfileEditor
      initial={profile}
      pending={pending}
      aiReady={ai.source !== null}
    />
  );
}
