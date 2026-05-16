import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

/**
 * Banner shown when one or more bank connections have expired (consent
 * lapsed / refresh token rejected). Prompts the user to reconnect.
 */
export async function ConnectionAlert() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: expired } = await supabase
    .from("ob_connections")
    .select("id, institution_name")
    .eq("user_id", user.id)
    .eq("status", "expired");

  if (!expired || expired.length === 0) return null;

  const names = expired
    .map((c) => c.institution_name ?? "a bank")
    .join(", ");

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3 text-sm">
        <p className="text-amber-800">
          Your connection to {names} has expired. Reconnect to keep your data
          up to date.
        </p>
        <Link
          href="/dashboard/connect"
          className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
        >
          Reconnect
        </Link>
      </div>
    </div>
  );
}
