import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clampToSchema, stripLimits } from "./ai-schema";
import { profileSchema } from "./profile";

const schema = z.object({
  name: z.string().max(5),
  tags: z.array(z.string().max(3)).max(2),
});
const full = z.toJSONSchema(schema, { target: "draft-7" });

describe("stripLimits", () => {
  it("removes every length constraint, keeping structure and descriptions", () => {
    const stripped = JSON.stringify(
      stripLimits(z.toJSONSchema(profileSchema, { target: "draft-7" })),
    );
    expect(stripped).not.toMatch(/maxLength|maxItems|\$schema/);
    expect(stripped).toContain('"required"');
    expect(stripped).toContain('"description"');
  });

  it("does not treat a property named like a keyword as a keyword", () => {
    const s = z.object({ format: z.string(), pattern: z.string() });
    const props = (
      stripLimits(z.toJSONSchema(s, { target: "draft-7" })) as {
        properties: object;
      }
    ).properties;
    expect(Object.keys(props)).toEqual(["format", "pattern"]);
  });
});

describe("clampToSchema", () => {
  it("trims long strings and lists to the limits instead of failing", () => {
    const value = { name: "Alexandra", tags: ["react", "ts", "css"] };
    const clamped = clampToSchema(value, full);
    expect(clamped).toEqual({ name: "Alexa", tags: ["rea", "ts"] });
    expect(schema.safeParse(clamped).success).toBe(true);
  });

  it("leaves values within the limits untouched", () => {
    const value = { name: "Ana", tags: ["js"] };
    expect(clampToSchema(value, full)).toEqual(value);
  });
});
