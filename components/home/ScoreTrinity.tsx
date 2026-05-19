"use client";

import { useState } from "react";

import type { DashboardScores } from "@/lib/validators/dashboard";
import { Sheet } from "./Sheet";

type ScoreKey = "spending" | "growth" | "borrowing";

const META: Record<
  ScoreKey,
  { label: string; colour: string; blurb: string }
> = {
  spending: {
    label: "Spending",
    colour: "var(--score-spending)",
    blurb:
      "How your short-term, discretionary outflow compares to peers in your sector. Higher is leaner.",
  },
  growth: {
    label: "Growth",
    colour: "var(--score-growth)",
    blurb:
      "The trend in how much you put away each month. Higher means your savings rate is climbing.",
  },
  borrowing: {
    label: "Borrowing",
    colour: "var(--score-borrowing)",
    blurb:
      "Your debt load relative to income. Higher means more headroom and less liability.",
  },
};

const ARC_RADIUS = 28;
const ARC_LENGTH = Math.PI * ARC_RADIUS;
const ARC_PATH = "M 4 32 A 28 28 0 0 1 60 32";

export function ScoreTrinity({ scores }: { scores: DashboardScores }) {
  const [open, setOpen] = useState<ScoreKey | null>(null);

  const rows: { key: ScoreKey; value: number; delta: number }[] = [
    { key: "spending", value: scores.spending, delta: scores.spendingDelta },
    { key: "growth", value: scores.growth, delta: scores.growthDelta },
    { key: "borrowing", value: scores.borrowing, delta: scores.borrowingDelta },
  ];

  return (
    <section>
      <h2 className="section-label">Your scores</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <ScoreCard
            key={r.key}
            label={META[r.key].label}
            colour={META[r.key].colour}
            value={r.value}
            delta={r.delta}
            onClick={() => setOpen(r.key)}
          />
        ))}
      </div>

      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? META[open].label : undefined}
      >
        {open && (
          <ScoreDetail
            blurb={META[open].blurb}
            value={rows.find((r) => r.key === open)!.value}
            delta={rows.find((r) => r.key === open)!.delta}
          />
        )}
      </Sheet>
    </section>
  );
}

function ScoreCard({
  label,
  colour,
  value,
  delta,
  onClick,
}: {
  label: string;
  colour: string;
  value: number;
  delta: number;
  onClick: () => void;
}) {
  const fraction = Math.max(0, Math.min(100, value)) / 100;
  const offset = ARC_LENGTH * (1 - fraction);
  const theta = Math.PI * (1 - fraction);
  const dotX = 32 + ARC_RADIUS * Math.cos(theta);
  const dotY = 32 - ARC_RADIUS * Math.sin(theta);

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border p-3 text-center"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--surface-secondary)",
      }}
    >
      <svg viewBox="0 0 64 36" className="mx-auto w-full" aria-hidden="true">
        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d={ARC_PATH}
          fill="none"
          stroke={colour}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={offset}
        />
        <circle cx={dotX} cy={dotY} r="3.5" fill={colour} />
      </svg>
      <p className="text-xl font-medium tabular-nums">{value}</p>
      <p className="section-label">{label}</p>
      <DeltaBadge delta={delta} />
    </button>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        No change
      </p>
    );
  }
  const up = delta > 0;
  return (
    <p
      className="text-[11px] tabular-nums"
      style={{ color: up ? "var(--score-growth)" : "var(--score-spending)" }}
    >
      {up ? "+" : ""}
      {delta} this week
    </p>
  );
}

function ScoreDetail({
  blurb,
  value,
  delta,
}: {
  blurb: string;
  value: number;
  delta: number;
}) {
  return (
    <div className="mt-3">
      <p className="text-4xl font-medium tabular-nums">{value}</p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {delta === 0
          ? "Unchanged since last week."
          : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} since last week.`}
      </p>
      <p
        className="mt-4 text-[14px] leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {blurb}
      </p>
    </div>
  );
}
