import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusManager } from "@/features/settings/status-manager";
import { AiKeyCard } from "@/features/settings/ai-key-card";
import { DeleteAccount } from "@/features/settings/delete-account";
import { DraftModelCard } from "@/features/settings/draft-model-card";
import { McpTokenCard } from "@/features/settings/mcp-token-card";
import { getMcpTokensSafe } from "@/server/mcp/tokens";
import { getModelPicker } from "@/server/ai/models";
import { getAiStatus } from "@/server/ai/status";
import { listStatuses } from "@/server/jobs/statuses";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Settings</h1>
        <Suspense fallback={<SettingsSkeleton />}>
          <SettingsLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function SettingsLoader() {
  const user = await requireUser();
  const [statuses, ai, mcpTokens] = await Promise.all([
    listStatuses(user.id),
    getAiStatus(user),
    getMcpTokensSafe(user.id),
  ]);
  const mcpEndpoint = `${(process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}/api/mcp`;
  return (
    <>
      <Section title="Account" description="Signed in with email and password.">
        <dl className="divide-y rounded-xl border text-sm">
          <Row label="Name">{user.name}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Role">
            {user.role === "admin" ? (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-brand" /> Admin
              </span>
            ) : (
              "Member"
            )}
          </Row>
        </dl>
      </Section>

      <Section
        title="Pipeline stages"
        description="The columns on your board, in order. Drag to reorder, click a dot to change its colour. A stage marked as an offer or closed doesn't count as active."
      >
        <StatusManager statuses={statuses} />
      </Section>

      <Section
        title="AI key"
        description="AI features (resume parsing, job import, match scores) run on your own Gemini key."
      >
        <AiKeyCard status={ai} />
      </Section>

      <Section
        title="AI models"
        description="Which Gemini model handles each kind of task. Only models your key can use."
      >
        {/* Its own boundary: listing models calls Google, the rest of the page shouldn't wait. */}
        <Suspense fallback={<Skeleton className="h-44 rounded-xl" />}>
          <DraftModelLoader />
        </Suspense>
      </Section>

      {/* null: the connector tables aren't there yet (migration pending); hide the card. */}
      {mcpTokens && (
        <Section
          title="Claude connector"
          description="Let Claude read your profile and jobs, and add leads and drafts, using a token you control."
        >
          <McpTokenCard tokens={mcpTokens} endpoint={mcpEndpoint} />
        </Section>
      )}

      <Section
        title="Delete account"
        description="Removes your data from Trackr for good."
      >
        <DeleteAccount email={user.email} />
      </Section>
    </>
  );
}

async function DraftModelLoader() {
  const user = await requireUser();
  return <DraftModelCard picker={await getModelPicker(user)} />;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 grid gap-4 md:grid-cols-[14rem_1fr] md:gap-8">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-11 items-center gap-4 px-4">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="mt-10 space-y-6">
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
