import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrajectoryTimeline } from "@/components/trajectory/TrajectoryTimeline";

export const metadata = { title: "Timeline · Trajectory" };

export default async function TrajectoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_complete) redirect("/onboarding/1");

  return <TrajectoryTimeline />;
}
