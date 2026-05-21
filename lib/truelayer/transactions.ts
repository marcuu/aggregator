import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { Transaction } from "@/lib/trajectory/types";
import { reclassifyStoredCategory } from "./acl";
import { poundsToPence, pounds } from "@/lib/money";

const RECENT_LIMIT = 2000;

/**
 * Load a user's synced transactions, shaped for the trajectory engine.
 *
 * `ob_transactions.amount` is stored as pounds (numeric) and converted to
 * branded integer pence here. Categories are passed through the anti-
 * corruption layer as a safety net for legacy rows written before
 * sync-time normalisation existed — newer rows already hold domain values.
 * RLS scopes the result to the user when a cookie-based client is passed.
 */
export async function getTransactionsForUser(
  userId: string,
  client: SupabaseClient<Database>,
): Promise<Transaction[]> {
  const { data, error } = await client
    .from("ob_transactions")
    .select("id, amount, timestamp, category, description, merchant_name")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(RECENT_LIMIT);

  if (error || !data) return [];

  return data.map((t) => ({
    id: t.id,
    amount: poundsToPence(pounds(t.amount)),
    date: t.timestamp,
    category: reclassifyStoredCategory(
      t.category,
      t.description,
      t.merchant_name,
      t.amount,
    ),
    description: t.description ?? "",
  }));
}
