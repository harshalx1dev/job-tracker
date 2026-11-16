import "server-only";

/** A small client for the parts of Apify's API we use. The token goes in the Authorization header, never in a URL. */

const BASE = "https://api.apify.com/v2";

/** Safe to show to the user or to Claude. */
export class ApifyError extends Error {}
/** Apify did not accept the token. */
export class ApifyAuthError extends ApifyError {}

export type Run = {
  id: string;
  status: string;
  datasetId: string;
  costUsd: number | null;
};

async function call(token: string, path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    throw new ApifyError("Couldn't reach Apify. Try again in a moment.");
  }
  if (res.status === 401)
    throw new ApifyAuthError(
      "Apify rejected the saved token. The user needs to add a new one in Trackr Settings.",
    );
  if (res.status === 402)
    throw new ApifyError(
      "The Apify account is out of credit for this month, so no search was run.",
    );
  if (res.status === 429)
    throw new ApifyError("Apify says too many requests. Wait a minute.");
  if (!res.ok) throw new ApifyError(`Apify returned an error (${res.status}).`);
  return res.json() as Promise<{ data?: unknown } & Record<string, unknown>>;
}

/** Checks a token and returns the Apify username it belongs to. */
export async function whoAmI(token: string): Promise<string> {
  const body = await call(token, "/users/me");
  const name = (body.data as { username?: string } | undefined)?.username;
  if (!name)
    throw new ApifyError("Apify didn't say who this token belongs to.");
  return name;
}

const toRun = (body: { data?: unknown }): Run => {
  const d = (body.data ?? {}) as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    status: String(d.status ?? "UNKNOWN"),
    datasetId: String(d.defaultDatasetId ?? ""),
    costUsd: typeof d.usageTotalUsd === "number" ? d.usageTotalUsd : null,
  };
};

/** Starts an Actor and waits up to `waitSecs` for it to finish. Spending is capped by Apify itself. */
export async function startRun(
  token: string,
  actor: string,
  input: Record<string, unknown>,
  caps: {
    maxItems: number;
    maxChargeUsd: number;
    timeoutSecs: number;
    waitSecs: number;
  },
): Promise<Run> {
  const q = new URLSearchParams({
    waitForFinish: String(caps.waitSecs),
    maxItems: String(caps.maxItems),
    maxTotalChargeUsd: String(caps.maxChargeUsd),
    timeout: String(caps.timeoutSecs),
  });
  return toRun(
    await call(token, `/acts/${actor}/runs?${q}`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function getRun(
  token: string,
  runId: string,
  waitSecs: number,
): Promise<Run> {
  const id = encodeURIComponent(runId);
  return toRun(
    await call(token, `/actor-runs/${id}?waitForFinish=${waitSecs}`),
  );
}

/** Only the named fields, so a run's payload stays small. */
export async function getItems(
  token: string,
  datasetId: string,
  fields: string,
  limit: number,
): Promise<unknown[]> {
  const q = new URLSearchParams({
    clean: "true",
    format: "json",
    limit: String(limit),
    fields,
  });
  const res = await fetch(
    `${BASE}/datasets/${encodeURIComponent(datasetId)}/items?${q}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  ).catch(() => null);
  if (!res || !res.ok)
    throw new ApifyError("Couldn't read the search results from Apify.");
  const items = await res.json();
  return Array.isArray(items) ? items : [];
}
