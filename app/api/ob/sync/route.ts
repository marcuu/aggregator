import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { syncUser } from "@/lib/truelayer/sync";

/**
 * Manually triggers a sync for the signed-in user. Auth-gated by the
 * Supabase session — the user can only ever sync their own data.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await syncUser(user.id, supabase);
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error(`Manual sync failed for user ${user.id}:`, error);
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
}
