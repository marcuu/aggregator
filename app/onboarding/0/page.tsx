import { redirect } from "next/navigation";

import { createClient, getRequestUserId } from "@/lib/supabase/server";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { submitStep0 } from "../actions";

const fieldClass =
  "mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2.5 text-[15px]";

export default async function Step0() {
  const userId = await getRequestUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("date_of_birth")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setFullYear(now.getFullYear() - 18);
  const minDate = new Date(now);
  minDate.setFullYear(now.getFullYear() - 70);

  return (
    <>
      <ProgressDots current={1} total={6} />
      <h1 className="mt-8 text-2xl font-medium">Before we begin</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Your age shapes every projection — it tells us how long the runway is.
      </p>

      <form action={submitStep0} className="mt-7 flex flex-col gap-5">
        <div>
          <label htmlFor="date_of_birth" className="text-[13px] font-medium">
            Date of birth
          </label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            required
            defaultValue={profile?.date_of_birth ?? ""}
            min={minDate.toISOString().split("T")[0]}
            max={maxDate.toISOString().split("T")[0]}
            className={fieldClass}
            style={{ borderColor: "var(--border-subtle)" }}
          />
        </div>

        <button
          type="submit"
          className="rounded-lg px-4 py-3 text-[15px] font-medium"
          style={{
            background: "var(--text-primary)",
            color: "var(--surface-primary)",
          }}
        >
          Continue
        </button>
      </form>
    </>
  );
}
