import { jsonSchema, type Schema } from "ai";
import { z } from "zod";

/**
 * Gemini rejects response schemas with many length constraints (maxLength,
 * maxItems, ...) with a bare 400 "Request contains an invalid argument"; newer
 * models are stricter than older ones. So the model gets the schema without
 * them, and the limits are applied here instead: over-long text and lists are
 * trimmed to the limit (rather than failing the whole call), then the result is
 * validated against the original Zod schema.
 */
const LIMIT_KEYS = new Set([
  "$schema",
  "maxLength",
  "minLength",
  "maxItems",
  "minItems",
  "pattern",
  "format",
]);

type JsonNode = Record<string, unknown>;

/** The JSON Schema minus the constraint keywords Gemini chokes on. */
export function stripLimits(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripLimits);
  if (!node || typeof node !== "object") return node;
  const out: JsonNode = {};
  for (const [k, v] of Object.entries(node)) {
    if (LIMIT_KEYS.has(k)) continue;
    out[k] =
      k === "properties" && v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v).map(([pk, pv]) => [pk, stripLimits(pv)]),
          )
        : stripLimits(v);
  }
  return out;
}

/** Trims strings and arrays in `value` to the maxLength / maxItems of `schema`. */
export function clampToSchema(value: unknown, schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return value;
  const s = schema as JsonNode;
  if (typeof value === "string" && typeof s.maxLength === "number")
    return value.length > s.maxLength ? value.slice(0, s.maxLength) : value;
  if (Array.isArray(value)) {
    const items = s.items;
    const kept =
      typeof s.maxItems === "number" ? value.slice(0, s.maxItems) : value;
    return kept.map((v) => clampToSchema(v, items));
  }
  if (value && typeof value === "object" && s.properties) {
    const props = s.properties as JsonNode;
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, clampToSchema(v, props[k])]),
    );
  }
  return value;
}

/** A schema for the AI SDK: limit-free for the model, clamped and Zod-validated on the way back. */
export function modelSchema<S extends z.ZodType>(
  schema: S,
): Schema<z.infer<S>> {
  const full = z.toJSONSchema(schema, { target: "draft-7" });
  return jsonSchema<z.infer<S>>(
    stripLimits(full) as Parameters<typeof jsonSchema>[0],
    {
      validate: (value) => {
        const parsed = schema.safeParse(clampToSchema(value, full));
        return parsed.success
          ? { success: true, value: parsed.data }
          : { success: false, error: parsed.error };
      },
    },
  );
}
