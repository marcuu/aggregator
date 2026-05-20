"use server";

import { redirect } from "next/navigation";

import { createClient, getRequestUserId } from "@/lib/supabase/server";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { calculateTrajectoryAge } from "@/lib/trajectory/engine";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import type { Transaction } from "@/lib/trajectory/types";
import type { GoalType } from "@/lib/validators/goals";
import { UserProfileSchema } from "@/lib/validators/profile";
import type { TablesInsert } from "@/types/database";
import {
  EmergencyFundDetailsSchema,
  HomeDetailsSchema,
  InvestStartDetailsSchema,
  Step1Schema,
  Step2Schema,
  Step3Schema,
  WeddingDetailsSchema,
} from "@/lib/validators/onboarding";

/** Months of transaction history used to size an emergency fund. */
const EXPENSES_WINDOW_DAYS = 90;
/** Fallback monthly expenses (pounds) when there is no transaction history. */
const DEFAULT_MONTHLY_EXPENSES = 1500;

/**
 * Resolves the authenticated user from the middleware-set header — no auth
 * round-trip. The cookie-scoped client still carries the JWT, so RLS is
 * enforced on every query below.
 */
async function requireUser() {
  const userId = await getRequestUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  return { supabase, userId };
}

export async function submitStep1(formData: FormData) {
  const parsed = Step1Schema.parse({
    current_salary: formData.get("current_salary"),
    sector: formData.get("sector"),
  });

  const { supabase, userId } = await requireUser();

  // trajectory_tier is set for real on step 2, which always follows — a
  // placeholder here avoids a read-back to preserve an existing value.
  await supabase.from("user_profiles").upsert({
    user_id: userId,
    current_salary: parsed.current_salary,
    sector: parsed.sector,
    trajectory_tier: "steady",
    onboarding_step: 2,
  });

  redirect("/onboarding/2");
}

export async function submitStep2(formData: FormData) {
  const parsed = Step2Schema.parse({
    trajectory_tier: formData.get("trajectory_tier"),
  });

  const { supabase, userId } = await requireUser();

  await supabase
    .from("user_profiles")
    .update({ trajectory_tier: parsed.trajectory_tier, onboarding_step: 3 })
    .eq("user_id", userId);

  redirect("/onboarding/3");
}

export async function submitStep3(formData: FormData) {
  const raw = String(formData.get("goal_types") ?? "")
    .split(",")
    .filter(Boolean);
  const parsed = Step3Schema.parse({ goal_types: raw });

  const { supabase, userId } = await requireUser();

  await supabase
    .from("user_profiles")
    .update({ onboarding_step: 4 })
    .eq("user_id", userId);

  redirect(`/onboarding/4?types=${parsed.goal_types.join(",")}`);
}

export async function submitStep4(formData: FormData) {
  const types = Step3Schema.parse({
    goal_types: String(formData.get("goal_types") ?? "")
      .split(",")
      .filter(Boolean),
  }).goal_types;

  const { supabase, userId } = await requireUser();

  const goals: TablesInsert<"goals">[] = [];

  for (const type of types) {
    goals.push({
      user_id: userId,
      ...(await buildGoal(type, formData, userId, supabase)),
    });
  }

  // Compute a realistic rough_target_date for each goal from the trajectory
  // engine so the date reflects what the user can actually afford.
  const asOfDate = new Date();
  const [{ data: profileRow }, { data: benchmarkRows }, transactions] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("salary_benchmarks")
        .select("sector, tier, age, salary_p25, salary_p50, salary_p75"),
      getTransactionsForUser(userId!, supabase),
    ]);

  if (profileRow) {
    const profile = UserProfileSchema.parse(profileRow);
    const benchmarks = (benchmarkRows ?? []) as BenchmarkRow[];

    for (const goal of goals) {
      // Engine expects pence; the DB (and insert) stores whole pounds.
      const goalForEngine = {
        id: "00000000-0000-0000-0000-000000000000",
        user_id: userId,
        type: goal.type,
        target_amount: (goal.target_amount ?? 0) * 100,
        saved_amount: 0,
        deposit_pct: goal.deposit_pct ?? null,
        target_region: goal.target_region ?? null,
        rough_target_date: null,
        is_active: true,
      };

      const { monthsToGoal } = calculateTrajectoryAge(
        profile,
        goalForEngine,
        transactions,
        benchmarks,
        asOfDate,
      );

      if (monthsToGoal > 0) {
        const targetDate = new Date(asOfDate);
        targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
        goal.rough_target_date = targetDate.toISOString().slice(0, 10);
      }
    }
  }

  // Replace any goals from a previous run so the unique / max-active
  // constraints cannot trip on a redo of onboarding.
  await supabase.from("goals").delete().eq("user_id", userId);
  await supabase.from("goals").insert(goals);

  await supabase
    .from("user_profiles")
    .update({ onboarding_complete: true, onboarding_step: 5 })
    .eq("user_id", userId);

  redirect("/onboarding/ob");
}

type GoalFields = Omit<TablesInsert<"goals">, "user_id">;

async function buildGoal(
  type: GoalType,
  formData: FormData,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<GoalFields> {
  switch (type) {
    case "home": {
      const d = HomeDetailsSchema.parse({
        target_region: formData.get("home__target_region"),
        target_amount: formData.get("home__target_amount"),
        deposit_pct: formData.get("home__deposit_pct"),
      });
      return {
        type: "home",
        target_amount: d.target_amount,
        target_region: d.target_region,
        deposit_pct: d.deposit_pct,
      };
    }
    case "wedding": {
      const d = WeddingDetailsSchema.parse({
        budget: formData.get("wedding__budget"),
        rough_year: formData.get("wedding__rough_year"),
      });
      // rough_target_date is overwritten by the trajectory calculation in
      // submitStep4; the user's rough_year is ignored in favour of the date
      // they are actually on track to afford it.
      return {
        type: "wedding",
        target_amount: d.budget,
      };
    }
    case "emergency_fund": {
      const d = EmergencyFundDetailsSchema.parse({
        months: formData.get("emergency_fund__months"),
      });
      const monthlyExpenses = await estimateMonthlyExpenses(userId, supabase);
      return {
        type: "emergency_fund",
        target_amount: d.months * monthlyExpenses,
      };
    }
    case "invest_start": {
      const d = InvestStartDetailsSchema.parse({
        monthly_contribution: formData.get("invest_start__monthly_contribution"),
      });
      return {
        type: "invest_start",
        target_amount: d.monthly_contribution * 12,
      };
    }
  }
}

/** Average monthly spend in whole pounds over the recent window. */
async function estimateMonthlyExpenses(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  const transactions = await getTransactionsForUser(userId, supabase);
  if (transactions.length === 0) return DEFAULT_MONTHLY_EXPENSES;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - EXPENSES_WINDOW_DAYS);

  const recentSpendPence = transactions
    .filter((t: Transaction) => {
      const d = new Date(t.date);
      return d >= cutoff && d <= now && t.amount < 0 && t.category !== "transfer";
    })
    .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

  const monthlyPounds = Math.round(
    recentSpendPence / 100 / (EXPENSES_WINDOW_DAYS / 30),
  );
  return monthlyPounds > 0 ? monthlyPounds : DEFAULT_MONTHLY_EXPENSES;
}
