# Trackr (working title)

A job search workspace: track applications on a Kanban board or list, build ATS-friendly resumes, draft outreach with AI and prep for interviews from a curated question bank. See [plan.md](plan.md) for the full spec and roadmap.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Motion · dnd-kit · TanStack Table v9 · Drizzle ORM · Postgres (Neon) / PGlite · Better Auth

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the secrets and admin details
npm run dev                  # applies migrations first, then starts on :3000
```

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
| `GEMINI_MODEL` | Gemini model id (default `gemini-flash-latest`). [Models](https://ai.google.dev/gemini-api/docs/models) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Sign in with Google". Callback: `<BETTER_AUTH_URL>/api/auth/callback/google`. [Console](https://console.cloud.google.com/apis/credentials) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | "Sign in with GitHub". Callback: `<BETTER_AUTH_URL>/api/auth/callback/github`. [OAuth apps](https://github.com/settings/developers) |
| `PRINT_TOKEN_SECRET` | Signs PDF print links (defaults to `BETTER_AUTH_SECRET`) |
| `CHROME_PATH` | Chrome/Edge for local PDF export, if not in the default location |
| `NEXT_PUBLIC_THEME_LAB=off` | Hides the theme trial button |
| `SMTP_HOST`, `SMTP_PORT` | Another SMTP provider (defaults: `smtp.gmail.com`, `465`) |
| `RESEND_API_KEY` | Send through [Resend](https://resend.com) instead of SMTP; needs a [verified domain](https://resend.com/domains) to email anyone |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Migrate, then start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
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
  app/               routes: landing, (auth), app/jobs, api/auth
  components/        shell, providers, shadcn/ui primitives
  features/jobs/     board, list, card, form, drawer, workspace
  lib/               validators (zod), status colors, auth client
  server/            db (schema + client), auth, session (data access), jobs (queries + actions)
  proxy.ts           optimistic auth redirect (Next 16's middleware)
```

Admins: emails listed in `ADMIN_EMAILS` get `role=admin` on sign-up. Only admins may use the app's own Gemini key.
