"use client";

import { useCallback, useRef } from "react";
import type { TimelinePoint, GoalMilestone } from "@/lib/validators/trajectory";

const C_SAVINGS = "var(--score-growth)";
const C_INCOME = "var(--score-borrowing)";
const C_DEBT = "var(--score-spending)";
const C_GRID = "var(--border-subtle)";
const C_LABEL = "var(--text-tertiary)";
const C_SCRUB = "var(--text-secondary)";

function formatK(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}m`;
  if (pounds >= 1_000) return `£${Math.round(pounds / 1_000)}k`;
  return `£${Math.round(pounds)}`;
}

export type ScrubPoint = {
  index: number;
  point: TimelinePoint;
};

type Props = {
  points: TimelinePoint[];
  milestones: GoalMilestone[];
  hasDebt: boolean;
  width: number;
  onScrub: (scrub: ScrubPoint | null) => void;
  scrubIndex: number | null;
};

const PAD = { top: 28, right: 12, bottom: 36, left: 48 };
const HEIGHT = 240;

export function TimelineChart({
  points,
  milestones,
  hasDebt,
  width,
  onScrub,
  scrubIndex,
}: Props) {
  if (points.length < 2 || width <= 0) return null;

  const chartW = width - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;

  const maxSavings = Math.max(...points.map((p) => p.cumulativeSavings));
  const maxDebt = hasDebt ? Math.max(...points.map((p) => p.debtBalance)) : 0;
  const maxIncome = Math.max(...points.map((p) => p.annualSalary));
  const yMax = Math.max(maxSavings, maxDebt, maxIncome, 1);

  const lastMonth = points[points.length - 1].month;

  function xOf(month: number) {
    return (month / lastMonth) * chartW;
  }
  function yOf(pence: number) {
    return chartH - (pence / yMax) * chartH;
  }

  // Y grid
  const yTicks = [0.25, 0.5, 0.75, 1.0].map((f) => ({
    pence: yMax * f,
    y: yOf(yMax * f),
    label: formatK(yMax * f),
  }));

  // X year labels (every 5 years)
  const startYear = points[0].year;
  const xYearTicks: { year: number; x: number }[] = [];
  for (const p of points) {
    const rel = p.year - startYear;
    if (rel === 0 || rel % 5 === 0) {
      xYearTicks.push({ year: p.year, x: xOf(p.month) });
    }
  }

  // SVG path helpers
  function linePath(key: keyof TimelinePoint) {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.month).toFixed(1)},${yOf(p[key] as number).toFixed(1)}`)
      .join(" ");
  }

  const savingsAreaPath =
    `M ${xOf(0).toFixed(1)},${chartH} ` +
    points.map((p) => `L ${xOf(p.month).toFixed(1)},${yOf(p.cumulativeSavings).toFixed(1)}`).join(" ") +
    ` L ${xOf(lastMonth).toFixed(1)},${chartH} Z`;

  const visibleMilestones = milestones.filter((m) => m.month <= lastMonth);

  // Interaction
  const overlayRef = useRef<SVGRectElement>(null);

  const resolvePoint = useCallback(
    (clientX: number) => {
      const el = overlayRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const relX = Math.max(0, Math.min(clientX - rect.left, chartW));
      const monthFrac = (relX / chartW) * lastMonth;
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs(points[i].month - monthFrac);
        if (d < minDist) {
          minDist = d;
          closest = i;
        }
      }
      onScrub({ index: closest, point: points[closest] });
    },
    [chartW, lastMonth, onScrub, points],
  );

  const scrubPt = scrubIndex != null ? points[scrubIndex] : null;

  return (
    <svg
      width={width}
      height={HEIGHT}
      aria-label="Financial trajectory timeline chart"
      style={{ overflow: "visible", touchAction: "pan-y" }}
    >
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {/* Grid lines + Y labels */}
        {yTicks.map((t) => (
          <g key={t.pence}>
            <line x1={0} y1={t.y} x2={chartW} y2={t.y} stroke={C_GRID} strokeWidth={0.5} />
            <text
              x={-6}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={9}
              fill={C_LABEL}
            >
              {t.label}
            </text>
          </g>
        ))}
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke={C_GRID} strokeWidth={0.5} />

        {/* Goal milestone verticals */}
        {visibleMilestones.map((m) => (
          <g key={m.goalId}>
            <line
              x1={xOf(m.month)}
              y1={0}
              x2={xOf(m.month)}
              y2={chartH}
              stroke={C_SAVINGS}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.45}
            />
            <text
              x={xOf(m.month)}
              y={-10}
              textAnchor="middle"
              fontSize={9}
              fontWeight={500}
              fill={C_SAVINGS}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Savings area fill */}
        <path d={savingsAreaPath} fill={C_SAVINGS} opacity={0.08} />

        {/* Savings line */}
        <path
          d={linePath("cumulativeSavings")}
          fill="none"
          stroke={C_SAVINGS}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Income line (dashed) */}
        <path
          d={linePath("annualSalary")}
          fill="none"
          stroke={C_INCOME}
          strokeWidth={1.5}
          strokeDasharray="5 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Debt line */}
        {hasDebt && (
          <path
            d={linePath("debtBalance")}
            fill="none"
            stroke={C_DEBT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Milestone dots on savings line */}
        {visibleMilestones.map((m) => {
          const pt = points.find((p) => p.month === m.month);
          if (!pt) return null;
          return (
            <circle
              key={`dot-${m.goalId}`}
              cx={xOf(m.month)}
              cy={yOf(pt.cumulativeSavings)}
              r={4}
              fill={C_SAVINGS}
              stroke="var(--surface-primary)"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Scrubber cursor */}
        {scrubPt && (
          <g aria-hidden="true">
            <line
              x1={xOf(scrubPt.month)}
              y1={0}
              x2={xOf(scrubPt.month)}
              y2={chartH}
              stroke={C_SCRUB}
              strokeWidth={1}
              opacity={0.4}
            />
            <circle
              cx={xOf(scrubPt.month)}
              cy={yOf(scrubPt.cumulativeSavings)}
              r={4.5}
              fill={C_SAVINGS}
              stroke="var(--surface-primary)"
              strokeWidth={2}
            />
            <circle
              cx={xOf(scrubPt.month)}
              cy={yOf(scrubPt.annualSalary)}
              r={4}
              fill={C_INCOME}
              stroke="var(--surface-primary)"
              strokeWidth={1.5}
            />
            {hasDebt && scrubPt.debtBalance > 100 && (
              <circle
                cx={xOf(scrubPt.month)}
                cy={yOf(scrubPt.debtBalance)}
                r={4}
                fill={C_DEBT}
                stroke="var(--surface-primary)"
                strokeWidth={1.5}
              />
            )}
          </g>
        )}

        {/* Transparent interaction overlay — must be last so it captures events */}
        <rect
          ref={overlayRef}
          x={0}
          y={0}
          width={chartW}
          height={chartH}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onPointerMove={(e) => resolvePoint(e.clientX)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            resolvePoint(e.clientX);
          }}
          onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
          onPointerLeave={() => onScrub(null)}
          onPointerCancel={() => onScrub(null)}
        />

        {/* X-axis year labels */}
        {xYearTicks.map(({ year, x }) => (
          <text
            key={year}
            x={x}
            y={chartH + 14}
            textAnchor="middle"
            fontSize={9}
            fill={C_LABEL}
          >
            {year}
          </text>
        ))}
      </g>
    </svg>
  );
}
