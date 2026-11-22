/**
 * Interview prep planning: pure functions, no database. Questions come from the
 * curated bank (never generated); these only choose and order them.
 */

export type Priority = "P1" | "P2" | "P3";

export type BankQuestion = {
  id: string;
  topic: string;
  skills: string[];
  priority: Priority;
  /** 0–1: how often it's asked, from the source. */
  frequency: number;
  estMinutes: number;
  /** Optional: used to put output puzzles last and to spot repeats. */
  subtopic?: string | null;
  question?: string;
};

export type PlanKind = "crash" | "multiday" | "full";

export type PlanItem = { questionId: string; day: number; position: number };

export const PLAN_LABELS: Record<PlanKind, string> = {
  crash: "1-day crash plan",
  multiday: "Multi-day plan",
  full: "Full curriculum",
};

const SYNONYMS: Record<string, string> = {
  "react.js": "react",
  reactjs: "react",
  "react js": "react",
  nextjs: "next.js",
  next: "next.js",
  "next js": "next.js",
  node: "node.js",
  nodejs: "node.js",
  "node js": "node.js",
  js: "javascript",
  es6: "javascript",
  ecmascript: "javascript",
  ts: "typescript",
  "vue.js": "vue",
  vuejs: "vue",
  "angular.js": "angular",
  angularjs: "angular",
  postgres: "postgresql",
  k8s: "kubernetes",
  golang: "go",
  css3: "css",
  html5: "html",
  "adobe experience manager": "aem",
  "aem as a cloud service": "aem",
  aemaacs: "aem",
  "edge delivery services": "eds",
  "edge delivery": "eds",
  "aem eds": "eds",
  franklin: "eds",
  helix: "eds",
  sightly: "htl",
  scss: "sass",
  "react router": "react router",
  "react-router": "react router",
  "redux toolkit": "redux",
  rtk: "redux",
  "rest apis": "rest",
  "rest api": "rest",
  "restful apis": "rest",
  "restful api": "rest",
  "restful web services": "rest",
  a11y: "accessibility",
  wcag: "accessibility",
  "system design": "system design",
  "frontend system design": "system design",
  "front-end": "frontend",
  "front end": "frontend",
};

export function normalizeSkill(raw: string) {
  const s = raw.toLowerCase().trim().replace(/\s+/g, " ").replace(/[()]/g, "");
  return SYNONYMS[s] ?? s;
}

/** Skills a job implies without listing them (a React role is also a JavaScript role). */
const IMPLIES: Record<string, string[]> = {
  react: ["javascript", "html", "css"],
  "next.js": ["react", "javascript", "html", "css"],
  typescript: ["javascript"],
  vue: ["javascript", "html", "css"],
  angular: ["typescript", "javascript", "html", "css"],
  eds: ["aem", "javascript", "html", "css"],
  aem: ["htl"],
  frontend: ["javascript", "html", "css"],
};

/**
 * A question about one technology belongs to jobs with that technology: an AEM
 * Lighthouse question tagged "performance" shouldn't land in a React role.
 * Topics not listed here (Performance & SEO, Accessibility, System Design, ...)
 * are general and match on their skills alone.
 */
const TOPIC_GATE: Record<string, string> = {
  aem: "aem",
  eds: "eds",
  react: "react",
  "next.js": "next.js",
  javascript: "javascript",
  typescript: "typescript",
  html: "html",
  css: "css",
};

/** Technologies a posting can name inside a longer phrase ("AEM Components and Templates"). */
const KNOWN_TECH = new Set([
  ...Object.values(TOPIC_GATE),
  "jquery",
  "bootstrap",
  "htl",
  "sass",
]);

/**
 * The forms of one skill as a posting writes it: "Adobe Experience Manager (AEM)" is
 * both that name and "AEM", "JavaScript (ES6+)" is JavaScript, and "AEM Components and
 * Templates" is an AEM skill.
 */
export function skillVariants(raw: string): string[] {
  const lower = raw.toLowerCase();
  const out = new Set([normalizeSkill(raw)]);
  const inner = [...lower.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  for (const part of [lower.replace(/\([^)]*\)/g, " "), ...inner])
    out.add(normalizeSkill(part));
  for (const word of lower.split(/[^a-z0-9.+#]+/)) {
    const n = normalizeSkill(word);
    if (KNOWN_TECH.has(n)) out.add(n);
  }
  out.delete("");
  return [...out];
}

/** The job's listed skills in posting order, every form of each, without repeats. */
function listedSkills(jobSkills: string[]) {
  return [...new Set(jobSkills.flatMap(skillVariants))];
}

/** The job's skills plus everything they imply. */
export function expandSkills(jobSkills: string[]) {
  const out = new Set(listedSkills(jobSkills));
  for (let changed = true; changed;) {
    changed = false;
    for (const s of [...out])
      for (const extra of IMPLIES[s] ?? [])
        if (!out.has(extra)) {
          out.add(extra);
          changed = true;
        }
  }
  return out;
}

/** Technologies a question can be tagged with that a job must also have, even when the topic is general. */
const TAG_GATE = new Set(["aem", "eds", "react", "next.js"]);

/** Questions whose skills or topic overlap the job's skills (implied ones included). */
export function matchQuestions<Q extends BankQuestion>(
  questions: Q[],
  jobSkills: string[],
): Q[] {
  const wanted = expandSkills(jobSkills);
  if (wanted.size === 0) return [];
  return questions.filter((q) => {
    const topic = normalizeSkill(q.topic);
    const gate = TOPIC_GATE[topic];
    if (gate && !wanted.has(gate)) return false;
    // A JavaScript-topic question tagged "react" is a React question: not for a job without React.
    if (
      q.skills.some((s) => {
        const n = normalizeSkill(s);
        return TAG_GATE.has(n) && !wanted.has(n);
      })
    )
      return false;
    return (
      wanted.has(topic) || q.skills.some((s) => wanted.has(normalizeSkill(s)))
    );
  });
}

const WEIGHT: Record<Priority, number> = { P1: 3, P2: 2, P3: 1 };

/** Value of studying a question: priority, boosted by how often it's asked. */
export function valueOf(q: BankQuestion) {
  return WEIGHT[q.priority] * (1 + Math.min(1, Math.max(0, q.frequency)));
}

const byValue = (a: BankQuestion, b: BankQuestion) =>
  valueOf(b) / Math.max(1, b.estMinutes) -
    valueOf(a) / Math.max(1, a.estMinutes) || a.id.localeCompare(b.id);

const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };

/**
 * How central a question is to the job: the position of the first of the job's own
 * listed skills (posting order) that its topic or tags name. Skills only implied
 * by another one come last.
 */
function skillRank(q: BankQuestion, listed: string[]) {
  const own = [normalizeSkill(q.topic), ...q.skills.map(normalizeSkill)];
  const i = listed.findIndex((s) => own.includes(s));
  return i === -1 ? listed.length : i;
}

/** Rank of a whole topic: where the job lists it, by name ("Performance & SEO" counts for SEO). */
function topicRank(topic: string, listed: string[]) {
  const t = normalizeSkill(topic);
  const words = t.split(/[^a-z0-9.]+/);
  const i = listed.findIndex((s) => s === t || words.includes(s));
  return i === -1 ? listed.length : i;
}

const isPuzzle = (q: BankQuestion) =>
  /output/i.test(q.subtopic ?? "") || /^what logs\?/i.test(q.question ?? "");

/** The order to study in: the job's own skills first, then priority, then value per minute. Output puzzles go last in their topic. */
function studyOrder(questions: BankQuestion[], jobSkills: string[]) {
  const listed = listedSkills(jobSkills);
  const rank = new Map(questions.map((q) => [q.id, skillRank(q, listed)]));
  return [...questions].sort(
    (a, b) =>
      rank.get(a.id)! - rank.get(b.id)! ||
      Number(isPuzzle(a)) - Number(isPuzzle(b)) ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      byValue(a, b),
  );
}

const STOP = new Set(
  "the a an of in to is are what how why do does and or for on with when can you your it its be as at by from this that vs between difference explain describe".split(
    " ",
  ),
);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w)),
  );

/**
 * Drops a question that asks nearly the same thing as one already kept (the same
 * words, three quarters of them), keeping the higher-priority, more-asked one.
 * Output puzzles are never dropped: two of them differ by one line of code.
 */
export function dropRepeats<Q extends BankQuestion>(questions: Q[]): Q[] {
  const best = [...questions].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      b.frequency - a.frequency ||
      a.id.localeCompare(b.id),
  );
  const kept: { q: Q; t: Set<string> }[] = [];
  for (const q of best) {
    if (!q.question || isPuzzle(q)) {
      kept.push({ q, t: new Set() });
      continue;
    }
    const t = tokens(q.question);
    const repeat = kept.some((k) => {
      if (!k.t.size || !t.size) return false;
      let inter = 0;
      for (const w of t) if (k.t.has(w)) inter++;
      return inter / (t.size + k.t.size - inter) >= 0.75;
    });
    if (!repeat) kept.push({ q, t });
  }
  const keep = new Set(kept.map((k) => k.q.id));
  return questions.filter((q) => keep.has(q.id));
}

/** 1 day: every P1 question, the job's own skills first. */
export function buildCrash(
  matched: BankQuestion[],
  jobSkills: string[] = [],
): PlanItem[] {
  return studyOrder(
    matched.filter((q) => q.priority === "P1"),
    jobSkills,
  ).map((q, i) => ({ questionId: q.id, day: 1, position: i }));
}

/**
 * N days: every P1 question, then every P2, spread evenly by study time over days
 * 1..N-1. The last day is kept for reviewing questions marked "revise". A day is
 * never smaller than dailyBudgetMin, so a short list does not stretch over all days.
 */
export function buildMultiDay(
  matched: BankQuestion[],
  days: number,
  dailyBudgetMin = 240,
  jobSkills: string[] = [],
): PlanItem[] {
  const n = Math.min(14, Math.max(2, Math.round(days)));
  const studyDays = n - 1;
  const pool = matched.filter((q) => q.priority !== "P3");
  const ordered = [
    ...studyOrder(
      pool.filter((q) => q.priority === "P1"),
      jobSkills,
    ),
    ...studyOrder(
      pool.filter((q) => q.priority === "P2"),
      jobSkills,
    ),
  ];
  const total = ordered.reduce((sum, q) => sum + q.estMinutes, 0);
  const perDay = Math.max(dailyBudgetMin, total / studyDays);
  const items: PlanItem[] = [];
  let before = 0; // study minutes placed so far
  let day = 1;
  let position = 0;
  for (const q of ordered) {
    const d = Math.min(studyDays, Math.floor(before / perDay) + 1);
    if (d !== day) {
      day = d;
      position = 0;
    }
    items.push({ questionId: q.id, day, position: position++ });
    before += q.estMinutes;
  }
  return items;
}

/** Everything matched: the job's own skills first, each topic P1 to P3, most-asked first. */
export function buildFull(
  matched: BankQuestion[],
  jobSkills: string[] = [],
): PlanItem[] {
  const listed = listedSkills(jobSkills);
  return [...matched]
    .sort(
      (a, b) =>
        topicRank(a.topic, listed) - topicRank(b.topic, listed) ||
        normalizeSkill(a.topic).localeCompare(normalizeSkill(b.topic)) ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        Number(isPuzzle(a)) - Number(isPuzzle(b)) ||
        b.frequency - a.frequency ||
        a.id.localeCompare(b.id),
    )
    .map((q, i) => ({ questionId: q.id, day: 0, position: i }));
}

/** Which plan to suggest, from the days until the interview. */
export function suggestPlan(
  interviewAt: Date | null,
  now: Date,
): { kind: PlanKind; days: number } {
  if (!interviewAt) return { kind: "multiday", days: 3 };
  const days = Math.ceil((interviewAt.getTime() - now.getTime()) / 86_400_000);
  if (days <= 1) return { kind: "crash", days: 1 };
  return { kind: "multiday", days: Math.min(14, days) };
}

/** Rough study time when a source doesn't give one: reading + recalling the answer. */
export function estimateMinutes(answer: string) {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(45, Math.max(5, Math.round(words / 40) * 5));
}
