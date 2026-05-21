import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildTrajectoryTimeline } from "@/lib/trajectory/timeline";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { UserProfileSchema } from "@/lib/validators/profile";
import { GoalSchema, type Goal } from "@/lib/validators/goals";
import { getFinancialState, attributeSavingsToGoals } from "@/lib/finance/state";

/** Goal amounts are stored in pounds; the timeline engine works in pence. */
function toEnginePence(goal: Goal): Goal {
  return {
    ...goal,
    target_amount: goal.target_amount * 100,
    saved_amount: goal.saved_amount * 100,
  };
}

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
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("goals").select("*").eq("user_id", user.id).eq("is_active", true),
    supabase.from("salary_benchmarks").select("sector, tier, age, salary_p25, salary_p50, salary_p75"),
  ]);

  if (!profileRow) {
    return NextResponse.json({ error: "no profile" }, { status: 404 });
  }

  const profile = UserProfileSchema.parse(profileRow);
  const goals = (goalRows ?? []).map((g) => GoalSchema.parse(g));
  const benchmarks = (benchmarkRows ?? []) as BenchmarkRow[];
  const transactions = await getTransactionsForUser(user.id, supabase);
  const asOfDate = new Date();

  // Derive saved-toward-goal from synced balances (pence) and key it by id,
  // so the chart starts from real money instead of a hardcoded zero.
  const financialState = await getFinancialState(user.id, supabase, asOfDate);
  const savedByGoal = attributeSavingsToGoals(goals, financialState);

  const data = buildTrajectoryTimeline(
    profile,
    goals.map(toEnginePence),
    transactions,
    benchmarks,
    asOfDate,
    savedByGoal,
  );

  return NextResponse.json(data);
}
