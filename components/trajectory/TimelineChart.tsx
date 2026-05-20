"use client";

import type { TimelinePoint, GoalMilestone } from "@/lib/validators/trajectory";

const SAVINGS_COLOR = "var(--score-growth)";
const DEBT_COLOR = "var(--score-spending)";
const GRID_COLOR = "var(--border-subtle)";
const LABEL_COLOR = "var(--text-tertiary)";

function formatK(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}m`;
  if (pounds >= 1_000) return `£${Math.round(pounds / 1_000)}k`;
  return `£${Math.round(pounds)}`;
}

type Props = {
  points: TimelinePoint[];
  milestones: GoalMilestone[];
  hasDebt: boolean;
  width: number;
};

export function TimelineChart({ points, milestones, hasDebt, width }: Props) {
  if (points.length < 2) return null;

  const PADDING = { top: 16, right: 16, bottom: 40, left: 48 };
  const HEIGHT = 220;
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;

  // Y domain: 0 to max of savings (and debt if present)
  const maxSavings = Math.max(...points.map((p) => p.cumulativeSavings));
  const maxDebt = hasDebt ? Math.max(...points.map((p) => p.debtBalance)) : 0;
  const yMax = Math.max(maxSavings, maxDebt, 1);

  // X domain: month 0 to last month
  const lastMonth = points[points.length - 1].month;

  function xOf(month: number) {
    return (month / lastMonth) * chartW;
  }
  function yOf(pence: number) {
    return chartH - (pence / yMax) * chartH;
  }

  // Y-axis grid lines and labels (4 levels)
  const yTicks = [0.25, 0.5, 0.75, 1.0].map((f) => ({
    pence: yMax * f,
    y: yOf(yMax * f),
    label: formatK(yMax * f),
  }));

  // X-axis: show year labels every 5 years
  const startYear = points[0].year;
  const endYear = points[points.length - 1].year;
  const xYearTicks: { year: number; x: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const pt = points.find((p) => p.year === y && p.month % 12 === 0);
    if (!pt) continue;
    const relYear = y - startYear;
    if (relYear === 0 || relYear % 5 === 0) {
      xYearTicks.push({ year: y, x: xOf(pt.month) });
    }
  }

  // Savings area path
  const savingsCoords = points.map((p) => `${xOf(p.month).toFixed(1)},${yOf(p.cumulativeSavings).toFixed(1)}`);
  const savingsLinePath = `M ${savingsCoords.join(" L ")}`;
  const savingsAreaPath =
    `M ${xOf(0).toFixed(1)},${chartH} ` +
    savingsCoords.join(" L ") +
    ` L ${xOf(lastMonth).toFixed(1)},${chartH} Z`;

  // Debt line path
  const debtCoords = points.map((p) => `${xOf(p.month).toFixed(1)},${yOf(p.debtBalance).toFixed(1)}`);
  const debtLinePath = `M ${debtCoords.join(" L ")}`;

  // Milestone vertical lines — only those within the x range
  const visibleMilestones = milestones.filter((m) => m.month <= lastMonth);

  return (
    <svg
      width={width}
      height={HEIGHT}
      aria-label="Financial trajectory timeline"
      style={{ overflow: "visible" }}
    >
      <g transform={`translate(${PADDING.left},${PADDING.top})`}>
        {/* Grid lines */}
        {yTicks.map((t) => (
          <g key={t.pence}>
            <line
              x1={0}
              y1={t.y}
              x2={chartW}
              y2={t.y}
              stroke={GRID_COLOR}
              strokeWidth={0.5}
            />
            <text
              x={-6}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={LABEL_COLOR}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Baseline */}
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke={GRID_COLOR} strokeWidth={0.5} />

        {/* Goal milestone verticals */}
        {visibleMilestones.map((m) => (
          <g key={m.goalId}>
            <line
              x1={xOf(m.month)}
              y1={0}
              x2={xOf(m.month)}
              y2={chartH}
              stroke={SAVINGS_COLOR}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            {/* Label above the chart */}
            <text
              x={xOf(m.month)}
              y={-4}
              textAnchor="middle"
              fontSize={9}
              fontWeight={500}
              fill={SAVINGS_COLOR}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Savings area fill */}
        <path d={savingsAreaPath} fill={SAVINGS_COLOR} opacity={0.1} />

        {/* Savings line */}
        <path
          d={savingsLinePath}
          fill="none"
          stroke={SAVINGS_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Debt line */}
        {hasDebt && (
          <path
            d={debtLinePath}
            fill="none"
            stroke={DEBT_COLOR}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Savings milestone dots */}
        {visibleMilestones.map((m) => {
          const pt = points.find((p) => p.month === m.month);
          if (!pt) return null;
          return (
            <circle
              key={`dot-${m.goalId}`}
              cx={xOf(m.month)}
              cy={yOf(pt.cumulativeSavings)}
              r={4}
              fill={SAVINGS_COLOR}
              stroke="var(--surface-primary)"
              strokeWidth={1.5}
            />
          );
        })}

        {/* X-axis year labels */}
        {xYearTicks.map(({ year, x }) => (
          <text
            key={year}
            x={x}
            y={chartH + 14}
            textAnchor="middle"
            fontSize={10}
            fill={LABEL_COLOR}
          >
            {year}
          </text>
        ))}
      </g>
    </svg>
  );
}
