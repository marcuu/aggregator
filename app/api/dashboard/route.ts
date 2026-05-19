import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { calculateTrajectoryAge } from "@/lib/trajectory/engine";
import { calculateScores } from "@/lib/trajectory/scores";
import { rankActions } from "@/lib/trajectory/actions";
import { detectCollision } from "@/lib/trajectory/collision";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import type { Scores } from "@/lib/trajectory/types";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { UserProfileSchema } from "@/lib/validators/profile";
import { GoalSchema, type Goal } from "@/lib/validators/goals";

/** Goal amounts are stored in pounds; the engine works in pence. */
function toEnginePence(goal: Goal): Goal {
  return {
    ...goal,
    target_amount: goal.target_amount * 100,
    saved_amount: goal.saved_amount * 100,
  };
}

/** Recent snapshots kept per goal for the home-screen sparkline. */
const SPARKLINE_WEEKS = 12;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const [
    { data: profileRow },
    { data: goalRows },
    { data: benchmarkRows },
    { data: lastSnapshot },
    { count: activeConnections },
    { count: expiredConnections },
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("salary_benchmarks")
      .select("sector, tier, age, salary_p25, salary_p50, salary_p75"),
    supabase
      .from("trajectory_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ob_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("ob_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
  ]);

  if (!profileRow) {
    return NextResponse.json({ error: "no profile" }, { status: 404 });
  }

  const profile = UserProfileSchema.parse(profileRow);
  const goals = (goalRows ?? []).map((g) => GoalSchema.parse(g));
  const benchmarks = (benchmarkRows ?? []) as BenchmarkRow[];
  const transactions = await getTransactionsForUser(user.id, supabase);
  const asOfDate = new Date();

  const goalTrajectories = goals.map((goal) => ({
    goal,
    trajectory: calculateTrajectoryAge(
      profile,
      toEnginePence(goal),
      transactions,
      benchmarks,
      asOfDate,
    ),
  }));

  const previousScores: Scores | null = lastSnapshot
    ? {
        spending: lastSnapshot.spending_score,
        growth: lastSnapshot.growth_score,
        borrowing: lastSnapshot.borrowing_score,
        spendingDelta: 0,
        growthDelta: 0,
        borrowingDelta: 0,
      }
    : null;

  const scores = calculateScores(profile, transactions, previousScores);

  const collision =
    goalTrajectories.length === 2
      ? detectCollision(goalTrajectories[0], goalTrajectories[1])
      : null;

  const baseAge = goalTrajectories[0]?.trajectory.trajectoryAge ?? 0;
  const actions = rankActions(profile, goals, transactions, baseAge);

  const { data: snapshots } = await supabase
    .from("trajectory_snapshots")
    .select("goal_id, snapshot_date, trajectory_age")
    .eq("user_id", user.id)
    .order("snapshot_date", { ascending: true })
    .limit(SPARKLINE_WEEKS * Math.max(1, goalTrajectories.length));

  return NextResponse.json({
    profile: {
      sector: profile.sector,
      trajectory_tier: profile.trajectory_tier,
    },
    scores,
    goals: goalTrajectories,
    actions: actions.slice(0, 3),
    actionsTotal: actions.length,
    collision,
    snapshots: snapshots ?? [],
    institutionCount: activeConnections ?? 0,
    truelayerExpired: (expiredConnections ?? 0) > 0,
  });
}
