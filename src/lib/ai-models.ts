/**
 * Which Gemini models can write drafts, and how to read a model check.
 * Pure functions (no I/O) so they are unit tested; the fetching lives in
 * src/server/ai/models.ts.
 */

export type ModelOption = {
  /** API id, e.g. "gemini-3.5-flash". */
  id: string;
  label: string;
  preview: boolean;
};

/** The outcome of one tiny test call with a model. */
export type ModelAccess = "ok" | "blocked" | "retry";

type ListedModel = {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
};

/**
 * General text models only: Gemini Pro, Flash and Flash-Lite, numbered or
 * "-latest". This leaves out speech, image, music, robotics, agent and
 * computer-use models, which the key also lists but which can't write drafts.
 */
const DRAFT_MODEL =
  /^gemini-(?:(\d+(?:\.\d+)?)-)?(pro|flash|flash-lite)(-latest|-preview(?:-[\d-]+)?)?$/;

const TIER_RANK = { pro: 0, flash: 1, "flash-lite": 2 } as const;

export function isDraftModelId(id: string) {
  const m = DRAFT_MODEL.exec(id);
  if (!m) return false;
  const [, version, , suffix] = m;
  // "-latest" is an alias without a version number (gemini-flash-latest).
  if (suffix === "-latest") return !version;
  return Boolean(version);
}

/** Filters a ListModels response to draft-capable models, newest first. */
export function pickDraftModels(models: ListedModel[]): ModelOption[] {
  const seen = new Set<string>();
  const out: (ModelOption & { version: number; tier: number })[] = [];
  for (const m of models) {
    const id = m.name.replace(/^models\//, "");
    if (seen.has(id)) continue;
    if (!m.supportedGenerationMethods?.includes("generateContent")) continue;
    if (!isDraftModelId(id)) continue;
    seen.add(id);
    const [, version, tier, suffix] = DRAFT_MODEL.exec(id)!;
    out.push({
      id,
      label: m.displayName?.trim() || id,
      preview: Boolean(suffix?.startsWith("-preview")),
      // "-latest" aliases sort first: they follow Google's newest release.
      version: version ? Number(version) : Number.POSITIVE_INFINITY,
      tier: TIER_RANK[tier as keyof typeof TIER_RANK],
    });
  }
  out.sort(
    (a, b) =>
      b.version - a.version ||
      a.tier - b.tier ||
      Number(a.preview) - Number(b.preview) ||
      a.id.localeCompare(b.id),
  );
  return out.map(({ id, label, preview }) => ({ id, label, preview }));
}

/**
 * Reads a failed test call. "blocked": the key can't use this model at all
 * (not found, retired, no permission, or a free-tier quota of zero).
 * "retry": the model exists for this key but is busy or rate-limited now.
 */
export function classifyModelError(status: number, body: string): ModelAccess {
  if (status === 404 || status === 403) return "blocked";
  if (status === 400 && /not supported|not found|unavailable/i.test(body))
    return "blocked";
  if (status === 429 && /limit:\s*0\b/.test(body)) return "blocked";
  return "retry";
}
