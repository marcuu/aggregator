import type {
  DashboardSnapshot,
  GoalTrajectory,
} from "@/lib/validators/dashboard";
import type { GoalType } from "@/lib/validators/goals";

const GOAL_TITLE: Record<GoalType, string> = {
  home: "First home",
  wedding: "Wedding",
  emergency_fund: "Emergency fund",
  invest_start: "Investing",
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function GoalCard({
  entry,
  snapshots,
}: {
  entry: GoalTrajectory;
  snapshots: DashboardSnapshot[];
}) {
  const { goal, trajectory } = entry;
  const history = snapshots
    .filter((s) => s.goal_id === goal.id)
    .map((s) => s.trajectory_age);

  // A goal is "drifting" when its projected age has risen across the window.
  const drifting =
    history.length >= 2 && history[history.length - 1] > history[0] + 0.05;

  const progress =
    goal.target_amount > 0
      ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100))
      : 0;

  return (
    <article
      className="rounded-2xl border p-4"
      style={{
        borderColor: drifting
          ? "var(--score-spending)"
          : "var(--border-subtle)",
        background: "var(--surface-secondary)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="section-label">{GOAL_TITLE[goal.type]}</p>
          <p className="mt-1.5 text-[15px]" style={{ color: "var(--text-secondary)" }}>
            On track for age
          </p>
          <p
            className="tabular-nums"
            style={{ fontSize: "40px", fontWeight: 500, lineHeight: 1.05 }}
          >
            {trajectory.trajectoryAge.toFixed(1)}
          </p>
        </div>
        <Sparkline points={history} drifting={drifting} />
      </div>

      <div className="mt-3">
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--border-subtle)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: "var(--text-primary)",
            }}
          />
        </div>
        <p
          className="mt-1.5 text-[12px] tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          {gbp.format(goal.saved_amount)} of {gbp.format(goal.target_amount)}
          {goal.target_region ? ` · ${goal.target_region}` : ""}
        </p>
      </div>
    </article>
  );
}

/** A tiny trajectory-age trend line. Falls back to a single dot for week one. */
function Sparkline({
  points,
  drifting,
}: {
  points: number[];
  drifting: boolean;
}) {
  const W = 88;
  const H = 32;
  const stroke = drifting ? "var(--score-spending)" : "var(--score-growth)";

  if (points.length < 2) {
    return (
      <svg width={W} height={H} aria-hidden="true">
        <circle cx={W - 4} cy={H / 2} r="3" fill={stroke} />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (W - 6) + 3;
    // Lower projected age sits higher on the chart.
    const y = H - 4 - ((p - min) / span) * (H - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={W} height={H} aria-hidden="true">
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
