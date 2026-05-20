"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  TrajectoryTimelineResponseSchema,
  type TrajectoryTimelineResponse,
  type TimelinePoint,
  type GoalMilestone,
} from "@/lib/validators/trajectory";
import { TimelineChart, type ScrubPoint } from "./TimelineChart";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: TrajectoryTimelineResponse };

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function fmt(pence: number) {
  return gbp.format(pence / 100);
}

// ─── Scrub display card ────────────────────────────────────────────────────

function ScrubCard({
  point,
  hasDebt,
  isDefault,
}: {
  point: TimelinePoint;
  hasDebt: boolean;
  isDefault: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--surface-secondary)" }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[22px] font-semibold tabular-nums leading-none">
          Age {Math.floor(point.age)}
        </p>
        <p
          className="text-[13px] tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          {point.year}
          {isDefault && (
            <span className="ml-1.5 text-[11px]">← drag to explore</span>
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <ScrubStat
          label="Savings"
          value={fmt(point.cumulativeSavings)}
          color="var(--score-growth)"
        />
        <ScrubStat
          label="Income"
          value={fmt(point.annualSalary) + "/yr"}
          color="var(--score-borrowing)"
        />
        {hasDebt ? (
          <ScrubStat
            label="Debt"
            value={point.debtBalance > 100 ? fmt(point.debtBalance) : "Cleared"}
            color={
              point.debtBalance > 100
                ? "var(--score-spending)"
                : "var(--score-growth)"
            }
          />
        ) : (
          <ScrubStat
            label="Surplus"
            value=""
            color="var(--text-tertiary)"
            dim
          />
        )}
      </div>
    </div>
  );
}

function ScrubStat({
  label,
  value,
  color,
  dim,
}: {
  label: string;
  value: string;
  color: string;
  dim?: boolean;
}) {
  return (
    <div>
      <p className="section-label">{label}</p>
      <p
        className="mt-1 text-[14px] font-semibold tabular-nums leading-snug"
        style={{ color: dim ? "var(--text-tertiary)" : color, opacity: dim ? 0.4 : 1 }}
      >
        {value || "—"}
      </p>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────

function Legend({
  hasDebt,
}: {
  hasDebt: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <LegendItem color="var(--score-growth)" label="Savings" solid />
      <LegendItem color="var(--score-borrowing)" label="Income" />
      {hasDebt && <LegendItem color="var(--score-spending)" label="Debt" solid />}
    </div>
  );
}

function LegendItem({
  color,
  label,
  solid,
}: {
  color: string;
  label: string;
  solid?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {solid ? (
        <span
          className="inline-block h-2 w-4 rounded-full"
          style={{ background: color, opacity: 0.7 }}
        />
      ) : (
        <svg width={16} height={8} aria-hidden="true">
          <line
            x1={0}
            y1={4}
            x2={16}
            y2={4}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="5 2"
          />
        </svg>
      )}
      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Milestones list ────────────────────────────────────────────────────────

function MilestoneList({ milestones }: { milestones: GoalMilestone[] }) {
  if (milestones.length === 0) return null;
  return (
    <section>
      <h2 className="section-label">Goal milestones</h2>
      <div
        className="mt-3 overflow-hidden rounded-xl"
        style={{ background: "var(--surface-secondary)" }}
      >
        {milestones.map((m: GoalMilestone, i: number) => (
          <div
            key={m.goalId}
            className="flex items-center justify-between px-4 py-3"
            style={
              i < milestones.length - 1
                ? { borderBottom: "1px solid var(--border-subtle)" }
                : undefined
            }
          >
            <div>
              <p className="text-[13px] font-medium">{m.label}</p>
              <p
                className="text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Age {m.age.toFixed(1)} · {m.year}
              </p>
            </div>
            <p
              className="text-[13px] font-semibold tabular-nums"
              style={{ color: "var(--score-spending)" }}
            >
              −{fmt(m.amount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Income projection table ────────────────────────────────────────────────

function IncomeTable({ points }: { points: TimelinePoint[] }) {
  const startYear = points[0]?.year ?? new Date().getFullYear();
  const rows = points.filter((p) => (p.year - startYear) % 5 === 0);
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "var(--surface-secondary)" }}
    >
      {rows.map((p, i) => (
        <div
          key={p.year}
          className="flex items-center justify-between px-4 py-3"
          style={
            i < rows.length - 1
              ? { borderBottom: "1px solid var(--border-subtle)" }
              : undefined
          }
        >
          <div>
            <p className="text-[13px] font-medium">{p.year}</p>
            <p
              className="text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Age {Math.floor(p.age)}
            </p>
          </div>
          <p
            className="text-[14px] font-semibold tabular-nums"
            style={{ color: "var(--score-borrowing)" }}
          >
            {fmt(p.annualSalary)}
            <span
              className="ml-1 text-[11px] font-normal"
              style={{ color: "var(--text-tertiary)" }}
            >
              /yr
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export function TrajectoryTimeline() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trajectory")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const parsed = TrajectoryTimelineResponseSchema.safeParse(json);
        setState(
          parsed.success
            ? { status: "ready", data: parsed.data }
            : { status: "error" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-5 px-5 pb-12 pt-7">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[22px] font-medium">Timeline</p>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Your financial projection
          </p>
        </div>
        <Link
          href="/"
          className="text-[13px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          ← Back
        </Link>
      </header>

      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && <ErrorState />}
      {state.status === "ready" && <ReadyContent data={state.data} />}
    </main>
  );
}

function ReadyContent({ data }: { data: TrajectoryTimelineResponse }) {
  // Ref + ResizeObserver live here so they initialise once the chart
  // container is actually mounted (i.e. after the data has loaded).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // Callback ref: fires when the element mounts and when it unmounts.
  // This is more reliable than a useEffect against a useRef, because
  // the effect ordering can miss the initial attach.
  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    if (!el) return;
    // Set an initial width synchronously so the chart can render on first paint.
    const w = el.getBoundingClientRect().width;
    if (w > 0) setChartWidth(w);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setChartWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScrub = useCallback((s: ScrubPoint | null) => {
    setScrubIndex(s ? s.index : null);
  }, []);

  // When not scrubbing, show the horizon point (last in the array).
  const displayIndex =
    scrubIndex !== null ? scrubIndex : data.points.length - 1;
  const displayPoint = data.points[displayIndex];
  const isDefault = scrubIndex === null;

  return (
    <>
      {/* Scrub card — updates as user drags */}
      {displayPoint && (
        <ScrubCard
          point={displayPoint}
          hasDebt={data.hasDebt}
          isDefault={isDefault}
        />
      )}

      {/* Chart */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="section-label">Trajectory</h2>
          <Legend hasDebt={data.hasDebt} />
        </div>
        <div
          ref={setContainer}
          className="mt-3 overflow-hidden rounded-xl px-4 pb-3 pt-4"
          style={{ background: "var(--surface-secondary)" }}
        >
          {chartWidth > 0 && (
            <TimelineChart
              points={data.points}
              milestones={data.milestones}
              hasDebt={data.hasDebt}
              width={chartWidth - 32}
              onScrub={handleScrub}
              scrubIndex={scrubIndex}
            />
          )}
        </div>
      </section>

      <MilestoneList milestones={data.milestones} />

      {/* Income growth */}
      <section>
        <h2 className="section-label">Income growth</h2>
        <p
          className="mb-3 mt-1 text-[12px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Projected salary based on your sector and trajectory tier.
        </p>
        <IncomeTable points={data.points} />
      </section>
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-secondary)]" />
      <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-secondary)]" />
      <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-secondary)]" />
      <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-secondary)]" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="mt-10 text-center">
      <p className="text-[15px] font-medium">Timeline unavailable</p>
      <p
        className="mt-1 text-[13px]"
        style={{ color: "var(--text-secondary)" }}
      >
        We couldn&apos;t compute your projection. Refresh to try again.
      </p>
    </div>
  );
}
