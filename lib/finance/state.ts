/**
 * Single source of truth for "what is the user's financial state right now".
 *
 * Before this module existed, each route reached into ob_accounts /
 * ob_transactions independently and `goals.saved_amount` was hardcoded to 0
 * at onboarding and never updated — so the dashboard progress bar was
 * always 0% and the engine projected from zero forever. Every read path
 * (dashboard, trajectory, cron, reveal, prompts) now derives current state
 * from this service so the progress loop is closed.
 *
 * Returns Pence everywhere; the DB stores pounds (numeric). The conversion
 * lives here at the boundary, not scattered through the routes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { Goal } from "@/lib/validators/goals";
import {
  pence,
  poundsToPence,
  pounds,
  type Pence,
} from "@/lib/money";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { calculateMonthlySurplus } from "@/lib/trajectory/surplus";

type Client = SupabaseClient<Database>;

/** Account types treated as liquid / savings-attributable. Case-insensitive substring match. */
const SAVINGS_ACCOUNT_HINTS = ["savings", "isa", "lisa"];
const LIQUID_ACCOUNT_HINTS = ["savings", "isa", "lisa", "current", "checking", "transaction"];

export type FinancialState = {
  /** Sum of liquid + savings account balances. */
  liquidBalance: Pence;
  /** Subset of liquidBalance held in savings-type accounts. */
  savingsBalance: Pence;
  /** Recent (90d) net surplus per month. */
  monthlySurplus: Pence;
};

/**
 * Snapshot the user's current financial state in one DB round-trip's worth
 * of selects. Callers that need per-goal attribution wrap this with
 * `attributeSavingsToGoals`.
 */
export async function getFinancialState(
  userId: string,
  client: Client,
  asOfDate: Date = new Date(),
): Promise<FinancialState> {
  const [{ data: accountRows }, transactions] = await Promise.all([
    client
      .from("ob_accounts")
      .select("current_balance, account_type")
      .eq("user_id", userId),
    getTransactionsForUser(userId, client),
  ]);

  const accounts = accountRows ?? [];
  const liquidBalance = sumBalancePence(accounts, LIQUID_ACCOUNT_HINTS);
  const savingsBalance = sumBalancePence(accounts, SAVINGS_ACCOUNT_HINTS);

  return {
    liquidBalance,
    savingsBalance,
    monthlySurplus: pence(calculateMonthlySurplus(transactions, asOfDate)),
  };
}

/**
 * Attribute liquid savings to each active goal.
 *
 * v1 policy: take the savings-account balance and split it across goals in
 * proportion to remaining need. If there are no savings-type accounts
 * (common for fresh connections), fall back to a small slice of the wider
 * liquid balance so the progress bar moves with real money instead of
 * sitting at zero. Total attribution never exceeds savingsBalance +
 * liquid fallback, never exceeds any goal's target, and the result is
 * pre-computed once per request — every consumer reads the same number.
 *
 * Returns a Map of goal.id → saved pence (plain number; the engine and
 * use-case layer consume pence as numbers).
 */
export function attributeSavingsToGoals(
  goals: Goal[],
  state: FinancialState,
): Map<string, number> {
  const out = new Map<string, number>();
  if (goals.length === 0) return out;

  // Use savings-type balance when available, else fall back to liquid.
  const poolPence = (state.savingsBalance as number) > 0
    ? state.savingsBalance
    : state.liquidBalance;
  const pool = poolPence as number;

  // Remaining target per goal, in pence. target_amount is whole pounds.
  const remaining = goals.map((g) => {
    const target = poundsToPence(pounds(computeTargetAmount(g))) as number;
    return Math.max(0, target);
  });
  const totalRemaining = remaining.reduce((s, v) => s + v, 0);

  if (totalRemaining <= 0 || pool <= 0) {
    for (const g of goals) out.set(g.id, 0);
    return out;
  }

  // Proportional split. Cap at each goal's remaining so we don't over-fund.
  for (let i = 0; i < goals.length; i++) {
    const share = Math.round((remaining[i] / totalRemaining) * pool);
    const capped = Math.min(share, remaining[i]);
    out.set(goals[i].id, Math.round(capped));
  }
  return out;
}

/** Mirrors engine.ts: home goal targets the deposit, not the property price. */
function computeTargetAmount(goal: Goal): number {
  if (goal.type === "home" && goal.deposit_pct !== null) {
    return Math.round(goal.target_amount * (goal.deposit_pct / 100));
  }
  return goal.target_amount;
}

function sumBalancePence(
  accounts: { current_balance: number | null; account_type: string | null }[],
  hints: string[],
): Pence {
  let total = 0;
  for (const a of accounts) {
    if (a.current_balance == null) continue;
    const t = (a.account_type ?? "").toLowerCase();
    const match = hints.length === 0 || hints.some((h) => t.includes(h));
    if (!match) continue;
    total += Math.round(a.current_balance * 100);
  }
  return pence(total);
}
