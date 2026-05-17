/**
 * Derives daily balance history and a spending-rate forecast from account
 * balances and transactions. There is no balance-snapshot table, so history
 * is reconstructed by walking each account's current balance backward through
 * its signed transactions (credits positive, debits negative).
 */

export type DayPoint = { date: string; balance: number };

export type BalanceSeries = {
  /** Daily end-of-day balances, ascending by date. */
  points: DayPoint[];
  currency: string;
  /** Average net daily change over the trailing window — used to forecast. */
  dailyRate: number;
  /** Today's combined balance for the accounts in this series. */
  currentBalance: number;
  accountCount: number;
};

type AccountRow = {
  id: string;
  account_type: string | null;
  currency: string | null;
  current_balance: number | null;
};

type TxRow = {
  account_id: string;
  amount: number;
  timestamp: string;
};

const HISTORY_DAYS = 120;
const RATE_WINDOW = 30;

export type TabKey = "all" | "checking" | "savings";

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Buckets an account into one of the chart's filter tabs. */
export function classifyAccountType(type: string | null): TabKey | "other" {
  const t = (type ?? "").toUpperCase();
  if (t.includes("SAV")) return "savings";
  if (t.includes("CHECK") || t.includes("CURRENT") || t.includes("TRANSACTION"))
    return "checking";
  return "other";
}

export function buildBalanceSeries(
  accounts: AccountRow[],
  transactions: TxRow[],
  today: Date = new Date(),
): BalanceSeries {
  const accountIds = new Set(accounts.map((a) => a.id));
  const currentBalance = accounts.reduce(
    (sum, a) => sum + (a.current_balance ?? 0),
    0,
  );
  const currency = accounts.find((a) => a.currency)?.currency ?? "GBP";

  // Sum signed transaction amounts per UTC day.
  const txByDay = new Map<string, number>();
  for (const tx of transactions) {
    if (!accountIds.has(tx.account_id)) continue;
    const key = tx.timestamp.slice(0, 10);
    txByDay.set(key, (txByDay.get(key) ?? 0) + tx.amount);
  }

  // Walk backward: end-of-day balance for a prior day excludes the later
  // day's transactions.
  const points: DayPoint[] = [];
  let running = currentBalance;
  const cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const key = utcKey(cursor);
    points.push({ date: key, balance: round2(running) });
    running -= txByDay.get(key) ?? 0;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  points.reverse();

  const window = Math.min(RATE_WINDOW, points.length - 1);
  let dailyRate = 0;
  if (window > 0) {
    const recent = points[points.length - 1].balance;
    const past = points[points.length - 1 - window].balance;
    dailyRate = (recent - past) / window;
  }

  return {
    points,
    currency,
    dailyRate: round2(dailyRate),
    currentBalance: round2(currentBalance),
    accountCount: accounts.length,
  };
}

/** Builds the per-tab series the chart consumes from raw account/tx rows. */
export function buildBalanceTabs(
  accounts: AccountRow[],
  transactions: TxRow[],
  today: Date = new Date(),
): Record<TabKey, BalanceSeries> {
  const checking = accounts.filter(
    (a) => classifyAccountType(a.account_type) === "checking",
  );
  const savings = accounts.filter(
    (a) => classifyAccountType(a.account_type) === "savings",
  );
  return {
    all: buildBalanceSeries(accounts, transactions, today),
    checking: buildBalanceSeries(checking, transactions, today),
    savings: buildBalanceSeries(savings, transactions, today),
  };
}
