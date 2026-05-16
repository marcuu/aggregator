import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { syncUser } from "@/lib/truelayer/sync";

/** Resync connections not refreshed within this window. */
const STALE_AFTER_HOURS = 6;
/** Max concurrent user syncs to avoid hammering TrueLayer. */
const CONCURRENCY = 3;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Scheduled fallback sync (see vercel.json crons). Resyncs every active
 * connection whose data has gone stale. Authenticated via the CRON_SECRET
 * bearer token Vercel attaches to cron invocations.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const staleBefore = new Date(
    Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: connections, error } = await supabase
    .from("ob_connections")
    .select("user_id, last_synced_at")
    .eq("status", "active")
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`);

  if (error) {
    console.error("Cron: failed to list stale connections:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // Distinct users — one sync covers all of a user's accounts.
  const userIds = [...new Set((connections ?? []).map((c) => c.user_id))];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const batch = userIds.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((userId) => syncUser(userId, supabase)),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        succeeded += 1;
      } else {
        failed += 1;
        console.error("Cron: user sync failed:", result.reason);
      }
    }
  }

  return NextResponse.json({ ok: true, total: userIds.length, succeeded, failed });
}
