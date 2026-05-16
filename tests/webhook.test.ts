import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "@/lib/truelayer/webhook";

const SECRET = "webhook-secret";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ type: "data:updated", connection_id: "c1" });

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "wrong"), SECRET)).toBe(
      false,
    );
  });

  it("rejects a signature for a different body", () => {
    expect(verifyWebhookSignature(body, sign("other"), SECRET)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(verifyWebhookSignature(body, sign(body), undefined)).toBe(false);
  });

  it("rejects a non-hex signature without throwing", () => {
    expect(verifyWebhookSignature(body, "zzzz", SECRET)).toBe(false);
  });
});
