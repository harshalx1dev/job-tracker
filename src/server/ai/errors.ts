import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

export type AiErrorCode =
  | "KEY_REQUIRED"
  | "LIMIT"
  | "INVALID_KEY"
  | "PROVIDER_LIMIT"
  | "BAD_OUTPUT"
  | "TOO_LARGE"
  | "FAILED";

/** An AI failure with a message safe to show the user. */
export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export type AiResult<T> =
  { ok: true; data: T } | { ok: false; code: AiErrorCode; error: string };

/** Google's own error message from a failed call (never the key or our payload). */
function providerMessage(body: string | undefined) {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { status?: string; message?: string };
    };
    return [parsed.error?.status, parsed.error?.message]
      .filter(Boolean)
      .join(": ")
      .slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
}

/**
 * Maps SDK/provider errors to a code and a plain message. `context` (feature and
 * model, e.g. "parse_resume on gemini-3.5-flash") goes into the server log.
 */
export function toAiError(
  err: unknown,
  chosenModel = false,
  context = "",
): AiError {
  if (err instanceof AiError) return err;
  const inner = RetryError.isInstance(err) ? err.lastError : err;

  if (NoObjectGeneratedError.isInstance(inner)) {
    return new AiError(
      "BAD_OUTPUT",
      "The AI's answer didn't match the expected format. Try again.",
    );
  }
  if (APICallError.isInstance(inner)) {
    const status = inner.statusCode ?? 0;
    const body = `${inner.message} ${inner.responseBody ?? ""}`.toLowerCase();
    if (
      status === 401 ||
      status === 403 ||
      (status === 400 && /api[_ ]?key/.test(body))
    ) {
      return new AiError(
        "INVALID_KEY",
        "Gemini rejected this API key. Check it in Settings.",
      );
    }
    if (
      status === 404 ||
      (chosenModel && status === 429 && /limit:\s*0\b/.test(body))
    ) {
      return new AiError(
        "FAILED",
        chosenModel
          ? "Your chosen AI model isn't available to your key any more. Pick another in Settings."
          : "The AI model isn't available to this key.",
      );
    }
    if (status === 429) {
      return new AiError(
        "PROVIDER_LIMIT",
        "Gemini's rate limit for this key was reached (free keys allow a few requests a minute). Wait a minute and try again.",
      );
    }
    if (status === 400 && /invalid[_ ]argument/.test(body)) {
      console.error(
        `[ai] rejected request${context ? ` (${context})` : ""}:`,
        providerMessage(inner.responseBody),
      );
      return new AiError(
        "FAILED",
        "Gemini rejected this request. Try again, or pick a different AI model in Settings.",
      );
    }
    if (status === 413 || /too large|token count/.test(body)) {
      return new AiError(
        "TOO_LARGE",
        "That text is too long for one request. Try a shorter version.",
      );
    }
  }
  if (
    APICallError.isInstance(inner) &&
    /cannot connect|certificate|fetch failed/i.test(inner.message)
  ) {
    console.error("[ai] network:", String(inner.message).slice(0, 200));
    return new AiError(
      "FAILED",
      "Couldn't reach Gemini from the server. Check the network (see README: NODE_USE_SYSTEM_CA).",
    );
  }
  // Unrecognised: log what failed and Google's reason (never the key or our payload).
  const e = inner as
    { name?: string; statusCode?: number; message?: string } | undefined;
  console.error(
    `[ai] unmapped error${context ? ` (${context})` : ""}:`,
    e?.name,
    e?.statusCode ?? "",
    String(e?.message ?? inner).slice(0, 200),
    APICallError.isInstance(inner)
      ? `| provider: ${providerMessage(inner.responseBody)}`
      : "",
  );
  return new AiError("FAILED", "The AI request failed. Try again in a moment.");
}
