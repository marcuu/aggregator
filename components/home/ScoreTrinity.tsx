"use client";

import { useState } from "react";

import type {
  DashboardScores,
  DashboardSnapshot,
  SpendingBreakdown,
  GrowthBreakdown,
  BorrowingBreakdown,
} from "@/lib/validators/dashboard";
import { Sheet } from "./Sheet";

type ScoreKey = "spending" | "growth" | "borrowing";

// ── Static metadata ───────────────────────────────────────────────────────────

const META: Record<ScoreKey, { label: string; colour: string; blurb: string }> = {
  spending: {
    label: "Spending",
    colour: "var(--score-spending)",
    blurb:
      "How well your outgoings fit the 50/30 rule — 50% on essentials, 30% on discretionary. Higher means more room to save.",
  },
  growth: {
    label: "Growth",
    colour: "var(--score-growth)",
    blurb:
      "The combined strength of your savings rate, trend, emergency cushion, and investment habit. Higher means you're building wealth faster.",
  },
  borrowing: {
    label: "Borrowing",
    colour: "var(--score-borrowing)",
    blurb:
      "Your debt load and repayment health relative to income and savings. Higher means more financial headroom.",
  },
};

type SubMeta = { label: string; description: string };

const SPENDING_SUBS: Record<keyof SpendingBreakdown, SubMeta> = {
  essentialRatio: {
    label: "Essential spend",
    description: "Rent, utilities, groceries and transport as a share of income. Target ≤50%.",
  },
  discretionaryRatio: {
    label: "Discretionary spend",
    description: "Dining, entertainment, shopping and travel vs income. Target ≤30%.",
  },
  consistency: {
    label: "Monthly consistency",
    description: "How stable your total spend is month to month. Lower variance scores higher.",
  },
  velocity: {
    label: "Spend distribution",
    description: "Whether your discretionary spend is evenly spread across the month.",
  },
};

const GROWTH_SUBS: Record<keyof GrowthBreakdown, SubMeta> = {
  savingsRate: {
    label: "Savings rate",
    description: "The fraction of income you keep each month. Target ≥20%.",
  },
  savingsTrend: {
    label: "Savings trend",
    description: "Whether your savings rate is improving compared to last month.",
  },
  emergencyBuffer: {
    label: "Emergency buffer",
    description: "Liquid savings relative to monthly expenses. Target ≥3 months.",
  },
  investmentAllocation: {
    label: "Investments",
    description: "Pension and investment contributions as a share of income. Target ≥10%.",
  },
};

const BORROWING_SUBS: Record<keyof BorrowingBreakdown, SubMeta> = {
  debtServiceRatio: {
    label: "Debt payments",
    description: "Loan repayments as a share of income. Target ≤20%.",
  },
  debtTrajectory: {
    label: "Debt trend",
    description: "Whether your debt burden is shrinking over time.",
  },
  repaymentConsistency: {
    label: "Payment reliability",
    description: "How regularly loan repayments appear each month.",
  },
  debtToBalance: {
    label: "Debt vs savings",
    description: "Monthly repayments relative to your total liquid balance.",
  },
};

const SCORE_HISTORY_KEY: Record<ScoreKey, keyof DashboardSnapshot> = {
  spending: "spending_score",
  growth: "growth_score",
  borrowing: "borrowing_score",
};

// ── Arc gauge constants ───────────────────────────────────────────────────────

const ARC_RADIUS = 28;
const ARC_LENGTH = Math.PI * ARC_RADIUS;
const ARC_PATH = "M 4 32 A 28 28 0 0 1 60 32";

// ── Main component ────────────────────────────────────────────────────────────

export function ScoreTrinity({
  scores,
  snapshots,
}: {
  scores: DashboardScores;
  snapshots: DashboardSnapshot[];
}) {
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
            scoreKey={open}
            value={rows.find((r) => r.key === open)!.value}
            delta={rows.find((r) => r.key === open)!.delta}
            colour={META[open].colour}
            blurb={META[open].blurb}
            breakdown={
              open === "spending"
                ? scores.spendingBreakdown
                : open === "growth"
                  ? scores.growthBreakdown
                  : scores.borrowingBreakdown
            }
            snapshots={snapshots}
          />
        )}
      </Sheet>
    </section>
  );
}

// ── Score card (home screen tile) ─────────────────────────────────────────────

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

// ── Score detail (sheet content) ──────────────────────────────────────────────

function ScoreDetail({
  scoreKey,
  value,
  delta,
  colour,
  blurb,
  breakdown,
  snapshots,
}: {
  scoreKey: ScoreKey;
  value: number;
  delta: number;
  colour: string;
  blurb: string;
  breakdown: SpendingBreakdown | GrowthBreakdown | BorrowingBreakdown | undefined;
  snapshots: DashboardSnapshot[];
}) {
  const historyKey = SCORE_HISTORY_KEY[scoreKey];
  const history = dedupeByDate(snapshots)
    .map((s) => s[historyKey])
    .filter((v): v is number => typeof v === "number");

  return (
    <div
      className="mt-3 overflow-y-auto"
      style={{ maxHeight: "calc(80dvh - 100px)" }}
    >
      {/* Macro score + delta */}
      <div className="flex items-baseline gap-3">
        <p
          className="tabular-nums"
          style={{ fontSize: "40px", fontWeight: 500, lineHeight: 1 }}
        >
          {value}
        </p>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {delta === 0
            ? "Unchanged since last week"
            : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} since last week`}
        </p>
      </div>

      {/* Score trend chart */}
      {history.length >= 2 ? (
        <div className="mt-5">
          <p className="section-label">Score trend</p>
          <div className="mt-2">
            <ScoreTrendChart points={history} colour={colour} />
            <div className="mt-1 flex justify-between">
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {history.length}w ago
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                Now
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p
          className="mt-4 text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Trend available after your first weekly snapshot.
        </p>
      )}

      {/* Sub-score breakdown */}
      {breakdown && (
        <div className="mt-6">
          <p className="section-label">What drives this score</p>
          <div className="mt-3 flex flex-col gap-4">
            {scoreKey === "spending" &&
              (Object.keys(SPENDING_SUBS) as (keyof SpendingBreakdown)[]).map((k) => (
                <SubScoreRow
                  key={k}
                  label={SPENDING_SUBS[k].label}
                  description={SPENDING_SUBS[k].description}
                  score={(breakdown as SpendingBreakdown)[k]}
                  colour={colour}
                />
              ))}
            {scoreKey === "growth" &&
              (Object.keys(GROWTH_SUBS) as (keyof GrowthBreakdown)[]).map((k) => (
                <SubScoreRow
                  key={k}
                  label={GROWTH_SUBS[k].label}
                  description={GROWTH_SUBS[k].description}
                  score={(breakdown as GrowthBreakdown)[k]}
                  colour={colour}
                />
              ))}
            {scoreKey === "borrowing" &&
              (Object.keys(BORROWING_SUBS) as (keyof BorrowingBreakdown)[]).map((k) => (
                <SubScoreRow
                  key={k}
                  label={BORROWING_SUBS[k].label}
                  description={BORROWING_SUBS[k].description}
                  score={(breakdown as BorrowingBreakdown)[k]}
                  colour={colour}
                />
              ))}
          </div>
        </div>
      )}

      {/* Blurb */}
      <div className="mt-6 pb-2">
        <p className="section-label">About</p>
        <p
          className="mt-2 text-[14px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {blurb}
        </p>
      </div>
    </div>
  );
}

// ── Sub-score row ─────────────────────────────────────────────────────────────

function SubScoreRow({
  label,
  description,
  score,
  colour,
}: {
  label: string;
  description: string;
  score: number;
  colour: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[13px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {score}
        </p>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--border-subtle)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            background: colour,
            opacity: 0.85,
          }}
        />
      </div>
      <p
        className="mt-1 text-[11px] leading-snug"
        style={{ color: "var(--text-tertiary)" }}
      >
        {description}
      </p>
    </div>
  );
}

// ── Trend sparkline ───────────────────────────────────────────────────────────

function ScoreTrendChart({
  points,
  colour,
}: {
  points: number[];
  colour: string;
}) {
  const W = 300;
  const H = 56;
  const PAD = 4;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (W - PAD * 2) + PAD;
    const y = H - PAD - ((p - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Terminal dot position
  const lastCoord = coords[coords.length - 1].split(",");
  const dotX = parseFloat(lastCoord[0]);
  const dotY = parseFloat(lastCoord[1]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ height: "56px" }}
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={colour}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <circle cx={dotX} cy={dotY} r="3" fill={colour} />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dedupeByDate(snapshots: DashboardSnapshot[]): DashboardSnapshot[] {
  const seen = new Set<string>();
  return snapshots
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .filter((s) => {
      if (seen.has(s.snapshot_date)) return false;
      seen.add(s.snapshot_date);
      return true;
    });
}
