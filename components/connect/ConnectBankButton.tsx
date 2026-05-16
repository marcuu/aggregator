import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

/**
 * Renders a "Connect a bank" call to action — but only when the user has no
 * active connection yet. Returns nothing once a bank is linked.
 */
export async function ConnectBankButton() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { count } = await supabase
    .from("ob_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if ((count ?? 0) > 0) return null;

  return (
    <Link
      href="/dashboard/connect"
      className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
    >
      Connect a bank account
    </Link>
  );
}
