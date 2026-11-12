# Trackr: feature testing guide

A walk through every feature, in the order that builds on itself: your resume first, then jobs, then
everything that uses them. Tick the boxes as you go. Each step says what you should see; if you see
something else, note the step number.

**Before you start**

- Run `npm run dev` and open http://localhost:3000.
- You're on the **Neon dev branch** (`DATABASE_URL` in `.env.local`). It also holds a demo account
  (`demo@trackr.test` / `demo-pass-2026`) with sample data, if you want to compare with a filled-in account.
- Have ready: your resume as **PDF or Word (.docx)**, 2 or 3 real job postings (copy the full text),
  and a second email address you can open (for the sign-up test).
- Gemini's free tier allows only a few requests a minute. If you see *"Gemini's rate limit for this
  key was reached"*, wait a minute and retry; that's Google's limit, not a bug.

---

## 1. Accounts

### 1.1 Sign in as admin
- [ ] Open http://localhost:3000 → **Sign in** → `harshalx1.dev@gmail.com` + your `ADMIN_PASSWORD`.
  - You land on **Dashboard**, mostly empty (your account has no jobs yet).
- [ ] Open the menu on your name (bottom of the sidebar) → it shows **Admin** and an **Admin** item.

### 1.2 Forgot password (sends a real email)
- [ ] Sign out → **Sign in** → **Forgot password?** → enter `harshalx1.dev@gmail.com` → **Send reset link**.
  - Page says *"Check your inbox"*. An email "Reset your Trackr password" arrives (check spam the first time).
- [ ] Open the link → choose a new password twice → **Save new password**.
  - You're back on sign-in with *"Password changed"*. The new password works.
- [ ] Open the same email link again → *"This link has expired or was already used"*.
- [ ] Note: on the next server restart, your password is set back to `ADMIN_PASSWORD` from `.env.local`.
  To keep the new one, put it in `.env.local` too.

### 1.3 Sign up with email confirmation (second email)
- [ ] Sign out → **Create account** with your second email.
  - Instead of the app you see *"Check your inbox"*; a "Confirm your email" email arrives.
- [ ] Try to sign in before confirming → *"Confirm your email first"*.
- [ ] Click the email link → you're signed in. This account is a normal user (no Admin item).
- [ ] Sign out and continue as admin.

---

## 2. Settings (sidebar → Settings)

### 2.1 AI key
- [ ] As admin, the AI key card says *"Using the app's key (admins only)"* with today's usage.
  - Other users see a form: paste a Gemini key → **Test and save**. A wrong key shows
    *"Gemini rejected this API key"*; a good one shows *"Gemini key connected •••• 1234"*.

### 2.1b AI model
- [ ] **AI model** lists only the Gemini text models your key offers (Pro, Flash, Flash-Lite).
- [ ] Pick a Pro model on a free key → *"Your key can't use …"*; it's then greyed out as
  *not available on your key*.
- [ ] Pick a Flash model → *"Checking … with your key"*, then *"AI features now use …"*. Every AI
  feature uses it (parsing, import, match, outreach, answers). Default is `gemini-3.6-flash`.
- [ ] Replacing or removing the key resets the choice to **Default**.

### 2.2 Pipeline stages
- [ ] Rename a stage (click its name, type, Enter) → the board column renames.
- [ ] Click a stage's dot → pick a colour.
- [ ] Drag a stage by its handle to reorder → the board columns follow.
- [ ] **Add stage** → "New stage" appears. Delete it with the bin icon.
- [ ] Delete a stage that has jobs → it asks where to move them (defaults to a stage of the same type).

### 2.3 Delete account
- [ ] Only try this on the **second account** from 1.3: type its email to confirm → everything is gone
  and you're signed out.

---

## 3. Profile (sidebar → Profile): uses your resume

### 3.1 Parse your resume
- [ ] Drop your PDF/DOCX on **"Fill your profile from your resume"** (or **Choose file**).
  - It reads for a few seconds, then **"Review what was found"** opens.
- [ ] Check each section: name and contact, summary, every role with dates and bullets, projects,
  skills (grouped), education, certifications. Untick anything that looks wrong → **Use N sections**.
- [ ] The editor fills in. Correct anything the parser missed → **Save profile** (the bar at the bottom).
- [ ] Fill **Extra context** (notice period, preferred roles, what you're proud of): the AI uses it
  for outreach and answers, but it never appears on a resume.

> Things to note: wrong dates, merged roles, missing bullets, skills in odd groups. That tells us how
> well parsing handles your resume's layout.

---

## 4. Jobs (sidebar → Jobs)

### 4.1 Add a job with AI import
- [ ] **Add job** (or press `N`) → **"Paste a job description and fill these fields with AI"** →
  paste a real posting → **Fill with AI**.
  - Company, role, location, work mode, salary (only if the posting states one) and skills fill in.
    The full posting is kept in Job description.
- [ ] Fix anything wrong → **Add job**. It appears at the top of its column.
- [ ] Add 2 more jobs (one by hand without AI, to compare).

### 4.2 Board
- [ ] Drag a card to another column → it moves smoothly, a toast says *"Moved to …"*.
- [ ] Drag within a column to reorder; drag into an empty column.
- [ ] Reload the page → everything stays where you put it.
- [ ] Keyboard: Tab to a card, **Space** to pick it up, arrow keys to move, **Space** to drop.
- [ ] Move one to **Offer** → a congratulations toast.

### 4.3 List view and search
- [ ] Switch **Board / List** → table with sortable columns. Change a status from the dropdown in a row.
- [ ] Search box: filter by company, role or skill.

### 4.4 Job drawer (click a card)
- [ ] Details, priority, skills, the posting text, and a **Timeline** of everything that happened.
- [ ] **Edit**: change the interview date to tomorrow → the card shows an interview badge.
- [ ] **Contacts** → **Add contact** (name, role, email, LinkedIn) → mail and LinkedIn shortcuts appear.
- [ ] **Archive** → the job disappears with an **Undo** toast; Undo brings it back.
- [ ] **Delete** asks for confirmation.

### 4.5 Match score (needs your profile from step 3)
- [ ] In the drawer → **Fit with your profile** → **Check my fit**.
  - A score out of 100, a one-line verdict, what you have, what's not shown, and resume edits.
- [ ] Judge it: does the score feel fair? Are the "not shown" items really missing from your resume?

### 4.6 Shortcuts
- [ ] `Ctrl K` opens the command menu (go to pages, add a job, toggle theme).

---

## 5. Dashboard (sidebar → Dashboard)

- [ ] Tiles: active applications, sent this week, response rate, offers.
- [ ] **Applications per week** and **Jobs in each stage** charts; hover a bar for its value;
  **Show as table** under each.
- [ ] **Upcoming interviews** shows the job you gave a date in 4.4; click it to open that job.
- [ ] **Follow-ups due** lists jobs in Applied with no update for 7+ days (new jobs won't show yet).
- [ ] **Recent activity** lists your moves and edits.

---

## 6. Resumes (sidebar → Resumes)

- [ ] **New resume** → it starts as a copy of your profile and opens the builder.
- [ ] **Content** tab: edit text; the A4 preview on the right updates; *Saved* appears top right.
- [ ] **Design** tab: try **Classic / Column / Compact**, accents, Serif/Sans, Roomy/Tight;
  reorder and hide sections with the arrows and eye icons.
- [ ] **Download PDF** (takes a few seconds the first time) → open it: one page if it fits, text is
  selectable (try copying a line), links and dates look right.
- [ ] **Tailor for a job** (on the Resumes page) → pick a job you ran *Check my fit* on → the builder
  shows that job's suggestions beside the editor.
- [ ] **From profile** replaces the content with your current profile (design stays).
- [ ] On the Resumes page, the **⋯** menu on a card: **Duplicate**, **Delete**.

---

## 7. Outreach (sidebar → Outreach)

- [ ] Pick **Cold email**, tone **Warm**, a job, recipient name and role, and what you want
  (e.g. "a referral for this role") → **Write 3 drafts**.
  - Three drafts with different angles; each shows a live `characters / limit` counter.
- [ ] Try **LinkedIn connection note** → drafts stay under 200 characters (tick *Premium* for 300).
- [ ] Edit a draft → **Copy** → **Save**. It appears under **Saved messages**; star it, filter by channel.
- [ ] Judge it: does it sound like you? Any invented facts? (It should only use your profile.)

---

## 8. Answer bank (sidebar → Answer bank)

- [ ] Paste a real application question (e.g. *"Why do you want to join us?"*), pick the job, set a
  word limit → **Draft with AI** → the answer appears with a word counter.
- [ ] Edit it, add tags → **Save to answer bank**.
- [ ] Type a similar question (e.g. *"What attracts you to this company?"*) → **Find similar answers**.
  - Your saved answer shows with a % similarity → **Adapt this one** → **Adapt chosen answer**.
- [ ] Library: search, filter by tag, copy, edit, delete.

---

## 9. Interview prep (job drawer → Interview prep; sidebar → Interview prep)

> The bank holds **your 673 questions** (JavaScript, React, AEM, CSS, EDS, HTML, Performance & SEO,
> Next.js, REST & Auth, TypeScript, Accessibility, System Design, Behavioral), merged from the
> knowledge-base repo, dev-docs and your Word notes. The file is `data/private/question-bank.json`
> (git-ignored: this repo is public). Plans built before the import are empty: open the job and
> **Rebuild from current skills**.

- [ ] Open a job whose skills include e.g. React, JavaScript or TypeScript → **Interview prep** →
  **Build prep plans** → *"N questions matched this job"*.
  - Three plans: **1-day crash plan**, **N-day plan** (from the interview date; 3 days if none),
    **Full curriculum**, with one marked *Suggested*.
- [ ] Open a plan: questions grouped by day/topic; click one to reveal the answer;
  mark **Done / Confident / Revise**; the progress bar moves.
- [ ] **Focus mode**: one question at a time. `Space` reveals, `1` `2` `3` mark, `←` `→` move, `Esc` closes.
- [ ] **Anyone with link** → the link is copied. Open it in a private window:
  read-only, *"Sign in to track your progress"*. Signed in as the second account, progress is its own.
- [ ] Switch back to **Private** → the link stops working.

---

## 10. Admin (name menu → Admin)

### 10.1 Overview
- [ ] Users count, new this week, AI calls this week (by feature: parse, import, match, outreach,
  answer, embed), failures and tokens.

### 10.2 Question bank (when you have your sources)
- [ ] **Import** a `.json` or `.csv` file → *"N imported"*. Rows without a priority become P2 and count
  under *Questions to review*.
- [ ] Format: see `src/lib/question-import.ts` (or the sample `data/sample-question-bank.json`).
  CSV columns: `id, topic, subtopic, skills, priority, frequency, difficulty, minutes, question, answer, references`
  (skills and references separated by `;`).
- [ ] Re-import the same file → counts stay the same (it updates instead of duplicating).
- [ ] Rebuild a job's prep plans (*Rebuild from current skills*) to pick up the new questions.

---

## 11. Look and feel

- [ ] **Theme lab** (round palette button, bottom right): try the 7 accents × 3 backgrounds × light/dark,
  on the board, a resume and the landing page. Tell Claude which one to make permanent.
- [ ] **Landing page** (sign out, open http://localhost:3000): the hero board animates; pause button
  bottom-right of it; sections scroll one screen each.
- [ ] Phone size (browser dev tools, ~390 px wide): sidebar becomes a menu; board scrolls sideways.

---

## What to send back

For anything off, a line with the **step number, what you did, what you expected, what you saw**
(a screenshot helps). Especially useful:

1. Resume parsing mistakes (3.1): which section, what was wrong.
2. Match scores (4.5) that feel unfair.
3. AI writing (7, 8) that sounds unlike you or invents things.
4. The theme you want (11).
