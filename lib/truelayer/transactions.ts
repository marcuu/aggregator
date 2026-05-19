import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { Transaction } from "@/lib/trajectory/types";

/** ob_transactions stores amounts in pounds; the engine works in pence. */
const RECENT_LIMIT = 2000;

/**
 * Load a user's synced transactions, shaped for the trajectory engine.
 *
 * Amounts are converted from the stored pounds (numeric) to integer pence,
 * and the missing category is normalised so the engine never sees null.
 * RLS scopes the result to the user when a cookie-based client is passed.
 */
export async function getTransactionsForUser(
  userId: string,
  client: SupabaseClient<Database>,
): Promise<Transaction[]> {
  const { data, error } = await client
    .from("ob_transactions")
    .select("id, amount, timestamp, category, description")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(RECENT_LIMIT);

  if (error || !data) return [];

  return data.map((t) => ({
    id: t.id,
    amount: Math.round(t.amount * 100),
    date: t.timestamp,
    category: t.category ?? "uncategorised",
    description: t.description ?? "",
  }));
}
