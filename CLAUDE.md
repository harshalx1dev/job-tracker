# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Trackr: a job-search workspace (Kanban/list job tracking, resume builder with PDF export, AI outreach/answers/match, interview prep from a curated question bank). `plan.md` is the full spec; `README.md` covers setup and env vars; `TESTING-GUIDE.md` is a manual feature walkthrough.

**Next.js 16 with breaking changes** (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `cacheComponents: true` is on, and the middleware file is `src/proxy.ts`. Mutations call `refresh()` from `next/cache` after writes.

## Commands

```bash
npm run dev          # runs db:migrate (predev), then next dev on :3000
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run (src/**/*.test.ts, node env)
npx vitest run src/lib/prep.test.ts   # single test file
npx vitest run -t "name"              # single test by name
npm run e2e          # Playwright (uses local Chrome, reuses running dev server)
npm run db:generate  # new migration from src/server/db/schema.ts
npm run db:migrate   # apply migrations
npm run db:seed      # demo@trackr.test / demo-pass-2026 (stop dev first)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, build, then e2e against embedded PGlite.

## Architecture

- **Layering**: `src/app` (routes, thin) → `src/features/<area>` (client UI per feature: jobs, resumes, prep, ai, profile, settings, dashboard, admin) → `src/server/<area>` (Drizzle queries + `"use server"` actions) → `src/server/db`. Pure, unit-tested logic and zod validators live in `src/lib` (`src/lib/validators/`).
- **Data access**: every query is scoped by `userId` obtained via `requireUser()` in `src/server/session.ts` (the `proxy.ts` cookie check is only optimistic routing, not authorization). Server actions return `ActionResult<T>` (`{ok:true,data}` | `{ok:false,error,fieldErrors}`), validating input with zod.
- **Database**: Drizzle + Postgres (`DATABASE_URL`, Neon) or embedded PGlite in `./.data/pglite` when unset. Migrations in `drizzle/`; schema is `src/server/db/schema.ts`. Job ordering uses fractional-indexing `position` strings; kanban moves are optimistic client-side with rollback.
- **Auth**: Better Auth (`src/server/auth.ts`, route `app/api/auth/[...all]`). Emails in `ADMIN_EMAILS` get the admin role; the admin account is bootstrapped at server start (`admin-bootstrap.ts`). Email verification only enforced once SMTP/Resend is configured; otherwise reset links print to the dev console.
- **AI**: all calls go through `src/server/ai/gateway.ts` (resolves key → provider → model, rate-limits via the `ai_usage` table, logs usage). Users bring their own Gemini key (stored encrypted with `ENCRYPTION_KEY` — never rotate it); the app's `ADMIN_GEMINI_API_KEY` is admin-only. Structured output schemas in `src/lib/ai-schemas.ts`; Vercel AI SDK + `@ai-sdk/google`. Interview-prep questions/answers come only from the imported question bank, never generated.
- **Resumes**: `features/resumes` renders the document (HTML/CSS templates, `resume.css`); PDF export (`app/api/resumes/[id]/pdf`, `server/resumes/pdf.ts`) loads the signed `/print/resume/[id]` page in puppeteer-core + @sparticuz/chromium (local: `CHROME_PATH`). Print links are signed with `PRINT_TOKEN_SECRET` (`print-token.ts`). Profile import parses PDF (unpdf) / DOCX (mammoth) then Gemini structured output.
- **Public pages**: `/p/[token]` shares prep plans without auth.
- **UI**: Tailwind v4, shadcn/ui on Base UI (`src/components/ui`), Motion, dnd-kit, TanStack Table v9, nuqs for URL state (view/filters).
- **Schema notes** (`src/server/db/schema.ts`): `profiles.data` is the canonical resume data (JSONB, type `Profile` in `src/lib/profile.ts`); `resumes` hold a snapshot of it plus a `design` JSONB, optionally tied to a `jobId`. `jobs.match` caches the last AI match result. `answers.embedding` is a 768-d Gemini embedding compared in memory (no pgvector). `prep_plans` are unique per (job, kind); `prep_progress` is per user so shared-link viewers track their own. `statuses` are per-user and seeded on sign-up (`seedDefaultStatuses`).
- **DB client** (`src/server/db/index.ts`) is a lazy Proxy so importing it during `next build` never opens a database.
- **AI model**: the user's chosen `ai_settings.draftModel` applies to every feature, falling back to `GEMINI_MODEL`/`gemini-3.5-flash`. Prompts live in `src/server/ai/features.ts` (user text goes in `<document>` tags, treated as data). Gemini gets a limit-free schema; limits are re-applied after (`src/lib/ai-schema.ts`).
- **Claude connector** (`/api/mcp`, `src/server/mcp/`): a stateless MCP endpoint (official `@modelcontextprotocol/sdk` web-standard transport). Auth is a personal access token (`mcp_tokens`, SHA-256 hash only, scopes `read`/`write`, expiry, revoke) in `Authorization: Bearer`; every tool is scoped to the token owner's `userId`, never to input. Tools go through `tool()` in `tool.ts` (scope check, call log in `mcp_calls` for the 60/min rate limit, errors → tool errors). Writes only ADD (new jobs, resume copies, drafts, answers) and never edit or delete; resume wording rules are in `src/lib/resume-wording.ts`. Claude's own job score is stored in `jobs.claude_match`, apart from `jobs.match`. Mutation logic shared with server actions lives in `src/server/jobs/service.ts` (server actions use `requireUser()`/`refresh()`, which the endpoint can't).
- **Production migrations are manual**: nothing runs `db:migrate` on deploy. Migrate production (direct `DATABASE_URL_UNPOOLED`) before deploying code that needs a new table or column. See README → Deploying.
- **Test accounts**: outside production, `*.test` emails skip email confirmation.
- **Knowledge graph**: `graphify-out/` (GRAPH_REPORT.md, graph.json, graph.html) is AST-only and may be stale; refresh with `graphify update .` after large changes.
- Local Node HTTPS errors (`self-signed certificate`) from antivirus/proxy: set `NODE_USE_SYSTEM_CA=1`.
