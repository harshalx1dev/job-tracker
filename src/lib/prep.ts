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
  "system design": "system design",
  "frontend system design": "system design",
  "front-end": "frontend",
  "front end": "frontend",
};

export function normalizeSkill(raw: string) {
  const s = raw.toLowerCase().trim().replace(/\s+/g, " ").replace(/[()]/g, "");
  return SYNONYMS[s] ?? s;
}

/** Questions whose skills or topic overlap the job's skills. */
export function matchQuestions<Q extends BankQuestion>(
  questions: Q[],
  jobSkills: string[],
): Q[] {
  const wanted = new Set(jobSkills.map(normalizeSkill).filter(Boolean));
  if (wanted.size === 0) return [];
  return questions.filter(
    (q) =>
      q.skills.some((s) => wanted.has(normalizeSkill(s))) ||
      wanted.has(normalizeSkill(q.topic)),
  );
}

const WEIGHT: Record<Priority, number> = { P1: 3, P2: 2, P3: 1 };

/** Value of studying a question: priority, boosted by how often it's asked. */
export function valueOf(q: BankQuestion) {
  return WEIGHT[q.priority] * (1 + Math.min(1, Math.max(0, q.frequency)));
}

const byValue = (a: BankQuestion, b: BankQuestion) =>
  valueOf(b) / Math.max(1, b.estMinutes) -
    valueOf(a) / Math.max(1, a.estMinutes) || a.id.localeCompare(b.id);

/**
 * Picks within a budget, taking topics in turn so a short plan never spends all its
 * time on one topic. Each topic's queue is ordered by value per minute.
 */
function roundRobin(pool: BankQuestion[], budgetMin: number) {
  const topics = new Map<string, BankQuestion[]>();
  for (const q of [...pool].sort(byValue)) {
    const key = normalizeSkill(q.topic);
    topics.set(key, [...(topics.get(key) ?? []), q]);
  }
  // Topics with the most valuable first question go first.
  const queues = [...topics.values()].sort((a, b) => byValue(a[0], b[0]));
  const picked: BankQuestion[] = [];
  let used = 0;
  let progress = true;
  while (progress) {
    progress = false;
    for (const queue of queues) {
      const i = queue.findIndex((q) => used + q.estMinutes <= budgetMin);
      if (i === -1) continue;
      const [q] = queue.splice(i, 1);
      picked.push(q);
      used += q.estMinutes;
      progress = true;
    }
  }
  return { picked, used };
}

/** 1 day: P1 and the most-asked P2s only, inside the budget. */
export function buildCrash(
  matched: BankQuestion[],
  budgetMin = 360,
): PlanItem[] {
  const pool = matched.filter(
    (q) => q.priority === "P1" || (q.priority === "P2" && q.frequency >= 0.7),
  );
  const { picked } = roundRobin(pool, budgetMin);
  return picked.map((q, i) => ({ questionId: q.id, day: 1, position: i }));
}

/**
 * N days: P1 first, then P2, each day filled to its budget. The last day is kept
 * for reviewing questions marked "revise", so content goes on days 1..N-1.
 */
export function buildMultiDay(
  matched: BankQuestion[],
  days: number,
  dailyBudgetMin = 240,
): PlanItem[] {
  const n = Math.min(14, Math.max(2, Math.round(days)));
  const studyDays = n - 1;
  const ordered = [
    ...matched.filter((q) => q.priority === "P1").sort(byValue),
    ...matched.filter((q) => q.priority === "P2").sort(byValue),
  ];
  const items: PlanItem[] = [];
  let day = 1;
  let used = 0;
  let position = 0;
  for (const q of ordered) {
    if (used + q.estMinutes > dailyBudgetMin) {
      if (day === studyDays) continue; // last study day full: try smaller ones
      day += 1;
      used = 0;
      position = 0;
    }
    if (used + q.estMinutes > dailyBudgetMin) continue;
    items.push({ questionId: q.id, day, position: position++ });
    used += q.estMinutes;
  }
  return items;
}

/** Everything matched, grouped by topic, most important first within each. */
export function buildFull(matched: BankQuestion[]): PlanItem[] {
  return [...matched]
    .sort(
      (a, b) =>
        normalizeSkill(a.topic).localeCompare(normalizeSkill(b.topic)) ||
        WEIGHT[b.priority] - WEIGHT[a.priority] ||
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
