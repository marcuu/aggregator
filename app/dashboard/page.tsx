import Link from "next/link";

import { ConnectBankButton } from "@/components/connect/ConnectBankButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata = {
  title: "Overview — Open Banking Aggregator",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: accounts }, { count: txCount }, { count: connectionCount }] =
    await Promise.all([
      supabase.from("ob_accounts").select("current_balance, currency"),
      supabase
        .from("ob_transactions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("ob_connections")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

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
      )}
    </div>
  );
}
