import { relations } from "drizzle-orm";
import {
  boolean,
  primaryKey,
  real,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  timestamp,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ───────────────────────── Auth (Better Auth) ───────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"), // "user" | "admin"
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────────────────────── Tracker ───────────────────────────── */

export const statusKind = pgEnum("status_kind", ["open", "won", "lost"]);
export const workMode = pgEnum("work_mode", ["remote", "hybrid", "onsite"]);
export const jobPriority = pgEnum("job_priority", ["low", "medium", "high"]);

export const statuses = pgTable(
  "statuses",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(), // token key, e.g. "violet"
    kind: statusKind("kind").notNull().default("open"),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("statuses_user_idx").on(t.userId, t.position)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    statusId: text("status_id")
      .notNull()
      .references(() => statuses.id, { onDelete: "restrict" }),
    /** Fractional index key; compare with plain string comparison. */
    position: text("position").notNull(),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    workMode: workMode("work_mode"),
    url: text("url"),
    source: text("source"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    currency: text("currency"),
    description: text("description"),
    skills: text("skills").array().notNull().default([]),
    priority: jobPriority("priority").notNull().default("medium"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    interviewAt: timestamp("interview_at", { withTimezone: true }),
    notes: text("notes"),
    /** Latest AI match result against the profile (see src/lib/ai-schemas.ts). */
    match: jsonb("match").$type<import("@/lib/ai-schemas").JobMatch>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_user_status_idx").on(t.userId, t.statusId)],
);

export const jobEventType = pgEnum("job_event_type", [
  "created",
  "status_changed",
  "updated",
  "note",
  "archived",
  "restored",
]);

export const jobEvents = pgTable(
  "job_events",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: jobEventType("type").notNull(),
    fromStatusId: text("from_status_id"),
    toStatusId: text("to_status_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("job_events_job_idx").on(t.jobId, t.createdAt)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("contacts_job_idx").on(t.jobId)],
);

/* ───────────────────────────── AI ───────────────────────────── */

export const aiKeySource = pgEnum("ai_key_source", ["user", "admin"]);

/** A user's own Gemini key, AES-256-GCM encrypted. Never sent to the browser. */
export const aiCredentials = pgTable("ai_credentials", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("google"),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  last4: text("last4").notNull(),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Per-user AI choices: the model for outreach and answer drafts, and what test
 * calls found about each model for the current key. Cleared when the key changes.
 */
export const aiSettings = pgTable("ai_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  draftModel: text("draft_model"),
  modelAccess: jsonb("model_access")
    .$type<Record<string, "ok" | "blocked">>()
    .notNull()
    .default({}),
  updatedAt: updatedAt(),
});

/** One row per AI call: the usage log and the rate limiter's source of truth. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    keySource: aiKeySource("key_source").notNull(),
    model: text("model").notNull(),
    ok: boolean("ok").notNull(),
    error: text("error"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_user_time_idx").on(t.userId, t.createdAt)],
);

/* ───────────────────────────── Profile ───────────────────────────── */

/** The canonical profile (resume data) that every AI feature reads. */
export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<import("@/lib/profile").Profile>().notNull(),
  updatedAt: updatedAt(),
});

/** Uploaded resumes: extracted text and the parser's result, kept for review. */
export const resumeUploads = pgTable(
  "resume_uploads",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    extractedText: text("extracted_text").notNull(),
    parsed: jsonb("parsed").$type<import("@/lib/profile").Profile>(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("resume_uploads_user_idx").on(t.userId, t.createdAt)],
);

/* ───────────────────────────── Resumes ───────────────────────────── */

/** A resume: a snapshot of the profile plus its design. Optionally tailored to one job. */
export const resumes = pgTable(
  "resumes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    content: jsonb("content")
      .$type<import("@/lib/profile").Profile>()
      .notNull(),
    design: jsonb("design")
      .$type<import("@/lib/resume").ResumeDesign>()
      .notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("resumes_user_idx").on(t.userId, t.updatedAt)],
);

/* ───────────────────────────── AI writing ───────────────────────────── */

/** Saved outreach drafts (emails, LinkedIn notes). */
export const outreachMessages = pgTable(
  "outreach_messages",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    channel: text("channel").notNull(),
    tone: text("tone").notNull(),
    recipientName: text("recipient_name"),
    subject: text("subject"),
    body: text("body").notNull(),
    favorite: boolean("favorite").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("outreach_user_idx").on(t.userId, t.createdAt)],
);

/** Reusable answers to application questions, with an embedding for "find similar". */
export const answers = pgTable(
  "answers",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    tags: text("tags").array().notNull().default([]),
    wordLimit: integer("word_limit"),
    /** 768-d Gemini embedding of the question; compared in memory (no pgvector needed). */
    embedding: real("embedding").array(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("answers_user_idx").on(t.userId, t.updatedAt)],
);

/* ───────────────────────────── Interview prep ───────────────────────────── */

/** A curated source of questions (a doc, a site export, a CSV). */
export const questionSources = pgTable("question_sources", {
  id: id(),
  name: text("name").notNull().unique(),
  url: text("url"),
  license: text("license"),
  questionCount: integer("question_count").notNull().default(0),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Questions and answers exactly as the source has them. Never AI-generated. */
export const questions = pgTable(
  "questions",
  {
    id: id(),
    sourceId: text("source_id")
      .notNull()
      .references(() => questionSources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    topic: text("topic").notNull(),
    subtopic: text("subtopic"),
    skills: text("skills").array().notNull().default([]),
    priority: text("priority").notNull(), // P1 | P2 | P3
    frequency: real("frequency").notNull().default(0.5),
    difficulty: text("difficulty"),
    estMinutes: integer("est_minutes").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    references: jsonb("references").$type<string[]>().notNull().default([]),
    /** Set when the source gave no priority (defaulted to P2), for admin review. */
    needsReview: boolean("needs_review").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("questions_source_ext_idx").on(t.sourceId, t.externalId),
    index("questions_topic_idx").on(t.topic),
  ],
);

export const prepVisibility = pgEnum("prep_visibility", ["private", "link"]);

export const prepPlans = pgTable(
  "prep_plans",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // crash | multiday | full
    days: integer("days").notNull().default(1),
    dailyBudgetMin: integer("daily_budget_min").notNull().default(240),
    visibility: prepVisibility("visibility").notNull().default("private"),
    shareToken: text("share_token").unique(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("prep_plans_job_idx").on(t.jobId),
    uniqueIndex("prep_plans_job_kind_idx").on(t.jobId, t.kind),
  ],
);

export const prepPlanItems = pgTable(
  "prep_plan_items",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => prepPlans.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.planId, t.questionId] })],
);

/** Per-person progress, so anyone with a shared link can track their own. */
export const prepProgress = pgTable(
  "prep_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => prepPlans.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    state: text("state").notNull(), // done | confident | revise
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.planId, t.questionId] })],
);

/* ───────────────────────────── Relations ───────────────────────────── */

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  status: one(statuses, { fields: [jobs.statusId], references: [statuses.id] }),
  events: many(jobEvents),
  contacts: many(contacts),
}));

export const jobEventsRelations = relations(jobEvents, ({ one }) => ({
  job: one(jobs, { fields: [jobEvents.jobId], references: [jobs.id] }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  job: one(jobs, { fields: [contacts.jobId], references: [jobs.id] }),
}));

export type Status = typeof statuses.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobEvent = typeof jobEvents.$inferSelect;
export type Contact = typeof contacts.$inferSelect;

export type Resume = typeof resumes.$inferSelect;
export type OutreachMessage = typeof outreachMessages.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type PrepPlan = typeof prepPlans.$inferSelect;
export type Question = typeof questions.$inferSelect;
