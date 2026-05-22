"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  trajectoryAge: number;
  goalLabel: string;
  monthlySurplusPence: number;
  savedAmountPence: number;
  cohortPercentile: number | null;
};

const REVEAL_MS = 1200;

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/** Animates a number from 0 to its target with an ease-out curve. */
function useCountUp(target: number, durationMs: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function RevealScreen({
  trajectoryAge,
  goalLabel,
  monthlySurplusPence,
  savedAmountPence,
  cohortPercentile,
}: Props) {
  const animated = useCountUp(trajectoryAge, REVEAL_MS);

  return (
    <div className="mt-10 flex flex-1 flex-col">
      <p className="section-label">On your current trajectory</p>

      <p className="mt-6 text-[15px]" style={{ color: "var(--text-secondary)" }}>
        {goalLabel} at
      </p>
      <p
        className="mt-1 tabular-nums"
        style={{ fontSize: "72px", fontWeight: 500, lineHeight: 1 }}
        aria-label={`Age ${trajectoryAge.toFixed(1)}`}
      >
        {animated.toFixed(1)}
      </p>

      <div className="mt-8 grid grid-cols-3 gap-2.5">
        <StatCard label="Monthly savings" value={gbp.format(monthlySurplusPence / 100)} />
        <StatCard label="Saved so far" value={gbp.format(savedAmountPence / 100)} />
        <StatCard
          label="Cohort"
          value={cohortPercentile === null ? "—" : `${cohortPercentile}th`}
        />
      </div>

      <p
        className="mt-6 text-[14px] leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {cohortPercentile === null
          ? "We need a little more peer data before we can place you in your cohort. Your action plan is ready now."
          : `That puts you in the ${cohortPercentile}th percentile of your sector and trajectory tier.`}
      </p>

      <Link
        href="/"
        className="mt-auto rounded-lg px-4 py-3 text-center text-[15px] font-medium"
        style={{
          background: "var(--text-primary)",
          color: "var(--surface-primary)",
        }}
      >
        See my action plan
      </Link>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--surface-secondary)",
      }}
    >
      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p className="mt-1.5 text-[15px] font-medium tabular-nums">{value}</p>
    </div>
  );
}
