import { describe, expect, it } from "vitest";
import {
  buildApplicationSummary,
  type SummaryItem,
} from "./application-summary";

const item = (over: Partial<SummaryItem>): SummaryItem => ({
  company: "Acme",
  title: "Frontend Developer",
  location: "Mumbai",
  workMode: "hybrid",
  description: "Build   React\nUIs.",
  outcome: "applied",
  platform: "Company site",
  failureReason: null,
  link: "https://trackr.test/app/jobs?job=1",
  ...over,
});

describe("buildApplicationSummary", () => {
  it("splits applied from jobs that need the user", () => {
    const { subject, text } = buildApplicationSummary({
      items: [
        item({}),
        item({
          company: "Beta",
          outcome: "failed",
          failureReason: "CAPTCHA",
          link: "https://trackr.test/app/jobs?job=2",
        }),
      ],
      intro: "Done for today.",
    });
    expect(subject).toBe("Trackr: 1 applied, 1 need you");
    expect(text).toContain("Done for today.");
    expect(text).toContain("Applied (1)");
    expect(text).toContain("Could not apply (1)");
    expect(text).toContain("Reason: CAPTCHA");
    expect(text).toContain("Build React UIs.");
    expect(text).toContain("job=2");
  });

  it("lists prepared jobs as ready for the user to apply", () => {
    const { subject, text } = buildApplicationSummary({
      items: [item({ outcome: "prepared" })],
    });
    expect(subject).toBe("Trackr: 1 ready to apply");
    expect(text).toContain("Ready for you to apply (1)");
    expect(text).not.toContain("Applied (");
  });

  it("omits the stuck section when everything went through", () => {
    const { subject, text } = buildApplicationSummary({ items: [item({})] });
    expect(subject).toBe("Trackr: 1 applied");
    expect(text).not.toContain("Could not apply");
  });
});
