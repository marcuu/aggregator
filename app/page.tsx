import { redirect } from "next/navigation";

import { createClient, getRequestUserId } from "@/lib/supabase/server";
import { HomeScreen } from "@/components/home/HomeScreen";

/** The trajectory home screen. Onboarding-gated, unauthenticated → login. */
export default async function Home() {
  const userId = await getRequestUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_complete, onboarding_step")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile || !profile.onboarding_complete) {
    const step = Math.min(4, Math.max(1, profile?.onboarding_step ?? 1));
    redirect(`/onboarding/${step}`);
  }

  return <HomeScreen />;
}
