import Link from "next/link";

import { BalanceForecastChart } from "@/components/dashboard/BalanceForecastChart";
import { ConnectBankButton } from "@/components/connect/ConnectBankButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildBalanceTabs } from "@/lib/balance-history";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata = {
  title: "Overview — Open Banking Aggregator",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Balance history is reconstructed by walking current balances backward
  // through recent transactions, so fetch a little over the chart's window.
  const today = new Date();
  const historyCutoff = new Date(
    today.getTime() - 130 * 86_400_000,
  ).toISOString();

  const [
    { data: accounts },
    { count: txCount },
    { count: connectionCount },
    chartTx,
  ] = await Promise.all([
    supabase
      .from("ob_accounts")
      .select("id, account_type, current_balance, currency"),
    supabase.from("ob_transactions").select("id", { count: "exact", head: true }),
    supabase
      .from("ob_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    fetchTransactionsSince(supabase, historyCutoff),
  ]);

  const balanceTabs = buildBalanceTabs(accounts ?? [], chartTx, today);
  const todayKey = today.toISOString().slice(0, 10);

  // Net worth is summed per currency — mixing currencies into one total
  // would be misleading.
  const byCurrency = new Map<string, number>();
  for (const account of accounts ?? []) {
    if (account.current_balance === null) continue;
    const currency = account.currency ?? "GBP";
    byCurrency.set(
      currency,
      (byCurrency.get(currency) ?? 0) + account.current_balance,
    );
  }
  const netWorthEntries = [...byCurrency.entries()];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
        <ConnectBankButton />
      </div>

      {(connectionCount ?? 0) === 0 ? (
        <Card className="mt-6">
          <CardContent>
            <p className="pt-3 text-gray-600">
              Welcome. Connect your first bank account to start aggregating
              your finances.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Net worth</CardTitle>
            </CardHeader>
            <CardContent>
              {netWorthEntries.length === 0 ? (
                <p className="text-2xl font-semibold text-gray-900">—</p>
              ) : (
                netWorthEntries.map(([currency, total]) => (
                  <p
                    key={currency}
                    className="text-2xl font-semibold text-gray-900"
                  >
                    {formatCurrency(total, currency)}
                  </p>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-gray-900">
                {accounts?.length ?? 0}
              </p>
              <Link
                href="/dashboard/accounts"
                className="mt-1 inline-block text-sm text-gray-500 hover:text-gray-900"
              >
                View accounts →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-gray-900">
                {txCount ?? 0}
              </p>
              <Link
                href="/dashboard/transactions"
                className="mt-1 inline-block text-sm text-gray-500 hover:text-gray-900"
              >
                View transactions →
              </Link>
            </CardContent>
          </Card>
        </div>

        {(accounts?.length ?? 0) > 0 && (
          <div className="mt-4">
            <BalanceForecastChart series={balanceTabs} todayKey={todayKey} />
          </div>
        )}
        </>
      )}
    </div>
  );
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ChartTransaction = {
  account_id: string;
  amount: number;
  timestamp: string;
};

/**
 * Fetches every transaction since `cutoff`, paging past PostgREST's 1000-row
 * response cap — the balance reconstruction needs the full set or the
 * running balance drifts.
 */
async function fetchTransactionsSince(
  supabase: SupabaseServerClient,
  cutoff: string,
): Promise<ChartTransaction[]> {
  const PAGE = 1000;
  const rows: ChartTransaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("ob_transactions")
      .select("account_id, amount, timestamp")
      .gte("timestamp", cutoff)
      .order("timestamp", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}
