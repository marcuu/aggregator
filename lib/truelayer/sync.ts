import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { TablesInsert } from "@/types/database";
import { TokenRefreshError, refreshToken } from "./auth";
import { getAccounts, getBalance, getTransactions } from "./client";
import type { Transaction } from "@/lib/validators/truelayer";
import { normaliseTransactionCategory } from "./acl";

type Client = SupabaseClient<Database>;

function mapTransaction(
  userId: string,
  accountId: string,
  tx: Transaction,
): TablesInsert<"ob_transactions"> {
  return {
    user_id: userId,
    account_id: accountId,
    provider_transaction_id:
      tx.normalised_provider_transaction_id ?? tx.transaction_id,
    amount: tx.amount,
    currency: tx.currency ?? null,
    description: tx.description ?? null,
    merchant_name: tx.merchant_name ?? null,
    category: normaliseTransactionCategory(tx),
    transaction_type: tx.transaction_type ?? null,
    timestamp: tx.timestamp,
  };
}

/**
 * Pulls fresh data for a single user from TrueLayer into Postgres:
 * refreshes the token, upserts accounts (with balances), then upserts each
 * account's transactions. Per-account failures are logged but do not abort
 * the whole sync, so a partial refresh still succeeds.
 */
export async function syncUser(userId: string, client: Client): Promise<void> {
  const { data: tokenRow, error: tokenError } = await client
    .from("ob_tokens")
    .select("connection_id")
    .eq("user_id", userId)
    .eq("provider", "truelayer")
    .maybeSingle();

  if (tokenError) {
    throw new Error(`Failed to load token row: ${tokenError.message}`);
  }
  if (!tokenRow?.connection_id) {
    throw new Error(`No active TrueLayer connection for user ${userId}`);
  }
  const connectionId = tokenRow.connection_id;

  let accessToken: string;
  try {
    accessToken = await refreshToken(userId, client);
  } catch (error) {
    // Consent has lapsed — flag the connection so the UI can prompt a
    // reconnect, then surface the failure to the caller.
    if (error instanceof TokenRefreshError) {
      await client
        .from("ob_connections")
        .update({ status: "expired" })
        .eq("id", connectionId);
    }
    throw error;
  }

  const accounts = await getAccounts(accessToken);

  for (const account of accounts) {
    try {
      const balance = await getBalance(accessToken, account.account_id);

      const { data: accountRow, error: accountError } = await client
        .from("ob_accounts")
        .upsert(
          {
            user_id: userId,
            connection_id: connectionId,
            provider_account_id: account.account_id,
            display_name: account.display_name ?? null,
            account_type: account.account_type ?? null,
            currency: account.currency ?? balance?.currency ?? null,
            current_balance: balance?.current ?? null,
            available_balance: balance?.available ?? null,
          },
          { onConflict: "user_id,provider_account_id" },
        )
        .select("id")
        .single();

      if (accountError || !accountRow) {
        throw new Error(
          `account upsert failed: ${accountError?.message ?? "no row"}`,
        );
      }

      const transactions = await getTransactions(
        accessToken,
        account.account_id,
      );

      if (transactions.length > 0) {
        const rows = transactions.map((tx) =>
          mapTransaction(userId, accountRow.id, tx),
        );
        const { error: txError } = await client
          .from("ob_transactions")
          .upsert(rows, {
            onConflict: "account_id,provider_transaction_id",
          });
        if (txError) {
          throw new Error(`transaction upsert failed: ${txError.message}`);
        }
      }
    } catch (error) {
      // Partial success is acceptable — one bad account must not abort sync.
      console.error(
        `Sync failed for account ${account.account_id} (user ${userId}):`,
        error,
      );
    }
  }

  const { error: connError } = await client
    .from("ob_connections")
    .update({ last_synced_at: new Date().toISOString(), status: "active" })
    .eq("id", connectionId);

  if (connError) {
    console.error(
      `Failed to update last_synced_at for connection ${connectionId}:`,
      connError,
    );
  }
}
