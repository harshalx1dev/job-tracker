import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Logo } from "@/components/logo";
import { HeroBoard } from "@/components/landing/hero-board";
import { LandingNav } from "@/components/landing/landing-nav";
import { PrepTabs } from "@/components/landing/prep-tabs";
import "./landing.css";

/*
 * Deal (taste-skill 2.5, software):
 *   palette lunar-grey-bronze · type host · radius soft · hero centred · ground topglow (hero frame)
 *   effect: none mounted (the lit CSS frame stands in) · moments: none · scene: none
 * Plan (one screen each): hero · board · resumes · ai · prep · closing
 */

export const metadata: Metadata = {
  title: { absolute: "Trackr: job tracker for software developers" },
  other: { "page-type": "software", "site-kind": "software" },
};

const ArrowIcon = () => (
  <svg className="m-arrow" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M3 8h10M9 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LIST_ROWS = [
  {
    co: "Northwind",
    role: "Senior Frontend Engineer",
    status: "Interviewing",
    dot: "#f59e0b",
    where: "Pune · Hybrid",
    pay: "INR 38–45L",
  },
  {
    co: "Lumen Labs",
    role: "React Developer",
    status: "Applied",
    dot: "#0ea5e9",
    where: "Remote",
    pay: "—",
  },
  {
    co: "Acme Cloud",
    role: "UI Platform Engineer",
    status: "Assessment",
    dot: "#14b8a6",
    where: "Bengaluru",
    pay: "INR 30–36L",
  },
  {
    co: "Halcyon",
    role: "Frontend Engineer, Design Systems",
    status: "Wishlist",
    dot: "#8f8f8f",
    where: "Remote",
    pay: "—",
  },
  {
    co: "Orbitly",
    role: "Staff Frontend Engineer",
    status: "Offer",
    dot: "#10b981",
    where: "Mumbai · On-site",
    pay: "INR 52L",
  },
  {
    co: "Brightwell",
    role: "Senior UI Engineer",
    status: "Wishlist",
    dot: "#8f8f8f",
    where: "Hyderabad",
    pay: "—",
  },
  {
    co: "Kestrel",
    role: "Frontend Engineer II",
    status: "Rejected",
    dot: "#f43f5e",
    where: "Remote",
    pay: "INR 24–28L",
  },
  {
    co: "Quillmark",
    role: "Next.js Developer",
    status: "Applied",
    dot: "#0ea5e9",
    where: "Pune · Hybrid",
    pay: "—",
  },
];

export default function Landing() {
  return (
    <div className="lp contents">
      <LandingNav />
      <main>
        {/* 1 · Hero (centred): the claim, one fact, then the board itself */}
        <section className="hero hero--left" aria-labelledby="hero-title">
          <div className="wrap">
            <div className="hero-text">
              <div className="hero__c lp-hero__c">
                <p className="lp-pill">
                  <b>Free</b> · 3 interview prep plans for every job
                </p>
                <h1 id="hero-title">Job tracker for software developers</h1>
                <p className="hero__lead lp-hero__lead">
                  Track every application on one board, tailor your resume for
                  each role and prep the questions that interview is likely to
                  ask.
                </p>
                <div className="btn-row lp-btn-row">
                  <Link href="/signup" className="lp-btn lp-btn--primary">
                    Create free account
                    <ArrowIcon />
                  </Link>
                  <a href="#board" className="lp-btn lp-btn--secondary">
                    See the board
                  </a>
                </div>
              </div>
              <div className="hero__window lp-hero__window">
                <HeroBoard />
              </div>
            </div>
          </div>
        </section>

        {/* 2 · Board and list */}
        <section id="board" aria-labelledby="board-title">
          <div className="wrap grid lp-split">
            <div className="lp-split__text">
              <h2 id="board-title">Board and list for every application</h2>
              <p className="lp-intro">
                Drag a card when a recruiter replies. Each move is saved to the
                job&rsquo;s timeline.
              </p>
            </div>
            <div className="lp-split__visual">
              <div className="frame lp-frame">
                <div className="lp-app" data-ui>
                  <div className="lp-app__bar">
                    <i />
                    <i />
                    <i />
                    <span>Jobs · List</span>
                  </div>
                  <table className="lp-table">
                    <thead>
                      <tr>
                        <th>Role</th>
                        <th>Status</th>
                        <th className="t-hide">Location</th>
                        <th className="t-hide">Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LIST_ROWS.map((r) => (
                        <tr key={r.co}>
                          <td className="t-role">
                            <b>{r.role}</b>
                            <small>{r.co}</small>
                          </td>
                          <td>
                            <span className="t-status">
                              <span
                                className="lp-dot"
                                style={{ background: r.dot }}
                              />
                              {r.status}
                            </span>
                          </td>
                          <td className="t-hide">{r.where}</td>
                          <td className="t-hide t-mono">{r.pay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 · Resumes */}
        <section id="resumes" aria-labelledby="resumes-title">
          <div className="wrap grid lp-split">
            <div className="lp-split__text">
              <h2 id="resumes-title">Resume builder with clean PDF export</h2>
              <p className="lp-intro">
                Upload your resume, fix what the parser found and export a PDF
                with real text that applicant tracking systems can read.
              </p>
            </div>
            <div className="lp-split__visual">
              <div className="frame lp-frame lp-resume" data-ui>
                <div className="lp-panel">
                  <div className="lp-panel__h">
                    Parsed from resume.pdf <span>6 sections</span>
                  </div>
                  <ul className="lp-parse" style={{ marginTop: 8 }}>
                    <li>
                      <b>Experience</b>
                      <span className="lp-ok">3 roles</span>
                    </li>
                    <li>
                      <b>Projects</b>
                      <span className="lp-ok">4 found</span>
                    </li>
                    <li>
                      <b>Skills</b>
                      <span className="lp-ok">18 found</span>
                    </li>
                    <li>
                      <b>Education</b>
                      <span className="lp-ok">1 found</span>
                    </li>
                  </ul>
                </div>
                <div className="lp-panel">
                  <div className="lp-panel__h">
                    Template <span>Column</span>
                  </div>
                  <div className="lp-swatches" aria-hidden>
                    <i aria-current="true" />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="lp-paper" aria-label="Resume preview">
                  <h4>Riya Kulkarni</h4>
                  <p className="r-sub">Senior Frontend Engineer · Pune</p>
                  <p className="r-h">Experience</p>
                  <p className="r-row">
                    Northwind Labs <span>2022 – now</span>
                  </p>
                  <ul>
                    <li>
                      Led the move of 40 screens to React Server Components
                    </li>
                    <li>
                      Cut first load by 38% with route-level code splitting
                    </li>
                  </ul>
                  <p className="r-row">
                    Brightwell <span>2019 – 2022</span>
                  </p>
                  <ul>
                    <li>Built the design system used by 6 product teams</li>
                    <li>Owned accessibility audits across checkout</li>
                  </ul>
                  <p className="r-h">Skills</p>
                  <p style={{ marginTop: 4 }}>
                    React, Next.js, TypeScript, Node.js, GraphQL, Playwright
                  </p>
                  <p className="r-h">Education</p>
                  <p className="r-row">
                    B.E. Computer Engineering <span>2019</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 · AI drafts */}
        <section id="ai" aria-labelledby="ai-title">
          <div className="wrap">
            <div className="lp-head">
              <h2 id="ai-title">AI drafts from your own resume</h2>
              <p className="lp-intro">
                Runs on your Gemini key. Every draft stays editable and saved
                for the next application.
              </p>
            </div>
            <div className="lp-cards">
              <article className="card lp-c">
                <div className="lp-c__vis" data-ui aria-hidden>
                  <div className="lp-mail">
                    <div className="lp-mail__row">
                      To <b>Hiring team, Northwind</b>
                    </div>
                    <div className="lp-mail__row">
                      Subject <b>Senior Frontend Engineer application</b>
                    </div>
                    <div className="lp-mail__body">
                      Hi Priya, I build React and Next.js apps and led our move
                      to Server Components. Your design-system role fits that
                      work.
                    </div>
                  </div>
                </div>
                <div className="lp-c__body">
                  <h3>Writes emails to recruiters</h3>
                  <p>
                    Drafted from your resume and the job description, in your
                    tone.
                  </p>
                </div>
              </article>
              <article className="card lp-c">
                <div className="lp-c__vis" data-ui aria-hidden>
                  <div className="lp-note">
                    Hi Arjun, I saw the UI Platform role at Acme Cloud. I
                    maintain a design system used by six teams and would value a
                    quick chat about how your platform team works.
                    <div className="lp-note__foot">
                      <span>Connection note</span>
                      <span className="font-mono">184 of 200 characters</span>
                    </div>
                  </div>
                </div>
                <div className="lp-c__body">
                  <h3>Fits LinkedIn notes in 200 characters</h3>
                  <p>
                    A live count keeps each connection note inside
                    LinkedIn&rsquo;s limit.
                  </p>
                </div>
              </article>
              <article className="card lp-c">
                <div className="lp-c__vis" data-ui aria-hidden>
                  <p className="lp-qa__q">
                    Tell us about a React project you are proud of.
                  </p>
                  <p className="lp-qa__a">
                    At Northwind I rebuilt checkout with server components.
                    First load dropped by 38%.
                  </p>
                  <span className="lp-qa__saved">
                    <Bookmark className="size-3" /> Saved to answer bank
                  </span>
                </div>
                <div className="lp-c__body">
                  <h3>Drafts answers to form questions</h3>
                  <p>
                    Saved answers come back the next time a form asks the same
                    thing.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* 5 · Interview prep */}
        <section id="prep" aria-labelledby="prep-title">
          <div className="wrap grid lp-split">
            <div className="lp-split__text">
              <h2 id="prep-title">Interview prep for each job</h2>
              <p className="lp-intro">
                Questions come from a curated bank, matched to the job&rsquo;s
                skills. Pick the plan that fits the days you have.
              </p>
            </div>
            <div className="lp-split__visual frame" data-ui>
              <PrepTabs />
            </div>
          </div>
        </section>
      </main>

      {/* 6 · Close and footer, one section */}
      <footer className="closing" aria-labelledby="close-title">
        <div className="wrap">
          <div className="lp-close">
            <h2 id="close-title">Start your job board</h2>
            <p className="lp-intro">
              Free to use. Add your Gemini key when you want AI drafts.
            </p>
            <div className="lp-btn-row">
              <Link href="/signup" className="lp-btn lp-btn--primary">
                Create free account
                <ArrowIcon />
              </Link>
            </div>
          </div>
          <div className="lp-dir">
            <div className="lp-dir__brand">
              <Logo className="text-[20px]" />
              <p>
                Applications, resumes, outreach and interview prep in one place.
              </p>
            </div>
            <div className="lp-dir__col">
              <h3>Product</h3>
              <ul>
                <li>
                  <a href="#board">Board</a>
                </li>
                <li>
                  <a href="#resumes">Resumes</a>
                </li>
                <li>
                  <a href="#ai">Drafts</a>
                </li>
                <li>
                  <a href="#prep">Prep</a>
                </li>
              </ul>
            </div>
            <div className="lp-dir__col">
              <h3>Account</h3>
              <ul>
                <li>
                  <Link href="/login">Sign in</Link>
                </li>
                <li>
                  <Link href="/signup">Create free account</Link>
                </li>
              </ul>
            </div>
            <p className="lp-legal">Trackr © 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
