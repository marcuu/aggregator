import { beforeEach, describe, expect, it, vi } from "vitest";

import { lawFastBenchmarks } from "../trajectory/fixtures";

/**
 * True integration / regression test for the goal-progress loop.
 *
 * Unlike the use-case test (goal-progress.test.ts), this drives the actual
 * GET /api/dashboard handler through a faked Supabase client. It is the test
 * that would catch the original failure mode — a route that loads goal rows
 * but forgets to call the FinancialStateService, leaving saved_amount at 0.
 * If anyone rewires the route and drops the derive-on-read step, the
 * savedAmount assertion below goes back to 0 and this fails.
 */

// ── Fake Supabase client ────────────────────────────────────────────────────
// A minimal chainable query builder over in-memory tables. Supports the subset
// of the PostgREST surface the dashboard route uses: select (with count/head),
// eq filters, order (noop), limit, maybeSingle, and awaiting the builder.

type Tables = Record<string, Record<string, unknown>[]>;

class FakeQuery implements PromiseLike<{ data: unknown; count?: number; error: null }> {
  private eqs: [string, unknown][] = [];
  private limitN: number | null = null;
  private single = false;
  private wantCount = false;
  private head = false;

  constructor(
    private readonly table: string,
    private readonly tables: Tables,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  eq(col: string, val: unknown) {
    this.eqs.push([col, val]);
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this.resolve();
  }

  private resolve() {
    let rows = (this.tables[this.table] ?? []).filter((r) =>
      this.eqs.every(([c, v]) => r[c] === v),
    );
    if (this.head && this.wantCount) {
      return Promise.resolve({ data: null, count: rows.length, error: null });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    if (this.single) {
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }
    return Promise.resolve({ data: rows, error: null });
  }

  then<R1, R2>(
    onfulfilled?: ((v: { data: unknown; count?: number; error: null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.resolve().then(onfulfilled, onrejected);
  }
}

function makeClient(user: { id: string } | null, tables: Tables) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table: string) => new FakeQuery(table, tables),
  };
}

let fakeClient: ReturnType<typeof makeClient>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => fakeClient),
  createServiceClient: vi.fn(() => fakeClient),
  getRequestUserId: vi.fn(async () => "11111111-1111-4111-8111-111111111111"),
}));

// Imported after the mock is registered.
const { GET } = await import("@/app/api/dashboard/route");

// ── Seed helpers ─────────────────────────────────────────────────────────────

function recentMonthlyTransactions(incomePounds: number, spendPounds: number) {
  // Three months of income/spend inside the 90-day surplus window, relative
  // to the route's real `new Date()` so the test is not date-pinned.
  const now = new Date();
  return [0, 1, 2].flatMap((monthsAgo, i) => {
    const d = new Date(now);
    d.setDate(15);
    d.setMonth(d.getMonth() - monthsAgo);
    const ts = d.toISOString();
    return [
      { id: `inc-${i}`, user_id: "11111111-1111-4111-8111-111111111111", amount: incomePounds, timestamp: ts, category: "salary", description: "salary", merchant_name: null },
      { id: `spend-${i}`, user_id: "11111111-1111-4111-8111-111111111111", amount: -spendPounds, timestamp: ts, category: "rent", description: "rent", merchant_name: null },
    ];
  });
}

function seed(savingsBalancePounds: number): Tables {
  return {
    user_profiles: [
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        sector: "law",
        trajectory_tier: "fast",
        current_salary: 40000,
        date_of_birth: "2001-05-18",
        onboarding_complete: true,
        onboarding_step: 5,
      },
    ],
    goals: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "11111111-1111-4111-8111-111111111111",
        type: "home",
        target_amount: 22000,
        target_region: "Manchester",
        deposit_pct: null,
        rough_target_date: null,
        projected_target_date: null,
        saved_amount: 0, // stale column — must NOT be the source of truth
        is_active: true,
      },
    ],
    salary_benchmarks: lawFastBenchmarks.map((b) => ({ ...b })),
    trajectory_snapshots: [],
    ob_connections: [
      { id: "33333333-3333-4333-8333-333333333333", user_id: "11111111-1111-4111-8111-111111111111", status: "active", institution_name: "Monzo" },
    ],
    ob_accounts: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        user_id: "11111111-1111-4111-8111-111111111111",
        connection_id: "33333333-3333-4333-8333-333333333333",
        display_name: "Savings",
        account_type: "savings",
        currency: "GBP",
        current_balance: savingsBalancePounds,
      },
    ],
    ob_transactions: recentMonthlyTransactions(3000, 2550), // £450/mo surplus
    dismissed_prompts: [],
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/dashboard — goal-progress wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives saved_amount from synced balances, not the stale 0 column", async () => {
    fakeClient = makeClient({ id: "11111111-1111-4111-8111-111111111111" }, seed(5000)); // £5,000 in savings
    const res = await GET();
    const body = await res.json();

    expect(body.goals).toHaveLength(1);
    // £5,000 → 500,000 pence, attributed to the only goal.
    expect(body.goals[0].trajectory.savedAmount).toBe(500_000);
    expect(body.goals[0].goal.saved_amount).toBe(0); // column untouched
  });

  it("reflects a balance change in the projected age (loop is closed)", async () => {
    fakeClient = makeClient({ id: "11111111-1111-4111-8111-111111111111" }, seed(0));
    const empty = await (await GET()).json();

    fakeClient = makeClient({ id: "11111111-1111-4111-8111-111111111111" }, seed(15000)); // £15k already saved
    const funded = await (await GET()).json();

    expect(empty.goals[0].trajectory.savedAmount).toBe(0);
    expect(funded.goals[0].trajectory.savedAmount).toBe(1_500_000);
    expect(funded.goals[0].trajectory.monthsToGoal).toBeLessThan(
      empty.goals[0].trajectory.monthsToGoal,
    );
    expect(funded.goals[0].trajectory.trajectoryAge).toBeLessThan(
      empty.goals[0].trajectory.trajectoryAge,
    );
  });

  it("returns 401 when unauthenticated", async () => {
    fakeClient = makeClient(null, seed(5000));
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
