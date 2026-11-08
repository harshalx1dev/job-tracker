/**
 * Demo data: a believable two-month job search for the demo account.
 *
 *   npm run db:seed            (stop `npm run dev` first when using local PGlite:
 *                               PGlite allows one process per database folder)
 *
 * Creates DEMO_EMAIL / DEMO_PASSWORD (see .env.example) if missing, then replaces
 * that user's jobs, events and contacts. Other users are never touched.
 */
import { mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { hashPassword } from "better-auth/crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { readFileSync } from "node:fs";
import { DEFAULT_STATUSES } from "../src/lib/status-colors";
import { defaultDesign } from "../src/lib/resume";
import type { Profile } from "../src/lib/profile";
import { parseQuestionFile } from "../src/lib/question-import";
import {
  buildCrash,
  buildFull,
  buildMultiDay,
  matchQuestions,
  type Priority,
} from "../src/lib/prep";
import { writeImport } from "../src/server/prep/importer";

const DEMO_PROFILE: Profile = {
  basics: {
    name: "Demo User",
    headline: "Senior Frontend Engineer",
    email: "demo@trackr.test",
    phone: "",
    location: "Pune, India",
    links: [{ label: "GitHub", url: "https://github.example/demo" }],
  },
  summary:
    "Frontend engineer with six years building React and Next.js products. I care about fast, accessible interfaces and design systems that teams actually use.",
  experience: [
    {
      company: "Lumenfield",
      title: "Senior Frontend Engineer",
      location: "Pune",
      start: "2022-04",
      end: "Present",
      highlights: [
        "Led the move of 40 screens to React Server Components, cutting client JavaScript by a third",
        "Built and maintain the design system used by six product teams",
        "Introduced Playwright smoke tests that run on every pull request",
      ],
    },
    {
      company: "Brightpath",
      title: "Frontend Engineer",
      location: "Bengaluru",
      start: "2019-07",
      end: "2022-03",
      highlights: [
        "Rebuilt checkout in TypeScript and React; first load dropped by 38%",
        "Ran the accessibility audit and fixed 120 issues across the product",
      ],
    },
  ],
  projects: [
    {
      name: "Trackr",
      description:
        "A job search workspace with a Kanban board, resume builder and interview prep.",
      tech: ["Next.js", "TypeScript", "Postgres", "Gemini"],
      url: "",
    },
  ],
  education: [
    {
      school: "Pune University",
      degree: "B.E.",
      field: "Computer Engineering",
      start: "2015",
      end: "2019",
    },
  ],
  skills: [
    { group: "Languages", items: ["TypeScript", "JavaScript", "HTML", "CSS"] },
    { group: "Frameworks", items: ["React", "Next.js", "Node.js"] },
    {
      group: "Practices",
      items: ["Design systems", "Accessibility", "Performance", "Testing"],
    },
  ],
  certifications: [],
  extra: "Notice period of 30 days. Prefer hybrid roles in Pune or remote.",
};

const EMAIL = process.env.DEMO_EMAIL ?? "demo@trackr.test";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-pass-2026";
const DAY = 86_400_000;

type Seed = {
  company: string;
  title: string;
  stage: string;
  location?: string;
  workMode?: "remote" | "hybrid" | "onsite";
  skills: string[];
  priority?: "low" | "medium" | "high";
  appliedDaysAgo?: number;
  path?: { stage: string; daysAgo: number }[];
  interviewInDays?: number;
  salary?: [number, number];
  contact?: { name: string; role: string };
};

const JOBS: Seed[] = [
  {
    company: "Northwind",
    title: "Senior Frontend Engineer",
    stage: "Interviewing",
    location: "Pune",
    workMode: "hybrid",
    skills: ["React", "Next.js", "TypeScript"],
    priority: "high",
    appliedDaysAgo: 24,
    path: [
      { stage: "Assessment", daysAgo: 16 },
      { stage: "Interviewing", daysAgo: 6 },
    ],
    interviewInDays: 2,
    salary: [3800000, 4500000],
    contact: { name: "Priya Nair", role: "Recruiter" },
  },
  {
    company: "Acme Cloud",
    title: "UI Platform Engineer",
    stage: "Assessment",
    location: "Bengaluru",
    workMode: "onsite",
    skills: ["Vue", "Vite", "Design systems"],
    appliedDaysAgo: 12,
    path: [{ stage: "Assessment", daysAgo: 4 }],
    salary: [3000000, 3600000],
  },
  {
    company: "Lumen Labs",
    title: "React Developer",
    stage: "Applied",
    workMode: "remote",
    skills: ["React", "TypeScript"],
    appliedDaysAgo: 10,
  },
  {
    company: "Quillmark",
    title: "Next.js Developer",
    stage: "Applied",
    location: "Pune",
    workMode: "hybrid",
    skills: ["Next.js", "Node.js"],
    appliedDaysAgo: 3,
  },
  {
    company: "Orbitly",
    title: "Staff Frontend Engineer",
    stage: "Offer",
    location: "Mumbai",
    workMode: "onsite",
    skills: ["React", "GraphQL", "Leadership"],
    priority: "high",
    appliedDaysAgo: 49,
    path: [
      { stage: "Assessment", daysAgo: 40 },
      { stage: "Interviewing", daysAgo: 30 },
      { stage: "Offer", daysAgo: 5 },
    ],
    salary: [5200000, 5200000],
    contact: { name: "Arjun Mehta", role: "Engineering manager" },
  },
  {
    company: "Kestrel",
    title: "Frontend Engineer II",
    stage: "Rejected",
    workMode: "remote",
    skills: ["React", "Testing"],
    priority: "low",
    appliedDaysAgo: 35,
    path: [
      { stage: "Interviewing", daysAgo: 20 },
      { stage: "Rejected", daysAgo: 14 },
    ],
    salary: [2400000, 2800000],
  },
  {
    company: "Halcyon",
    title: "Frontend Engineer, Design Systems",
    stage: "Wishlist",
    workMode: "remote",
    skills: ["React", "Storybook", "Accessibility"],
  },
  {
    company: "Brightwell",
    title: "Senior UI Engineer",
    stage: "Wishlist",
    location: "Hyderabad",
    skills: ["TypeScript", "CSS"],
  },
  {
    company: "Tessellate",
    title: "Frontend Developer",
    stage: "Ghosted",
    workMode: "remote",
    skills: ["Angular"],
    priority: "low",
    appliedDaysAgo: 41,
  },
  {
    company: "Ferncastle",
    title: "Product Engineer",
    stage: "Applied",
    location: "Bengaluru",
    workMode: "hybrid",
    skills: ["React", "Node.js", "Postgres"],
    appliedDaysAgo: 15,
    contact: { name: "Meera Iyer", role: "Talent partner" },
  },
  {
    company: "Pinewire",
    title: "Senior React Engineer",
    stage: "Interviewing",
    workMode: "remote",
    skills: ["React", "Performance"],
    priority: "high",
    appliedDaysAgo: 19,
    path: [{ stage: "Interviewing", daysAgo: 8 }],
    interviewInDays: 5,
  },
  {
    company: "Saltmarsh",
    title: "Frontend Engineer",
    stage: "Rejected",
    location: "Chennai",
    skills: ["React"],
    priority: "low",
    appliedDaysAgo: 28,
    path: [{ stage: "Rejected", daysAgo: 21 }],
  },
  {
    company: "Copperleaf",
    title: "UI Engineer",
    stage: "Applied",
    workMode: "remote",
    skills: ["Svelte", "TypeScript"],
    appliedDaysAgo: 6,
  },
  {
    company: "Driftwood",
    title: "Frontend Lead",
    stage: "Wishlist",
    location: "Pune",
    workMode: "hybrid",
    skills: ["React", "Leadership"],
    priority: "medium",
  },
];

type DB = PostgresJsDatabase<typeof schema>;

async function openDb(): Promise<{ db: DB; close: () => Promise<unknown> }> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { max: 1 });
    return {
      db: drizzle(client, { schema, casing: "snake_case" }),
      close: () => client.end(),
    };
  }
  const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
  mkdirSync(dir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(dir);
  return {
    db: drizzle(client, { schema, casing: "snake_case" }) as unknown as DB,
    close: () => client.close(),
  };
}

async function main() {
  const { db, close } = await openDb();
  const now = Date.now();
  const ago = (d: number) => new Date(now - d * DAY);

  let user = await db.query.user.findFirst({
    where: eq(schema.user.email, EMAIL),
  });
  if (!user) {
    const id = randomUUID();
    [user] = await db
      .insert(schema.user)
      .values({
        id,
        name: "Demo User",
        email: EMAIL,
        emailVerified: true,
        role: "user",
      })
      .returning();
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(PASSWORD),
    });
    console.log(`created ${EMAIL}`);
  }
  const userId = user.id;
  // The demo login must keep working when email verification is switched on.
  await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.id, userId));

  // Fresh start for this user only.
  await db.delete(schema.jobs).where(eq(schema.jobs.userId, userId));
  await db.delete(schema.statuses).where(eq(schema.statuses.userId, userId));
  const statusRows = await db
    .insert(schema.statuses)
    .values(DEFAULT_STATUSES.map((s, i) => ({ ...s, userId, position: i })))
    .returning();
  const stage = (name: string) => statusRows.find((s) => s.name === name)!;

  const lastPos: Record<string, string | null> = {};
  for (const j of JOBS) {
    const st = stage(j.stage);
    const position = generateKeyBetween(lastPos[st.id] ?? null, null);
    lastPos[st.id] = position;
    const created = ago((j.appliedDaysAgo ?? 3) + 2);
    const lastMove = j.path?.at(-1)?.daysAgo ?? j.appliedDaysAgo ?? 2;

    const [row] = await db
      .insert(schema.jobs)
      .values({
        userId,
        statusId: st.id,
        position,
        company: j.company,
        title: j.title,
        location: j.location,
        workMode: j.workMode,
        skills: j.skills,
        priority: j.priority ?? "medium",
        appliedAt: j.appliedDaysAgo ? ago(j.appliedDaysAgo) : null,
        interviewAt: j.interviewInDays
          ? new Date(now + j.interviewInDays * DAY + 4 * 3_600_000)
          : null,
        salaryMin: j.salary?.[0],
        salaryMax: j.salary?.[1],
        currency: j.salary ? "INR" : null,
        createdAt: created,
        updatedAt: ago(lastMove),
      })
      .returning({ id: schema.jobs.id });

    // Timeline: added, applied, then each move.
    const events: (typeof schema.jobEvents.$inferInsert)[] = [
      {
        jobId: row.id,
        userId,
        type: "created",
        toStatusId: stage("Wishlist").id,
        createdAt: created,
      },
    ];
    let from = stage("Wishlist").id;
    if (j.appliedDaysAgo) {
      events.push({
        jobId: row.id,
        userId,
        type: "status_changed",
        fromStatusId: from,
        toStatusId: stage("Applied").id,
        createdAt: ago(j.appliedDaysAgo),
      });
      from = stage("Applied").id;
    }
    for (const p of j.path ?? []) {
      events.push({
        jobId: row.id,
        userId,
        type: "status_changed",
        fromStatusId: from,
        toStatusId: stage(p.stage).id,
        createdAt: ago(p.daysAgo),
      });
      from = stage(p.stage).id;
    }
    await db.insert(schema.jobEvents).values(events);

    if (j.contact) {
      await db.insert(schema.contacts).values({
        jobId: row.id,
        userId,
        name: j.contact.name,
        role: j.contact.role,
        email: `${j.contact.name.split(" ")[0].toLowerCase()}@${j.company.toLowerCase()}.example`,
      });
    }
  }

  // Profile and a resume built from it.
  await db
    .insert(schema.profiles)
    .values({ userId, data: DEMO_PROFILE })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: { data: DEMO_PROFILE },
    });
  await db.delete(schema.resumes).where(eq(schema.resumes.userId, userId));
  await db.insert(schema.resumes).values({
    userId,
    title: "Senior Frontend Engineer resume",
    content: DEMO_PROFILE,
    design: defaultDesign(),
  });

  // The sample question bank, and prep plans for jobs that list skills.
  const bankFile = "data/sample-question-bank.json";
  await writeImport(
    db,
    parseQuestionFile(
      "sample-question-bank.json",
      readFileSync(bankFile, "utf8"),
    ),
  );
  const bank = (await db.select().from(schema.questions)).map((q) => ({
    ...q,
    priority: q.priority as Priority,
  }));
  const seededJobs = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId));
  for (const job of seededJobs.filter((j) =>
    ["Northwind", "Pinewire"].includes(j.company),
  )) {
    const matched = matchQuestions(bank, job.skills);
    const plans = [
      { kind: "crash", days: 1, items: buildCrash(matched) },
      { kind: "multiday", days: 3, items: buildMultiDay(matched, 3) },
      { kind: "full", days: 0, items: buildFull(matched) },
    ];
    for (const p of plans) {
      // Northwind's 1-day plan is shared by link, to demo the public page.
      const shared = job.company === "Northwind" && p.kind === "crash";
      const shareToken = shared ? randomBytes(24).toString("base64url") : null;
      const [plan] = await db
        .insert(schema.prepPlans)
        .values({
          userId,
          jobId: job.id,
          kind: p.kind,
          days: p.days,
          visibility: shared ? "link" : "private",
          shareToken,
        })
        .returning({ id: schema.prepPlans.id });
      if (shareToken) console.log(`  shared plan: /p/${shareToken}`);
      if (p.items.length)
        await db
          .insert(schema.prepPlanItems)
          .values(p.items.map((i) => ({ ...i, planId: plan.id })));
    }
  }

  console.log(
    `✓ seeded ${JOBS.length} jobs, a profile, a resume and prep plans for ${EMAIL}`,
  );
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
