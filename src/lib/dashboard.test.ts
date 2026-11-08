import { describe, expect, it } from "vitest";
import {
  computeDashboard,
  weekStart,
  type DashEvent,
  type DashJob,
  type DashStatus,
} from "./dashboard";

const NOW = new Date("2026-11-05T10:00:00Z"); // a Thursday
const DAY = 86_400_000;
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);

const STATUSES: DashStatus[] = [
  { id: "wish", name: "Wishlist", color: "slate", kind: "open", position: 0 },
  { id: "app", name: "Applied", color: "sky", kind: "open", position: 1 },
  {
    id: "int",
    name: "Interviewing",
    color: "amber",
    kind: "open",
    position: 2,
  },
  { id: "off", name: "Offer", color: "emerald", kind: "won", position: 3 },
  { id: "rej", name: "Rejected", color: "rose", kind: "lost", position: 4 },
  { id: "gho", name: "Ghosted", color: "zinc", kind: "lost", position: 5 },
];

let n = 0;
function job(statusId: string, extra: Partial<DashJob> = {}): DashJob {
  n++;
  return {
    id: `j${n}`,
    company: `Co ${n}`,
    title: "Engineer",
    statusId,
    appliedAt: null,
    interviewAt: null,
    createdAt: ago(1),
    updatedAt: ago(1),
    ...extra,
  };
}

describe("weekStart", () => {
  it("returns the Monday of the week at 00:00 UTC", () => {
    expect(weekStart(NOW).toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });
  it("treats Sunday as the end of the week, not the start", () => {
    expect(weekStart(new Date("2026-11-08T23:00:00Z")).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z",
    );
  });
});

describe("computeDashboard", () => {
  it("counts active jobs and offers by stage kind", () => {
    const d = computeDashboard(
      [job("wish"), job("app"), job("int"), job("off"), job("rej")],
      STATUSES,
      [],
      NOW,
    );
    expect(d.totals.active).toBe(3);
    expect(d.totals.offers).toBe(1);
  });

  it("works out the response rate, not counting ghosted jobs as replies", () => {
    const jobs = [
      job("app"),
      job("app"),
      job("int"),
      job("rej"),
      job("gho"),
      job("wish"),
    ];
    const d = computeDashboard(jobs, STATUSES, [], NOW);
    // Sent: 2 applied + interviewing + rejected + ghosted = 5; replies: interviewing + rejected.
    expect(d.totals.sent).toBe(5);
    expect(d.totals.responded).toBe(2);
    expect(d.responseRate).toBe(40);
  });

  it("has no response rate before anything is sent", () => {
    expect(
      computeDashboard([job("wish")], STATUSES, [], NOW).responseRate,
    ).toBeNull();
  });

  it("lists follow-ups for applications quiet for a week, oldest first", () => {
    const quiet = job("app", { updatedAt: ago(10) });
    const quieter = job("app", { updatedAt: ago(20) });
    const recent = job("app", { updatedAt: ago(2) });
    const d = computeDashboard(
      [quiet, recent, quieter, job("int", { updatedAt: ago(30) })],
      STATUSES,
      [],
      NOW,
    );
    expect(d.followUps.map((j) => j.id)).toEqual([quieter.id, quiet.id]);
  });

  it("lists only future interviews, soonest first", () => {
    const later = job("int", {
      interviewAt: new Date(NOW.getTime() + 5 * DAY),
    });
    const sooner = job("int", { interviewAt: new Date(NOW.getTime() + DAY) });
    const past = job("int", { interviewAt: ago(1) });
    const d = computeDashboard([later, past, sooner], STATUSES, [], NOW);
    expect(d.upcoming.map((j) => j.id)).toEqual([sooner.id, later.id]);
  });

  it("buckets applications into the last 8 weeks, current week last", () => {
    const d = computeDashboard(
      [
        job("app", { appliedAt: ago(1) }), // this week
        job("app", { appliedAt: ago(2) }), // this week
        job("int", { appliedAt: ago(8) }), // last week
        job("app", { appliedAt: ago(120) }), // outside the window
        job("wish", { createdAt: ago(1) }), // never sent
      ],
      STATUSES,
      [],
      NOW,
    );
    expect(d.weekly).toHaveLength(8);
    expect(d.weekly.at(-1)?.count).toBe(2);
    expect(d.weekly.at(-2)?.count).toBe(1);
    expect(d.weekly.reduce((s, w) => s + w.count, 0)).toBe(3);
    expect(d.appliedThisWeek).toBe(2);
  });

  it("orders stages by position and names moves in recent activity", () => {
    const j = job("int");
    const events: DashEvent[] = [
      {
        id: "e1",
        jobId: j.id,
        type: "created",
        fromStatusId: null,
        toStatusId: "wish",
        createdAt: ago(3),
      },
      {
        id: "e2",
        jobId: j.id,
        type: "status_changed",
        fromStatusId: "app",
        toStatusId: "int",
        createdAt: ago(1),
      },
    ];
    const d = computeDashboard([j], [...STATUSES].reverse(), events, NOW);
    expect(d.stages.map((s) => s.name)).toEqual(STATUSES.map((s) => s.name));
    expect(d.activity[0]).toMatchObject({ id: "e2", to: "Interviewing" });
    expect(d.activity[0].job?.id).toBe(j.id);
  });
});
