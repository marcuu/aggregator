"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import type { Transaction } from "@/lib/trajectory/types";
import type { GoalType } from "@/lib/validators/goals";
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

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function submitStep1(formData: FormData) {
  const parsed = Step1Schema.parse({
    current_salary: formData.get("current_salary"),
    sector: formData.get("sector"),
  });

  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("trajectory_tier")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("user_profiles").upsert({
    user_id: user.id,
    current_salary: parsed.current_salary,
    sector: parsed.sector,
    trajectory_tier: existing?.trajectory_tier ?? "steady",
    onboarding_step: 2,
  });

  redirect("/onboarding/2");
}

export async function submitStep2(formData: FormData) {
  const parsed = Step2Schema.parse({
    trajectory_tier: formData.get("trajectory_tier"),
  });

  const { supabase, user } = await requireUser();

  await supabase
    .from("user_profiles")
    .update({ trajectory_tier: parsed.trajectory_tier, onboarding_step: 3 })
    .eq("user_id", user.id);

  redirect("/onboarding/3");
}

export async function submitStep3(formData: FormData) {
  const raw = String(formData.get("goal_types") ?? "")
    .split(",")
    .filter(Boolean);
  const parsed = Step3Schema.parse({ goal_types: raw });

  const { supabase, user } = await requireUser();

  await supabase
    .from("user_profiles")
    .update({ onboarding_step: 4 })
    .eq("user_id", user.id);

  redirect(`/onboarding/4?types=${parsed.goal_types.join(",")}`);
}

export async function submitStep4(formData: FormData) {
  const types = Step3Schema.parse({
    goal_types: String(formData.get("goal_types") ?? "")
      .split(",")
      .filter(Boolean),
  }).goal_types;

  const { supabase, user } = await requireUser();

  const goals: TablesInsert<"goals">[] = [];

  for (const type of types) {
    goals.push({
      user_id: user.id,
      ...(await buildGoal(type, formData, user.id, supabase)),
    });
  }

  // Replace any goals from a previous run so the unique / max-active
  // constraints cannot trip on a redo of onboarding.
  await supabase.from("goals").delete().eq("user_id", user.id);
  await supabase.from("goals").insert(goals);

  await supabase
    .from("user_profiles")
    .update({ onboarding_complete: true, onboarding_step: 5 })
    .eq("user_id", user.id);

  redirect("/onboarding/reveal");
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
      return {
        type: "wedding",
        target_amount: d.budget,
        rough_target_date: `${d.rough_year}-06-01`,
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
