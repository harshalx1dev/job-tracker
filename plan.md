# Job Tracker — Project Plan

> Working title. A job search workspace that brings together tracking, resumes, AI writing help and interview prep.
> Status: **draft for review**. Edit freely; anything marked ❓ needs a decision.

---

## 1. Goals

- Track every application from wishlist to offer, in a **Kanban** or **list** view.
- One **profile (resume data)** per user drives the resume builder, parsing, outreach and answers.
- AI features use **the user's own Gemini key**. The **app key is admin-only**.
- **Job-based interview prep** comes from a curated question bank. Questions and answers are **never** AI-generated.
- Portfolio-grade quality: polished UI with useful motion, typed end to end, tested, accessible, deployed on Vercel.

### Not in v1
- Native mobile apps
- Auto-applying to jobs or scraping job boards at runtime
- Payments or subscriptions
- Team or recruiter workspaces

---

## 2. Tech stack

| Area | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server code keeps keys safe, renders PDFs, serves fast public prep pages |
| UI | **Tailwind CSS v4 + shadcn/ui** (Radix) | Accessible building blocks we fully own and style |
| Motion | **Motion** (formerly Framer Motion) | Layout and shared-element animations, spring hovers |
| Drag & drop | **dnd-kit** | Accessible, keyboard support, works with Motion |
| Client data | **Server actions** + local optimistic state | Optimistic Kanban moves with rollback; `refresh()` after writes |
| Tables | **TanStack Table** | List view: sorting, filtering, column visibility |
| URL state | **nuqs** | View, filters and search kept in the URL, so they can be shared |
| Forms | Controlled forms + **zod** on the server | Server returns field errors; react-hook-form can come back if forms grow |
| DB | **Postgres (Neon) + Drizzle ORM**; **PGlite** locally | Typed SQL, migrations; **pgvector** for the answer bank; zero-setup local dev |
| Auth | **Better Auth** | Email/password with verification, Google/GitHub sign-in, admin role plugin |
| Email | **Resend** | Verification and password-reset emails |
| AI | **Vercel AI SDK + `@ai-sdk/google`** (Gemini) | Streaming, typed structured output, can switch provider later |
| Rate limiting | Counted from the `ai_usage` table | Works across serverless instances, no extra vendor |
| Resume parsing | **unpdf** (PDF), **mammoth** (DOCX) → Gemini structured output | |
| PDF export | **puppeteer-core + @sparticuz/chromium** (Vercel Node function) | HTML/CSS templates give selectable, ATS-friendly PDFs |
| File storage | **Vercel Blob** | Uploaded resumes, cached PDFs |
| Charts | **Recharts** | Pipeline and funnel analytics |
| Extras | **cmdk** (⌘K palette), **sonner** (toasts), **date-fns**, **fractional-indexing** | |
| Testing | **Vitest** (unit), **Playwright** (end to end) | |
| CI | GitHub Actions: lint, type check, test, build | |

---

## 3. Architecture

```
Browser (RSC + client islands)
   │  server actions / route handlers
   ▼
Next.js on Vercel
   ├─ auth (Better Auth)          ── session, roles (user | admin)
   ├─ data layer (Drizzle)        ── every query scoped by userId
   ├─ AI gateway (src/server/ai)  ── resolves key → provider → model, rate limit, usage log
   ├─ PDF renderer (Node fn)      ── headless Chromium → Blob cache
   └─ question bank importer      ── admin only, adapter per source
   ▼
Neon Postgres (+pgvector) · Upstash Redis · Vercel Blob · Resend
```

### The shared Profile
One canonical `ProfileSchema` (zod, close to JSON Resume): basics, summary, experience, projects, education, skills, certifications, links, extra context ("anything else the AI should know").
- **Parsing** → fills the Profile (after the user reviews it)
- **Builder** → displays Profile or per-job resume variants
- **Outreach / Answers / Match score** → read the Profile as context

### AI gateway (one entry point for every AI call)
1. Resolve the key: the user's own key (decrypted on the server) → else the app key **only if role = admin** → else return `AI_KEY_REQUIRED`. The UI turns that into a "Connect your key" prompt.
2. Rate limit per user and feature (Upstash).
3. Call through the AI SDK (`generateObject` for structured output, `streamText` for drafts).
4. Log to `ai_usage` (feature, key source, tokens).
5. On rate-limit errors from the free tier, retry with backoff.

**Key storage:** AES-256-GCM using `ENCRYPTION_KEY` from the environment. Only the last 4 characters are shown in the UI. The key is checked with a test call when saved. It is never sent back to the browser.

**Privacy notice:** on the Gemini free tier, Google may use prompts to improve its models. Show this once before the first upload or AI action.

---

## 4. Features

### 4.1 Tracker (Kanban + list)
- Default statuses: **Wishlist → Applied → OA / Assessment → Interviewing → Offer**, plus **Rejected** and **Ghosted**. Each user can rename, recolor, reorder and add statuses. Each status has a kind: `open | won | lost`.
- **Board:** drag between columns and within a column. Order uses fractional indexing. Moves update the screen first and roll back on error. Drag works with the keyboard too.
- **List:** sortable and filterable table; edit status, priority and dates inline; bulk select (move or archive).
- **Job detail:** opens as a drawer over the board (intercepting route `/jobs/[id]`), with the card animating into it. Tabs: Overview · Timeline · Contacts · Prep · Outreach · Notes.
- **Timeline:** every change is saved in `job_events` (created, status changed, note, interview scheduled …).
- **Quick add:** paste a URL or job description → **AI job import** fills company, title, location, work mode, salary and skill tags. The user reviews before saving.
- **Match score** (AI): Profile vs job description → score, matched skills, gaps, suggested resume tweaks.
- **Analytics:** conversion funnel, response rate, applications per week, average days per stage.
- **Reminders:** "follow up after N days in Applied" badge shown in the app (email digest later).

### 4.2 Resume builder (similar to FlowCV)
- Two-panel editor: form/sections on the left, **live A4/Letter preview** on the right.
- Reorder and hide sections; theme controls (font, accent color, spacing, density, date format).
- **Templates** are React components rendering semantic HTML plus print CSS (`@page`, `break-inside: avoid`), 3–4 to start.
- **Variants:** a base resume plus a tailored copy per job (copies the Profile; edits stay in the variant).
- **PDF export:** `POST /api/resume/[id]/pdf` → Chromium loads the server-rendered print route `/print/resume/[id]?token=…` → PDF → stored in Vercel Blob by `(resumeId, version)` → served from cache until the resume changes.
- The PDF has selectable text, no images of text, and proper heading order (ATS-friendly).

### 4.3 Resume parsing
- Upload PDF/DOCX (max 5 MB, MIME type checked) → extract text (`unpdf` / `mammoth`) → Gemini `generateObject` with `ProfileSchema`.
- **Review screen** shows the parsed result side by side with the extracted text, with confidence highlights. The user accepts per section → merged into the Profile.
- The uploaded file is kept in Blob and linked to the profile.

### 4.4 Interview prep (curated question bank)
**Data:** questions are imported from your sources (docs or sites) through **one adapter per source** that converts each into a shared format:

```
Question { id, sourceId, topic, subtopic, skills[], priority: P1|P2|P3,
           frequency: 0–1, difficulty: easy|med|hard, estMinutes,
           question, answer (from source), references[] }
```

❓ If a source doesn't include priority or frequency: **AI-assisted tagging with admin review**. Only the labels come from AI; question and answer text is copied exactly.

**Matching:** job skill tags (from AI job import or entered manually) are matched against question `skills`/`topic`, using synonym normalization (e.g. "React.js" = "react").

**Plans generated per job:**
| Plan | Rule |
|---|---|
| **Crash (≤1 day)** | P1 plus the most frequent questions only. Greedy by `priorityWeight × (1+frequency) / estMinutes` within a time budget (default 6h), spread round-robin across matched topics so no topic is skipped |
| **Multi-day (N days)** | Days 1…N-1: P1 first, then P2, balanced by daily budget; last day: revise flagged ("not confident") items |
| **Full curriculum** | Every matched question, grouped by topic → subtopic |

- If `interviewAt` is set, the app suggests a plan automatically (≤1 day → Crash, else Multi-day).
- **Progress:** each question can be marked todo / done / confident / needs-revision, per user.
- **Sharing (per plan):**
  - `private`: only the owner, signed in.
  - `link`: random 32-byte token URL `/p/[token]`, read-only, `noindex`. The owner can revoke or regenerate it.
  - A signed-in visitor can **"Save to my prep"** → gets their own progress on the same plan.
- Prep pages: focus mode (one question at a time, reveal answer), keyboard navigation, timer, print view.

### 4.5 Outreach templates (AI)
- Channel presets with limits enforced in the UI and checked in the output schema:
  - Cold email (subject + body)
  - LinkedIn connection note: **200 characters (free) / 300 (Premium)**. ❓ check current limits at implementation time
  - LinkedIn InMail / DM (subject + body)
  - Follow-up email, thank-you after interview
- Inputs: Profile + job + recipient (name, role, how you found them) + tone (formal / warm / concise) + goal.
- Generates **3 versions**, each with a live character counter. Edit, save, copy, mark favorite. Placeholders like `{{recipientName}}` stay editable.

### 4.6 Application answer bank (AI + reuse)
- Paste a question from an application form (+ optional job, word limit, extra context).
- **Search saved answers first:** embed the question (Gemini embeddings, pgvector cosine similarity) → show the closest saved answers → "adapt this" or "write new".
- Drafts stream in; the user edits and saves with tags. Versions are kept; each answer links to the jobs it was used for.
- Library view: search, filter by tag, copy with one click.

### 4.7 Settings & admin
- **Settings:** profile, AI key (add / test / remove), default resume, prep daily budget, theme, delete account (removes all data).
- **Admin:** question sources (import, re-import, see differences), tag review queue, users list, AI usage by user and feature, feature flags.

---

## 5. Data model (Drizzle, Postgres)

```
users(id, name, email, emailVerified, image, role[user|admin], createdAt)
sessions / accounts / verifications           -- Better Auth tables
ai_credentials(userId PK, provider, ciphertext, iv, authTag, last4, validatedAt)
ai_usage(id, userId, feature, keySource[user|admin], inputTokens, outputTokens, createdAt)

statuses(id, userId, name, color, kind[open|won|lost], position)
jobs(id, userId, statusId, position, company, title, location, workMode[remote|hybrid|onsite],
     url, source, salaryMin, salaryMax, currency, description, skills text[],
     priority[low|med|high], appliedAt, interviewAt, matchScore jsonb, notes,
     archivedAt, createdAt, updatedAt)
job_events(id, jobId, userId, type, fromStatusId, toStatusId, payload jsonb, createdAt)
contacts(id, jobId, userId, name, role, email, linkedinUrl, notes)

profiles(userId PK, data jsonb<ProfileSchema>, updatedAt)
resumes(id, userId, jobId?, title, templateId, data jsonb, theme jsonb, version, pdfBlobUrl, updatedAt)
resume_uploads(id, userId, blobUrl, mimeType, extractedText, parsedAt)

outreach_messages(id, userId, jobId?, channel, tone, subject, body, favorite, createdAt)
answers(id, userId, question, answer, tags text[], embedding vector(768), version, parentId?, createdAt)
answer_usages(answerId, jobId)

question_sources(id, name, kind[doc|site|csv], url, license, importedAt, checksum)
questions(id, sourceId, externalId, topic, subtopic, skills text[], priority, frequency,
          difficulty, estMinutes, question, answer, references jsonb, tagStatus[source|ai_pending|reviewed])
prep_plans(id, jobId, userId, kind[crash|multiday|full], days, dailyBudgetMin,
           visibility[private|link], shareToken unique?, generatedAt)
prep_plan_items(planId, questionId, day, position)
prep_progress(userId, planId, questionId, state[todo|done|confident|revise], updatedAt)
```

Indexes: `jobs(userId, statusId, position)`, `job_events(jobId, createdAt)`, `questions using gin(skills)`, `answers using hnsw(embedding)`, `prep_plans(shareToken)`.

---

## 6. Routes

```
/                      landing (product tour, screenshots)
/login  /signup  /verify  /reset
/onboarding            name → upload resume (optional) → connect AI key (optional)

/app                   dashboard: pipeline summary, upcoming interviews, follow-ups due
/app/jobs              ?view=board|list &q= &status= &priority=
/app/jobs/[id]         detail (intercepting drawer over the board; full page on direct load)
/app/profile           canonical Profile editor + parse-from-upload
/app/resumes           list + templates
/app/resumes/[id]      builder
/app/outreach          generator + saved messages
/app/answers           answer bank
/app/prep              all prep plans
/app/prep/[planId]     prep workspace
/app/settings          account, AI key, preferences
/admin/*               sources, tag review, users, usage

/p/[token]             public prep plan (read-only)
/print/resume/[id]     print-only render target for Chromium (signed token)

/api/ai/*              streaming endpoints (outreach, answers, match, job import, parse)
/api/resume/[id]/pdf   PDF render + cache
/api/auth/*            Better Auth
```

---

## 7. UI & motion direction

- **Feel:** Linear / Raycast. Dense but calm, sharp type (Geist), dark mode treated as equal to light, subtle borders, one accent color.
- **Motion that ties screens together:** card → drawer shared layout; board ↔ list view transition; column count tick; drop with spring settle; staggered list entrance; AI text streaming with a soft shimmer.
- **Micro-interactions:** spring hover lift on cards, magnetic primary buttons, hover previews for the job link, ⌘K palette everywhere, `?` shortcut sheet.
- **States:** skeleton loaders that match the real layout, designed empty states with a single next action, toasts with undo for destructive actions.
- **Accessibility:** keyboard drag-and-drop, focus rings, `prefers-reduced-motion` respected, AA contrast in both themes.

---

## 8. Security checklist

- Every query scoped by `userId` (helpers in the data layer; no raw access from components).
- Server-side zod validation on every action and route.
- The admin app key is never used for `role !== admin`; checked inside the AI gateway, not the UI.
- User AI keys encrypted at rest, never returned to the client.
- Rate limits on AI, uploads, auth and PDF routes.
- Uploads: size and MIME checks, stored privately in Blob.
- Share tokens: 32 random bytes, revocable, `noindex`, read-only.
- The print route requires a short-lived signed token.
- Security headers (CSP, frame-ancestors) via `next.config`.

---

## 9. Phases & milestones

### Phase 0 — Foundation
- [x] Scaffold Next.js 16 + TS + Tailwind v4 + shadcn/ui (Base UI), Geist, theme tokens, dark mode
- [x] App shell: sidebar, mobile menu, ⌘K palette, toasts
- [x] Drizzle schema + migrations (PGlite locally, Neon via `DATABASE_URL`), demo seed script (`npm run db:seed`)
- [x] Better Auth (email/password; Google/GitHub when keys set), roles via `ADMIN_EMAILS`, protected `/app`. Email verification pending Resend
- [x] Lint, Prettier, Vitest unit tests, Playwright end-to-end, GitHub Actions CI

### Phase 1 — Tracker
- [x] Statuses: defaults + customization in Settings (rename, recolor, reorder, type, delete with move)
- [x] Board view with dnd-kit + optimistic moves + fractional ordering
- [x] List view with TanStack Table v9, search + view in URL
- [x] Job create/edit, detail drawer, timeline events, contacts
- [x] Dashboard + analytics (stat tiles, applications per week, stage counts, interviews, follow-ups, activity)

### Phase 2 — AI foundation + Profile
- [x] AI gateway (key resolution, AES-GCM encryption, rate limits counted in Postgres, usage log)
- [x] Settings → AI key (add / test / remove), "Connect your key" prompts
- [x] Profile schema + editor
- [x] Resume parsing (PDF/DOCX) + review screen
- [x] AI job import (paste) + match score

### Phase 3 — Resume builder
- [x] Builder editor + live preview + themes
- [x] 3 templates (Classic, Column, Compact)
- [x] PDF export via headless Chrome (local Chrome / @sparticuz/chromium on Vercel); Blob caching deferred, PDFs render on demand
- [x] Per-job variants

### Phase 4 — AI writing
- [x] Outreach generator with channel limits
- [x] Answer bank with Gemini embeddings + similarity search (in memory, no pgvector needed)

### Phase 5 — Interview prep
- [x] JSON/CSV importer + admin import UI + CLI (`npm run db:import-questions`); Markdown/site adapters once your sources are shared
- [ ] Tag review queue (rows without a priority are flagged `needs_review`; admin shows the count; AI-assisted tagging still to do)
- [x] Plan generator (Crash / Multi-day / Full) with unit tests
- [x] Prep workspace, progress, focus mode
- [x] Sharing (private / link), public page; signed-in visitors track their own progress

### Phase 6 — Polish & launch
- [ ] Accessibility + performance pass (Lighthouse ≥ 95)
- [x] Landing page, demo account with seeded data (`npm run db:seed`)
- [ ] README with architecture diagram, screenshots, decisions
- [ ] Possible later: Chrome extension to save jobs from LinkedIn and job boards; email digest of follow-ups

---

## 10. Environment variables

```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID= / GITHUB_CLIENT_SECRET=
RESEND_API_KEY=
ENCRYPTION_KEY=            # 32-byte base64, for user AI keys
ADMIN_GEMINI_API_KEY=      # app key, admin only
ADMIN_EMAILS=              # comma-separated; these get role=admin on sign-up
UPSTASH_REDIS_REST_URL= / UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=
PRINT_TOKEN_SECRET=
```

---

## 11. Open items ❓

1. Question bank sources: you'll share docs/sites. Adapter design is final once we see their format.
2. AI-assisted priority tagging when a source has none: OK?
3. Product name and domain.
4. LinkedIn character limits: check current values during Phase 4.
