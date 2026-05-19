"use client";

import { useState } from "react";

import { submitStep2 } from "@/app/onboarding/actions";
import type { TrajectoryTier } from "@/lib/validators/profile";

type BenchmarkPoint = {
  tier: TrajectoryTier;
  age: number;
  salary_p50: number;
};

const TIERS: { id: TrajectoryTier; label: string; blurb: string }[] = [
  { id: "steady", label: "Steady", blurb: "Tracking the sector median" },
  { id: "fast", label: "Fast", blurb: "Top quartile of your peers" },
  { id: "high", label: "High", blurb: "Top decile — partner / VP track" },
];

const PREVIEW_AGES = [25, 28, 32];

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function TierSelector({
  benchmarks,
}: {
  benchmarks: BenchmarkPoint[];
}) {
  const [tier, setTier] = useState<TrajectoryTier>("steady");

  const salaryAt = (age: number) =>
    benchmarks.find((b) => b.tier === tier && b.age === age)?.salary_p50 ?? null;

  return (
    <form action={submitStep2} className="mt-7 flex flex-col gap-5">
      <input type="hidden" name="trajectory_tier" value={tier} />

      <div className="flex flex-col gap-2.5">
        {TIERS.map((t) => {
          const selected = t.id === tier;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTier(t.id)}
              aria-pressed={selected}
              className="flex items-center justify-between rounded-xl border p-4 text-left transition-colors"
              style={{
                borderColor: selected
                  ? "var(--text-primary)"
                  : "var(--border-subtle)",
                background: selected
                  ? "var(--surface-secondary)"
                  : "var(--surface-primary)",
              }}
            >
              <span>
                <span className="block text-[15px] font-medium">
                  {t.label}
                </span>
                <span
                  className="block text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t.blurb}
                </span>
              </span>
              <i
                className={selected ? "ti ti-circle-check" : "ti ti-circle"}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-secondary)",
        }}
      >
        <p className="section-label">Projected salary</p>
        <div className="mt-3 flex justify-between">
          {PREVIEW_AGES.map((age) => {
            const salary = salaryAt(age);
            return (
              <div key={age} className="text-center">
                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Age {age}
                </p>
                <p className="mt-1 text-[15px] font-medium">
                  {salary === null ? "—" : gbp.format(salary)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <SubmitButton>Continue</SubmitButton>
    </form>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-lg px-4 py-3 text-[15px] font-medium"
      style={{
        background: "var(--text-primary)",
        color: "var(--surface-primary)",
      }}
    >
      {children}
    </button>
  );
}
