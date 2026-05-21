import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { calculateScores } from "@/lib/trajectory/scores";
import { rankActions } from "@/lib/trajectory/actions";
import { detectCollision } from "@/lib/trajectory/collision";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import type { Scores } from "@/lib/trajectory/types";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { UserProfileSchema } from "@/lib/validators/profile";
import { GoalSchema } from "@/lib/validators/goals";
import { generatePromptCards } from "@/lib/prompts/generator";
import { getFinancialState, attributeSavingsToGoals } from "@/lib/finance/state";
import { projectUserGoals, projectUserGoalsSolo } from "@/lib/usecases/trajectory";

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
    { data: accountRows },
    { data: connectionRows },
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
    supabase
      .from("ob_accounts")
      .select("id, display_name, account_type, currency, current_balance, connection_id")
      .eq("user_id", user.id)
      .order("display_name"),
    supabase
      .from("ob_connections")
      .select("id, institution_name")
      .eq("user_id", user.id),
  ]);

  if (!profileRow) {
    return NextResponse.json({ error: "no profile" }, { status: 404 });
  }

  const profile = UserProfileSchema.parse(profileRow);
  const goals = (goalRows ?? []).map((g) => GoalSchema.parse(g));
  const benchmarks = (benchmarkRows ?? []) as BenchmarkRow[];
  const transactions = await getTransactionsForUser(user.id, supabase);
  const asOfDate = new Date();

  // Single source of truth for "what is true now": balances → surplus →
  // saved-toward-goal attribution. Closes the goal-progress loop that used
  // to read a hardcoded saved_amount of 0.
  const financialState = await getFinancialState(user.id, supabase, asOfDate);
  const currentBalancePence = financialState.liquidBalance as number;
  const savedByGoal = attributeSavingsToGoals(goals, financialState);

  const goalTrajectories = projectUserGoals({
    profile,
    goals,
    transactions,
    benchmarks,
    savedByGoal,
    asOfDate,
  });

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

  const scores = calculateScores(profile, transactions, previousScores, currentBalancePence);

  // Collision is judged on solo windows (would the goals compete for the
  // surplus?), then the displayed numbers come from the allocated run.
  const soloTrajectories =
    goalTrajectories.length === 2
      ? projectUserGoalsSolo({
          profile,
          goals,
          transactions,
          benchmarks,
          savedByGoal,
          asOfDate,
        })
      : [];
  const collision =
    soloTrajectories.length === 2
      ? detectCollision(soloTrajectories[0], soloTrajectories[1])
      : null;

  const baseAge = goalTrajectories[0]?.trajectory.trajectoryAge ?? 0;
  const actions = rankActions(profile, goals, transactions, baseAge);

  const [{ data: snapshots }, { data: dismissedRows }] = await Promise.all([
    supabase
      .from("trajectory_snapshots")
      .select("goal_id, snapshot_date, trajectory_age, spending_score, growth_score, borrowing_score")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: true })
      .limit(SPARKLINE_WEEKS * Math.max(1, goalTrajectories.length)),
    supabase
      .from("dismissed_prompts")
      .select("prompt_id")
      .eq("user_id", user.id),
  ]);

  const dismissed = new Set((dismissedRows ?? []).map((d) => d.prompt_id));
  const promptCards = generatePromptCards({
    scores,
    goals: goalTrajectories.map((g) => ({
      type: g.goal.type,
      trajectoryAge: g.trajectory.trajectoryAge,
    })),
  }).filter((card) => !dismissed.has(card.id));

  const connectionById = new Map(
    (connectionRows ?? []).map((c) => [c.id, c.institution_name]),
  );
  const accounts = (accountRows ?? []).map((a) => ({
    id: a.id,
    display_name: a.display_name,
    account_type: a.account_type,
    currency: a.currency,
    current_balance: a.current_balance,
    institution_name: connectionById.get(a.connection_id) ?? null,
  }));

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
    promptCards,
    institutionCount: activeConnections ?? 0,
    truelayerExpired: (expiredConnections ?? 0) > 0,
    accounts,
  });
}
