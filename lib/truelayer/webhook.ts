import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a TrueLayer webhook body against its HMAC-SHA256 signature using a
 * constant-time comparison. Returns false (never throws) for any malformed or
 * missing input so callers can simply reject with 401.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");

  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
