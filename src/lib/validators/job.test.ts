import { describe, expect, it } from "vitest";
import { jobInputSchema, moveJobSchema } from "./job";

const base = {
  company: "Northwind",
  title: "Frontend Engineer",
  statusId: "s1",
};

describe("jobInputSchema", () => {
  it("accepts the minimum and fills defaults", () => {
    const r = jobInputSchema.parse(base);
    expect(r).toMatchObject({ ...base, priority: "medium", skills: [] });
  });

  it("trims text and turns blank optional fields into undefined", () => {
    const r = jobInputSchema.parse({
      ...base,
      company: "  Northwind ",
      location: "   ",
      url: "",
    });
    expect(r.company).toBe("Northwind");
    expect(r.location).toBeUndefined();
    expect(r.url).toBeUndefined();
  });

  it("requires company and role", () => {
    const r = jobInputSchema.safeParse({ ...base, company: " ", title: "" });
    expect(r.success).toBe(false);
    const fields = r.error?.flatten().fieldErrors;
    expect(fields?.company).toBeDefined();
    expect(fields?.title).toBeDefined();
  });

  it("rejects an invalid posting URL", () => {
    expect(
      jobInputSchema.safeParse({ ...base, url: "not a url" }).success,
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...base, url: "https://jobs.example/1" })
        .success,
    ).toBe(true);
  });

  it("coerces salary and dates from form strings", () => {
    const r = jobInputSchema.parse({
      ...base,
      salaryMin: "3000000",
      appliedAt: "2026-11-01",
    });
    expect(r.salaryMin).toBe(3_000_000);
    expect(r.appliedAt).toBeInstanceOf(Date);
  });

  it("rejects negative salary", () => {
    expect(jobInputSchema.safeParse({ ...base, salaryMin: -1 }).success).toBe(
      false,
    );
  });
});

describe("moveJobSchema", () => {
  it("accepts edges of a column as null neighbours", () => {
    expect(
      moveJobSchema.safeParse({
        jobId: "j1",
        toStatusId: "s2",
        beforeId: null,
        afterId: null,
      }).success,
    ).toBe(true);
  });
});
