import { redirect } from "next/navigation";

import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { Step3Schema } from "@/lib/validators/onboarding";
import type { GoalType } from "@/lib/validators/goals";
import { submitStep4 } from "../actions";

const fieldClass =
  "mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2.5 text-[15px]";
const borderStyle = { borderColor: "var(--border-subtle)" };

const GOAL_TITLES: Record<GoalType, string> = {
  home: "First home",
  wedding: "Wedding",
  emergency_fund: "Emergency fund",
  invest_start: "Start investing",
};

const CURRENT_YEAR = 2026;

export default async function Step4({
  searchParams,
}: {
  searchParams: Promise<{ types?: string }>;
}) {
  const { types: raw } = await searchParams;
  const parsed = Step3Schema.safeParse({
    goal_types: String(raw ?? "")
      .split(",")
      .filter(Boolean),
  });

  // Without a valid selection there is nothing to detail — send them back.
  if (!parsed.success) redirect("/onboarding/3");
  const types = parsed.data.goal_types;

  return (
    <>
      <ProgressDots current={4} />
      <h1 className="mt-8 text-2xl font-medium">The detail that matters</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        A few specifics per goal so the projection is yours, not an average.
      </p>

      <form action={submitStep4} className="mt-7 flex flex-col gap-6">
        <input type="hidden" name="goal_types" value={types.join(",")} />

        {types.map((type) => (
          <fieldset
            key={type}
            className="rounded-xl border p-4"
            style={borderStyle}
          >
            <legend className="px-1 text-[13px] font-medium">
              {GOAL_TITLES[type]}
            </legend>
            <div className="mt-2 flex flex-col gap-4">
              <GoalFields type={type} />
            </div>
          </fieldset>
        ))}

        <button
          type="submit"
          className="rounded-lg px-4 py-3 text-[15px] font-medium"
          style={{
            background: "var(--text-primary)",
            color: "var(--surface-primary)",
          }}
        >
          Reveal my trajectory
        </button>
      </form>
    </>
  );
}

function GoalFields({ type }: { type: GoalType }) {
  switch (type) {
    case "home":
      return (
        <>
          <TextField
            name="home__target_region"
            label="Target region"
            placeholder="Manchester"
          />
          <NumberField
            name="home__target_amount"
            label="Target property value (£)"
            placeholder="320000"
          />
          <RadioGroup
            name="home__deposit_pct"
            label="Deposit"
            options={[
              { value: "10", label: "10%" },
              { value: "15", label: "15%" },
              { value: "20", label: "20%" },
            ]}
            defaultValue="15"
          />
        </>
      );
    case "wedding":
      return (
        <>
          <NumberField
            name="wedding__budget"
            label="Budget (£)"
            placeholder="25000"
          />
          <NumberField
            name="wedding__rough_year"
            label="Rough year"
            placeholder={String(CURRENT_YEAR + 3)}
            min={CURRENT_YEAR}
            max={CURRENT_YEAR + 15}
          />
        </>
      );
    case "emergency_fund":
      return (
        <RadioGroup
          name="emergency_fund__months"
          label="Months of runway"
          options={[
            { value: "3", label: "3 months" },
            { value: "6", label: "6 months" },
            { value: "12", label: "12 months" },
          ]}
          defaultValue="6"
        />
      );
    case "invest_start":
      return (
        <NumberField
          name="invest_start__monthly_contribution"
          label="Monthly contribution (£)"
          placeholder="400"
        />
      );
  }
}

function TextField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-[13px] font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        required
        maxLength={120}
        placeholder={placeholder}
        className={fieldClass}
        style={borderStyle}
      />
    </div>
  );
}

function NumberField({
  name,
  label,
  placeholder,
  min = 1,
  max,
}: {
  name: string;
  label: string;
  placeholder: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-[13px] font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        required
        min={min}
        max={max}
        placeholder={placeholder}
        className={fieldClass}
        style={borderStyle}
      />
    </div>
  );
}

function RadioGroup({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium">{label}</p>
      <div className="mt-1.5 flex gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[14px]"
            style={borderStyle}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              defaultChecked={opt.value === defaultValue}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
