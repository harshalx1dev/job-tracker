import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed links for the print route, so headless Chrome can render a
 * resume without a session cookie. Token = "<expiry>.<hmac(resumeId.expiry)>".
 */
const TTL_MS = 2 * 60_000;

function secret() {
  const s = process.env.PRINT_TOKEN_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!s)
    throw new Error("PRINT_TOKEN_SECRET or BETTER_AUTH_SECRET must be set");
  return s;
}

function sign(resumeId: string, exp: number, key = secret()) {
  return createHmac("sha256", key)
    .update(`${resumeId}.${exp}`)
    .digest("base64url");
}

export function createPrintToken(
  resumeId: string,
  now = Date.now(),
  key?: string,
) {
  const exp = now + TTL_MS;
  return `${exp}.${sign(resumeId, exp, key)}`;
}

export function verifyPrintToken(
  resumeId: string,
  token: string | undefined,
  now = Date.now(),
  key?: string,
) {
  if (!token) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !sig || exp < now) return false;
  const expected = Buffer.from(sign(resumeId, exp, key));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
