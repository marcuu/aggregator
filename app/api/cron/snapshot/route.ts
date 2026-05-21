import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { calculateScores } from "@/lib/trajectory/scores";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { UserProfileSchema } from "@/lib/validators/profile";
import { GoalSchema } from "@/lib/validators/goals";
import { getFinancialState, attributeSavingsToGoals } from "@/lib/finance/state";
import { projectUserGoals } from "@/lib/usecases/trajectory";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Weekly trajectory snapshot (see vercel.json crons). For every onboarded
 * user it records one row per active goal, which powers the home-screen
 * sparklines and the week-on-week score deltas. Writes with the service
 * role; authenticated via the CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const asOfDate = new Date();
  const snapshotDate = asOfDate.toISOString().slice(0, 10);

  const [{ data: profileRows }, { data: benchmarkRows }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("onboarding_complete", true),
    supabase
      .from("salary_benchmarks")
      .select("sector, tier, age, salary_p25, salary_p50, salary_p75"),
  ]);

  const benchmarks = (benchmarkRows ?? []) as BenchmarkRow[];
  let snapshots = 0;

  for (const profileRow of profileRows ?? []) {
    const profile = UserProfileSchema.parse(profileRow);

    const { data: goalRows } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", profile.user_id)
      .eq("is_active", true);

    const goals = (goalRows ?? []).map((g) => GoalSchema.parse(g));
    const transactions = await getTransactionsForUser(
      profile.user_id,
      supabase,
    );

    // Derive current financial state once, then attribute to goals so the
    // snapshot records a real moving saved_amount — the sparkline and drift
    // detection had no signal while this was a constant 0.
    const financialState = await getFinancialState(
      profile.user_id,
      supabase,
      asOfDate,
    );
    const currentBalancePence = financialState.liquidBalance as number;
    const savedByGoal = attributeSavingsToGoals(goals, financialState);

    const scores = calculateScores(profile, transactions, null, currentBalancePence);

    const goalTrajectories = projectUserGoals({
      profile,
      goals,
      transactions,
      benchmarks,
      savedByGoal,
      asOfDate,
    });

    for (const { goal, trajectory } of goalTrajectories) {
      const projectedDate = new Date(asOfDate);
      projectedDate.setMonth(projectedDate.getMonth() + trajectory.monthsToGoal);
      const projectedTargetDate = projectedDate.toISOString().slice(0, 10);

      const [{ error }] = await Promise.all([
        supabase.from("trajectory_snapshots").upsert(
          {
            user_id: profile.user_id,
            goal_id: goal.id,
            snapshot_date: snapshotDate,
            trajectory_age: trajectory.trajectoryAge,
            monthly_surplus: trajectory.monthlySurplus,
            saved_amount: trajectory.savedAmount,
            spending_score: scores.spending,
            growth_score: scores.growth,
            borrowing_score: scores.borrowing,
          },
          { onConflict: "goal_id,snapshot_date" },
        ),
        supabase
          .from("goals")
          .update({ projected_target_date: projectedTargetDate })
          .eq("id", goal.id),
      ]);

      if (error) {
        console.error("Snapshot cron: upsert failed:", error);
      } else {
        snapshots += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    profiles: profileRows?.length ?? 0,
    snapshots,
  });
}
