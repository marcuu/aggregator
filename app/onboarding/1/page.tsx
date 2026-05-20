import { redirect } from "next/navigation";

import { createClient, getRequestUserId } from "@/lib/supabase/server";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { submitStep1 } from "../actions";

const SECTORS = [
  { value: "banking", label: "Banking & finance" },
  { value: "law", label: "Law" },
  { value: "stem", label: "STEM" },
  { value: "consulting", label: "Consulting" },
  { value: "other", label: "Other" },
];

const fieldClass =
  "mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2.5 text-[15px]";

export default async function Step1() {
  const userId = await getRequestUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("current_salary, sector")
    .eq("user_id", userId)
    .maybeSingle();

  return (
    <>
      <ProgressDots current={1} total={5} />
      <h1 className="mt-8 text-2xl font-medium">Where you&apos;re starting from</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Your salary and sector anchor every projection. Nothing here is shared.
      </p>

      <form action={submitStep1} className="mt-7 flex flex-col gap-5">
        <div>
          <label htmlFor="current_salary" className="text-[13px] font-medium">
            Current salary
          </label>
          <input
            id="current_salary"
            name="current_salary"
            type="number"
            inputMode="numeric"
            min={1}
            max={999999}
            required
            defaultValue={profile?.current_salary ?? ""}
            placeholder="42000"
            className={fieldClass}
            style={{ borderColor: "var(--border-subtle)" }}
          />
        </div>

        <div>
          <label htmlFor="sector" className="text-[13px] font-medium">
            Sector
          </label>
          <select
            id="sector"
            name="sector"
            required
            defaultValue={profile?.sector ?? ""}
            className={fieldClass}
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <option value="" disabled>
              Choose your sector
            </option>
            {SECTORS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
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
