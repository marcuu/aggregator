import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/truelayer/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/truelayer/auth")>(
    "@/lib/truelayer/auth",
  );
  return { ...actual, refreshToken: vi.fn() };
});

vi.mock("@/lib/truelayer/client", () => ({
  getAccounts: vi.fn(),
  getBalance: vi.fn(),
  getTransactions: vi.fn(),
}));

import { TokenRefreshError, refreshToken } from "@/lib/truelayer/auth";
import { getAccounts, getBalance, getTransactions } from "@/lib/truelayer/client";
import { syncUser } from "@/lib/truelayer/sync";

const mocks = {
  refreshToken: vi.mocked(refreshToken),
  getAccounts: vi.mocked(getAccounts),
  getBalance: vi.mocked(getBalance),
  getTransactions: vi.mocked(getTransactions),
};

type Recorded = { table: string; rows: unknown; options?: unknown };

/** Minimal chainable Supabase client stand-in that records writes. */
function createMockClient() {
  const upserts: Recorded[] = [];
  const updates: Recorded[] = [];

  function results(table: string) {
    switch (table) {
      case "ob_tokens":
        return { data: { connection_id: "conn-1" }, error: null };
      case "ob_accounts":
        return { data: { id: "account-row-1" }, error: null };
      default:
        return { data: null, error: null };
    }
  }

  function builder(table: string) {
    const result = () => results(table);
    const chain = {
      select: () => chain,
      eq: () => chain,
      upsert: (rows: unknown, options?: unknown) => {
        upserts.push({ table, rows, options });
        return chain;
      },
      update: (rows: unknown) => {
        updates.push({ table, rows });
        return chain;
      },
      maybeSingle: () => Promise.resolve(result()),
      single: () => Promise.resolve(result()),
      then: (resolve: (value: unknown) => void) => resolve(result()),
    };
    return chain;
  }

  return {
    client: { from: (table: string) => builder(table) },
    upserts,
    updates,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncUser", () => {
  it("upserts accounts and transactions for the user", async () => {
    mocks.refreshToken.mockResolvedValue("access-token");
    mocks.getAccounts.mockResolvedValue([
      { account_id: "acc-1", display_name: "Current", currency: "GBP" },
    ]);
    mocks.getBalance.mockResolvedValue({
      currency: "GBP",
      current: 100.5,
      available: 90,
    });
    mocks.getTransactions.mockResolvedValue([
      {
        transaction_id: "tx-1",
        timestamp: "2026-05-01T00:00:00Z",
        amount: -5,
        currency: "GBP",
        description: "Shop",
      },
    ]);

    const { client, upserts, updates } = createMockClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncUser("user-1", client as any);

    const accountUpsert = upserts.find((u) => u.table === "ob_accounts");
    expect(accountUpsert).toBeDefined();
    expect(accountUpsert?.options).toEqual({
      onConflict: "user_id,provider_account_id",
    });
    expect(accountUpsert?.rows).toMatchObject({
      provider_account_id: "acc-1",
      current_balance: 100.5,
    });

    const txUpsert = upserts.find((u) => u.table === "ob_transactions");
    expect(txUpsert).toBeDefined();
    expect(txUpsert?.options).toEqual({
      onConflict: "account_id,provider_transaction_id",
    });
    expect(Array.isArray(txUpsert?.rows)).toBe(true);
    expect((txUpsert?.rows as unknown[]).length).toBe(1);

    // last_synced_at is bumped on the connection.
    expect(updates.some((u) => u.table === "ob_connections")).toBe(true);
  });

  it("marks the connection expired when the refresh token is rejected", async () => {
    mocks.refreshToken.mockRejectedValue(
      new TokenRefreshError("refresh rejected"),
    );

    const { client, updates } = createMockClient();

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      syncUser("user-1", client as any),
    ).rejects.toThrow(TokenRefreshError);

    const connectionUpdate = updates.find((u) => u.table === "ob_connections");
    expect(connectionUpdate?.rows).toMatchObject({ status: "expired" });
  });

  it("does not upsert transactions when an account has none", async () => {
    mocks.refreshToken.mockResolvedValue("access-token");
    mocks.getAccounts.mockResolvedValue([{ account_id: "acc-1" }]);
    mocks.getBalance.mockResolvedValue(null);
    mocks.getTransactions.mockResolvedValue([]);

    const { client, upserts } = createMockClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncUser("user-1", client as any);

    expect(upserts.some((u) => u.table === "ob_transactions")).toBe(false);
  });
});
