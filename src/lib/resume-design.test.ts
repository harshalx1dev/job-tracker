import { describe, expect, it } from "vitest";
import { defaultDesign, normalizeDesign, switchTemplate } from "./resume";

describe("switchTemplate", () => {
  it("applies the preset the first time a template is picked", () => {
    const d = switchTemplate(defaultDesign(), "modern");
    expect(d.template).toBe("modern");
    expect(d.font).toBe("inter");
    expect(d.headerAlign).toBe("left");
  });

  it("brings back the user's tweaks when they switch back", () => {
    let d = {
      ...defaultDesign(),
      fontSize: 9.5,
      margin: 10,
      accent: "#112233",
    };
    d = switchTemplate(d, "modern");
    expect(d.fontSize).toBe(10); // modern preset, not the professional tweak
    d = switchTemplate(d, "professional");
    expect(d.fontSize).toBe(9.5);
    expect(d.margin).toBe(10);
    expect(d.accent).toBe("#112233");
  });

  it("keeps each template's own tweaks apart", () => {
    let d = switchTemplate(defaultDesign(), "modern");
    d = { ...d, fontSize: 11 };
    d = switchTemplate(d, "professional");
    d = switchTemplate(d, "modern");
    expect(d.fontSize).toBe(11);
  });

  it("keeps section order and hidden sections across switches", () => {
    const base = defaultDesign();
    const d = switchTemplate({ ...base, hidden: ["projects"] }, "modern");
    expect(d.hidden).toEqual(["projects"]);
    expect(d.order).toEqual(base.order);
  });

  it("does nothing when the template is already selected", () => {
    const d = defaultDesign();
    expect(switchTemplate(d, "professional")).toBe(d);
  });

  it("loads designs saved before this existed", () => {
    expect(normalizeDesign({ template: "modern" }).looks).toEqual({});
  });
});
