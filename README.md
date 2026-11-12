# Trackr (working title)

A job search workspace: track applications on a Kanban board or list, keep one structured profile, build ATS-friendly resumes, draft outreach and answers with AI, and prep for interviews from a curated question bank. See [plan.md](plan.md) for the full spec and roadmap.

## Features

AI features use each user's **own Gemini key** (saved encrypted); the app's key is admin-only. Interview prep questions and answers are never AI-generated.

- **Dashboard**: pipeline analytics (applications per week, jobs per stage).
- **Jobs**: Kanban board (drag to move) or sortable list, your own statuses, a detail drawer with contacts and history, AI import from a pasted job description, and an AI match score against your profile.
- **Profile**: one structured profile that every AI feature reads. Upload a PDF or Word resume and an AI parses it (keeping bold, italics and links); you review each section before it is applied. Summary, experience and projects use a rich text editor (bold, italic, links, real bullets, sub-headings for projects under a role).
- **Questions for you** (on the Profile page): the AI asks specific questions about gaps in your background. Answer each, or mark it Not relevant or No idea. Your answers are added to the context every AI feature uses.
- **Resumes**: built from your profile, two templates (Professional, Modern), design controls (font, size, spacing, margins, header, accent colours), Fit to one page, autosave that can be switched off (with Save and Discard), optional tailoring to a job, and real-text PDF export that ATS systems can read.
- **Outreach**: AI drafts of emails and LinkedIn notes in chosen tones, saved and favouritable.
- **Answer bank**: reusable answers to application questions, AI drafting, and "find similar" search.
- **Interview prep**: plans per job (1-day crash, multi-day, full) built from the curated question bank, progress tracking, and read-only share links.
- **Claude connector** (Settings): create a personal access token and add Trackr to Claude as a custom connector (`/api/mcp`, a remote MCP server). Claude can then read your profile, jobs and answer bank, and add job leads, resume versions, outreach drafts and answers. It never uses an AI key of yours, never edits or deletes what you already have, and only changes wording on resume copies, never facts. Tokens are shown once, stored hashed, scoped read-only or read and write, expire (90 days by default) and can be revoked. In Claude: Customize → Connectors → Add custom connector, URL `<your site>/api/mcp`, Authentication **No sign-in**, and under **Request headers** add `authorization` with the value `Bearer <token>` (request headers is a beta feature that may not be available on every plan).
- **Settings**: your Gemini key and model, statuses, account deletion. **Admin**: question bank import.
- **Ctrl+K** opens a command palette for navigation and quick actions.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Motion · dnd-kit · TanStack Table v9 · Drizzle ORM · Postgres (Neon) / PGlite · Better Auth

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the secrets and admin details
npm run dev                  # applies migrations first, then starts on :3000
```

At minimum set `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` (generation commands are in `.env.example`). Never change `ENCRYPTION_KEY` once users have saved AI keys, or they will have to enter them again.

With no `DATABASE_URL`, the app uses an embedded PGlite database in `./.data/pglite`, so no Postgres install is needed. Set `DATABASE_URL` to a Neon (or any Postgres) URL for production.

### Question bank

`data/sample-question-bank.json` is a placeholder for demos (`npm run db:seed` imports it). Replace it with your own
sources via **Admin → Question bank** or `npm run db:import-questions -- your-file.csv`. Re-importing a source updates
it in place.

### AI features

Add your Gemini key in **Settings → AI key** (free: https://aistudio.google.com/app/apikey), or put it in
`ADMIN_GEMINI_API_KEY` and sign up with an email listed in `ADMIN_EMAILS`. Every vendor and key is listed with its
signup URL at the top of [`.env.example`](.env.example).

**"Couldn't reach Gemini" / `self-signed certificate in certificate chain`** (also affects sending email): antivirus or a corporate proxy is
inspecting HTTPS. Tell Node to trust the Windows certificate store, then restart `npm run dev`:

```bash
setx NODE_USE_SYSTEM_CA 1
```

### Admin account

Set `ADMIN_EMAILS` and `ADMIN_PASSWORD` in `.env.local`. On every server start the first address
is created as an admin with that password (or its password is updated if you changed it); any
other listed addresses get the admin role when they sign up.

### Forgot password

"Forgot password?" on the sign-in page emails a one-hour reset link. Email goes out through
Gmail SMTP (`SMTP_USER`, `SMTP_PASS` = a [Gmail app password](https://myaccount.google.com/apppasswords),
`EMAIL_FROM`). Once email is configured, new accounts must also confirm their email. Without it,
locally the links are printed in the dev server console.

Gmail allows about 500 emails a day, which is plenty here. For a custom domain later, set
`RESEND_API_KEY` instead (see Optional settings).

### Demo data

`npm run db:seed` (with the dev server stopped) creates `demo@trackr.test` / `demo-pass-2026`
with sample jobs, a profile, a resume and prep plans. Local use only.

### Optional settings

Add these to `.env.local` (or Vercel) only if you need them:

| Variable | What it does |
|---|---|
| `GEMINI_MODEL` | Fallback Gemini model id for users who haven't picked one in Settings (default `gemini-3.5-flash`). [Models](https://ai.google.dev/gemini-api/docs/models) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Sign in with Google". Callback: `<BETTER_AUTH_URL>/api/auth/callback/google`. [Console](https://console.cloud.google.com/apis/credentials) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | "Sign in with GitHub". Callback: `<BETTER_AUTH_URL>/api/auth/callback/github`. [OAuth apps](https://github.com/settings/developers) |
| `PRINT_TOKEN_SECRET` | Signs PDF print links (defaults to `BETTER_AUTH_SECRET`) |
| `CHROME_PATH` | Chrome/Edge for local PDF export, if not in the default location |
| `NEXT_PUBLIC_THEME_LAB=off` | Hides the theme trial button |
| `SMTP_HOST`, `SMTP_PORT` | Another SMTP provider (defaults: `smtp.gmail.com`, `465`) |
| `RESEND_API_KEY` | Send through [Resend](https://resend.com) instead of SMTP; needs a [verified domain](https://resend.com/domains) to email anyone |

## Deploying (Vercel + Neon)

Set the environment variables from `.env.example` in Vercel (Settings → Environment Variables), with `DATABASE_URL` set to your Neon pooled URL.

**Migrations are not run on deploy.** `npm run build` is a plain `next build`, and `npm run dev` only migrates the database in your `.env.local`. Whenever a new `drizzle/NNNN_*.sql` file is added, apply it to production yourself, using the **direct (unpooled)** connection string:

```powershell
$env:DATABASE_URL_UNPOOLED = "<production direct connection string>"   # plain quotes, not curly ones
npm run db:migrate
Remove-Item Env:DATABASE_URL_UNPOOLED
```

(bash: `DATABASE_URL_UNPOOLED="<url>" npm run db:migrate`.) Migrate first, then deploy: code that uses a new table fails until it exists, and code that reads a new column of an existing table (for example `jobs.claude_match`) breaks the pages that read that table. Migrations only add things, so they are safe to run before the new code is live. Take a Neon backup branch first.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Migrate, then start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run db:generate` | Generate a migration from `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Demo data for the demo account (stop `dev` first) |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright; uses your Chrome, reuses a running dev server) |
| `npm run db:import-questions -- <file>` | Import a question bank (JSON or CSV; format in `src/lib/question-import.ts`) |

## Project layout

```
src/
  app/               routes: landing, (auth), app/* (dashboard, jobs, profile, resumes, outreach,
                     answers, prep, settings, admin), api/auth, api/resumes/[id]/pdf,
                     print/resume (PDF source), p/[token] (shared prep plans)
  components/        app shell, providers, shadcn/ui primitives
  features/          UI by area: jobs, profile (incl. rich editor, questions), resumes, ai, prep,
                     dashboard, settings, admin
  lib/               pure, unit-tested logic and zod schemas (profile, resume design, rich text,
                     prep planning, question import, AI limits and schemas)
  server/            data access and server actions by area: db (schema + client), auth,
                     session, ai (gateway, features, limits), jobs, profile, resumes, prep
  proxy.ts           optimistic auth redirect (Next 16's middleware)
drizzle/             SQL migrations (generate with `npm run db:generate`)
scripts/             migrate, seed, question import
```

Every query is scoped to the signed-in user (`requireUser()` in `src/server/session.ts`); `proxy.ts` only does optimistic routing.

Admins: emails listed in `ADMIN_EMAILS` get `role=admin` on sign-up. Only admins may use the app's own Gemini key.
