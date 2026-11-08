import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for user API keys at rest. ENCRYPTION_KEY is 32 random bytes,
 * base64. A fresh 12-byte IV per encryption; the auth tag detects tampering.
 * Kept free of "server-only" so it can be unit tested; only server code imports it.
 */

export type Sealed = { ciphertext: string; iv: string; authTag: string };

export function loadKey(raw = process.env.ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32)
    throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function seal(plain: string, key = loadKey()): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function open(sealed: Sealed, key = loadKey()): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(sealed.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Shown in the UI so people can tell which key is connected. */
export function lastFour(apiKey: string) {
  return apiKey.trim().slice(-4);
}
