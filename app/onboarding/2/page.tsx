import { redirect } from "next/navigation";

import { createClient, getRequestUserId } from "@/lib/supabase/server";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { TierSelector } from "@/components/onboarding/TierSelector";
import type { TrajectoryTier } from "@/lib/validators/profile";

const PREVIEW_AGES = [25, 28, 32];

export default async function Step2() {
  const userId = await getRequestUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("sector")
    .eq("user_id", userId)
    .maybeSingle();

  // Step 1 must be done first; the gate sends them there if not.
  if (!profile) redirect("/onboarding/1");

  const { data: benchmarks } = await supabase
    .from("salary_benchmarks")
    .select("tier, age, salary_p50")
    .eq("sector", profile.sector)
    .in("age", PREVIEW_AGES);

  const points = (benchmarks ?? []).map((b) => ({
    tier: b.tier as TrajectoryTier,
    age: b.age,
    salary_p50: b.salary_p50,
  }));

  return (
    <>
      <ProgressDots current={2} />
      <h1 className="mt-8 text-2xl font-medium">How fast are you moving?</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Pick the trajectory that matches your ambition. You can recalibrate
        later as the numbers come in.
      </p>

      <TierSelector benchmarks={points} />
    </>
  );
}
