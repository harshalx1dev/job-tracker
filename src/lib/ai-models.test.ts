import { describe, expect, it } from "vitest";
import {
  classifyModelError,
  prefersDefaultTemperature,
  isDraftModelId,
  pickDraftModels,
} from "./ai-models";

const gen = ["generateContent", "countTokens"];

describe("isDraftModelId", () => {
  it("accepts Gemini text models", () => {
    for (const id of [
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-flash-lite-latest",
      "gemini-2.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-4-hydrogen",
    ])
      expect(isDraftModelId(id), id).toBe(true);
  });

  it("rejects speech, image, agent and other special models", () => {
    for (const id of [
      "gemini-2.5-flash-preview-tts",
      "gemini-2.5-flash-image",
      "gemini-3.1-pro-preview-customtools",
      "gemini-2.5-computer-use-preview-10-2025",
      "gemini-robotics-er-2-preview",
      "gemini-3.5-transcribe",
      "gemini-omni-1.2-flash",
      "gemini-embedding-001",
      "gemma-4-31b-it",
      "gemini-3.5-flash-latest",
      "gemini-flash",
    ])
      expect(isDraftModelId(id), id).toBe(false);
  });
});

describe("pickDraftModels", () => {
  it("keeps draft models only, newest first, latest aliases on top", () => {
    const picked = pickDraftModels([
      {
        name: "models/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        supportedGenerationMethods: gen,
      },
      {
        name: "models/gemini-2.5-flash-preview-tts",
        supportedGenerationMethods: gen,
      },
      {
        name: "models/gemini-3.1-pro-preview",
        displayName: "Gemini 3.1 Pro Preview",
        supportedGenerationMethods: gen,
      },
      { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: gen },
      { name: "models/gemini-3.5-flash", supportedGenerationMethods: gen },
      { name: "models/gemini-flash-latest", supportedGenerationMethods: gen },
      {
        name: "models/gemini-embedding-001",
        supportedGenerationMethods: ["embedContent"],
      },
      {
        name: "models/gemini-3.6-flash",
        supportedGenerationMethods: ["countTokens"],
      },
    ]);
    expect(picked.map((m) => m.id)).toEqual([
      "gemini-flash-latest",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-2.5-flash",
    ]);
    expect(picked.find((m) => m.id === "gemini-3.1-pro-preview")?.preview).toBe(
      true,
    );
    expect(picked.find((m) => m.id === "gemini-2.5-flash")?.label).toBe(
      "Gemini 2.5 Flash",
    );
  });
});

describe("classifyModelError", () => {
  it("treats a free-tier quota of zero as no access", () => {
    expect(
      classifyModelError(
        429,
        "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro",
      ),
    ).toBe("blocked");
  });
  it("treats retired or unknown models as no access", () => {
    expect(classifyModelError(404, "no longer available to new users")).toBe(
      "blocked",
    );
  });
  it("asks to retry when the model is only busy or rate-limited", () => {
    expect(classifyModelError(503, "high demand")).toBe("retry");
    expect(classifyModelError(429, "limit: 15, model: gemini-3.5-flash")).toBe(
      "retry",
    );
  });
});

describe("prefersDefaultTemperature", () => {
  it("is true for Gemini 3+ and the latest aliases, false for older models", () => {
    expect(prefersDefaultTemperature("gemini-3.5-flash")).toBe(true);
    expect(prefersDefaultTemperature("gemini-3-flash-preview")).toBe(true);
    expect(prefersDefaultTemperature("gemini-flash-latest")).toBe(true);
    expect(prefersDefaultTemperature("gemini-2.5-flash")).toBe(false);
  });
});
