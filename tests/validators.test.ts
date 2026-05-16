import { describe, expect, it } from "vitest";

import {
  accountSchema,
  refreshResponseSchema,
  tokenResponseSchema,
  transactionSchema,
  webhookEventSchema,
} from "@/lib/validators/truelayer";

describe("tokenResponseSchema", () => {
  it("accepts a well-formed token response", () => {
    const result = tokenResponseSchema.safeParse({
      access_token: "access-123",
      refresh_token: "refresh-123",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "info accounts",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response missing the refresh token", () => {
    const result = tokenResponseSchema.safeParse({
      access_token: "access-123",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive expiry", () => {
    const result = tokenResponseSchema.safeParse({
      access_token: "access-123",
      refresh_token: "refresh-123",
      expires_in: 0,
      token_type: "Bearer",
    });
    expect(result.success).toBe(false);
  });
});

describe("refreshResponseSchema", () => {
  it("allows an omitted refresh token", () => {
    const result = refreshResponseSchema.safeParse({
      access_token: "access-456",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result.success).toBe(true);
  });
});

describe("accountSchema", () => {
  it("accepts an account with only an id", () => {
    expect(accountSchema.safeParse({ account_id: "acc-1" }).success).toBe(true);
  });

  it("rejects an account with no id", () => {
    expect(accountSchema.safeParse({ display_name: "Current" }).success).toBe(
      false,
    );
  });
});

describe("transactionSchema", () => {
  it("accepts a complete transaction", () => {
    const result = transactionSchema.safeParse({
      transaction_id: "tx-1",
      timestamp: "2026-05-01T12:00:00Z",
      description: "Coffee",
      amount: -3.5,
      currency: "GBP",
      transaction_type: "DEBIT",
      transaction_category: "PURCHASE",
      merchant_name: "Cafe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a transaction with a non-numeric amount", () => {
    const result = transactionSchema.safeParse({
      transaction_id: "tx-1",
      timestamp: "2026-05-01T12:00:00Z",
      amount: "not-a-number",
    });
    expect(result.success).toBe(false);
  });
});

describe("webhookEventSchema", () => {
  it("accepts a data-update event", () => {
    const result = webhookEventSchema.safeParse({
      type: "data:updated",
      connection_id: "conn-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an event with no type", () => {
    expect(webhookEventSchema.safeParse({ connection_id: "conn-1" }).success).toBe(
      false,
    );
  });
});
