import { ConnectBankButton } from "@/components/connect/ConnectBankButton";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatRelative } from "@/lib/utils";

export const metadata = {
  title: "Accounts — Open Banking Aggregator",
};

export default async function AccountsPage() {
  const supabase = await createClient();

  const [{ data: accounts }, { data: connections }] = await Promise.all([
    supabase
      .from("ob_accounts")
      .select(
        "id, display_name, account_type, currency, current_balance, connection_id",
      )
      .order("display_name"),
    supabase
      .from("ob_connections")
      .select("id, institution_name, last_synced_at"),
  ]);

  const connectionById = new Map(
    (connections ?? []).map((c) => [c.id, c]),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
        <div className="flex items-center gap-3">
          <SyncButton />
          <ConnectBankButton />
        </div>
      </div>

      {!accounts || accounts.length === 0 ? (
        <p className="mt-8 text-gray-500">
          No accounts yet. Connect a bank to see your balances here.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => {
            const connection = connectionById.get(account.connection_id);
            return (
              <Card key={account.id}>
                <CardHeader>
                  <CardTitle>
                    {connection?.institution_name ?? "Bank account"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium text-gray-900">
                    {account.display_name ?? account.account_type ?? "Account"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {formatCurrency(account.current_balance, account.currency)}
                  </p>
                  <p className="mt-3 text-xs text-gray-400">
                    {account.account_type ?? "—"} · synced{" "}
                    {formatRelative(connection?.last_synced_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
