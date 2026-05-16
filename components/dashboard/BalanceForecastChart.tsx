"use client";

import { useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import type { BalanceSeries, TabKey } from "@/lib/balance-history";
import { cn, formatCurrency } from "@/lib/utils";

const VB_W = 720;
const VB_H = 300;
const PAD = { l: 14, r: 48, t: 24, b: 30 };
const PLOT_L = PAD.l;
const PLOT_R = VB_W - PAD.r;
const PLOT_T = PAD.t;
const PLOT_B = VB_H - PAD.b;
const PLOT_W = PLOT_R - PLOT_L;
const PLOT_H = PLOT_B - PLOT_T;

const MAX_FORWARD_WEEKS = 8;
const DAY_MS = 86_400_000;

const TAB_LABELS: Record<TabKey, string> = {
  all: "All",
  checking: "Checking",
  savings: "Savings",
};

// --- date helpers (all UTC, to match server-built date keys) ---

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function mondayOf(d: Date): Date {
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  return addDays(d, day === 0 ? -6 : 1 - day);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

// --- scale helpers ---

/** Rounds a range to a visually pleasant step (1 / 2 / 5 × 10ⁿ). */
function niceStep(range: number): number {
  if (range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const base = Math.pow(10, exp);
  const f = range / base;
  if (f < 1.5) return base;
  if (f < 3) return 2 * base;
  if (f < 7) return 5 * base;
  return 10 * base;
}

function currencySymbol(currency: string): string {
  try {
    return (
      new Intl.NumberFormat("en-GB", { style: "currency", currency })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

function compactCurrency(value: number, currency: string): string {
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${sym}${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
  }
  return `${sign}${sym}${Math.round(abs)}`;
}

/** Splits a formatted amount so the decimals can be de-emphasised. */
function splitAmount(value: number, currency: string) {
  const full = formatCurrency(value, currency);
  const idx = full.lastIndexOf(".");
  if (idx === -1) return { main: full, dec: "" };
  return { main: full.slice(0, idx), dec: full.slice(idx) };
}

type DayCell = {
  index: number;
  date: Date;
  key: string;
  letter: string;
  balance: number | null;
  forecast: boolean;
};

type Props = {
  series: Record<TabKey, BalanceSeries>;
  /** Server's "today" as a YYYY-MM-DD key, so client and server agree. */
  todayKey: string;
};

export function BalanceForecastChart({ series, todayKey }: Props) {
  const today = useMemo(() => parseKey(todayKey), [todayKey]);

  const tabs = useMemo(
    () =>
      (["all", "checking", "savings"] as TabKey[]).filter(
        (key) => key === "all" || series[key].accountCount > 0,
      ),
    [series],
  );

  const [tab, setTab] = useState<TabKey>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);

  const active = series[tab];

  const monthEnd = useMemo(
    () => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
    [today],
  );
  const [targetDay, setTargetDay] = useState(monthEnd.getUTCDate());

  const balanceByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of active.points) map.set(p.date, p.balance);
    return map;
  }, [active]);

  // How far back navigation may go (oldest reconstructed week).
  const minOffset = useMemo(() => {
    const first = series.all.points[0];
    if (!first) return 0;
    return Math.min(
      0,
      daysBetween(mondayOf(today), mondayOf(parseKey(first.date))) / 7,
    );
  }, [series.all.points, today]);

  const weekStart = addDays(mondayOf(today), weekOffset * 7);

  const cells: DayCell[] = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const key = keyOf(date);
      const forecast = key > todayKey;
      const balance = forecast
        ? active.currentBalance + active.dailyRate * daysBetween(today, date)
        : (balanceByDate.get(key) ?? null);
      return {
        index: i,
        date,
        key,
        letter: "SMTWTFS"[date.getUTCDay()],
        balance,
        forecast,
      };
    });
    // weekStart derives from weekOffset; depend on its key instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, balanceByDate, todayKey, weekOffset, today]);

  const values = cells
    .map((c) => c.balance)
    .filter((v): v is number => v !== null);

  // Y-axis bounds, padded and snapped to nice round numbers.
  let lo = 0;
  let hi = 1;
  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) || 100;
    const step = niceStep(span * 1.5) / 2 || 1;
    lo = Math.floor((min - span * 0.25) / step) * step;
    hi = Math.ceil((max + span * 0.25) / step) * step;
    if (hi === lo) hi = lo + step;
  }

  const xFor = (i: number) => PLOT_L + (i / 6) * PLOT_W;
  const yFor = (v: number) => PLOT_B - ((v - lo) / (hi - lo)) * PLOT_H;

  const historyPts = cells
    .filter((c) => !c.forecast && c.balance !== null)
    .map((c) => ({ x: xFor(c.index), y: yFor(c.balance as number) }));

  const todayCell = cells.find((c) => c.key === todayKey);
  const forecastPts = cells
    .filter((c) => c.forecast && c.balance !== null)
    .map((c) => ({ x: xFor(c.index), y: yFor(c.balance as number) }));
  if (todayCell?.balance != null && forecastPts.length > 0) {
    forecastPts.unshift({
      x: xFor(todayCell.index),
      y: yFor(todayCell.balance),
    });
  }

  const linePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");

  const areaPath = (pts: { x: number; y: number }[]) =>
    pts.length === 0
      ? ""
      : `M${pts[0].x} ${PLOT_B} ` +
        pts.map((p) => `L${p.x} ${p.y}`).join(" ") +
        ` L${pts[pts.length - 1].x} ${PLOT_B} Z`;

  // Forecast estimate for the chosen target day of the current month.
  const targetDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), targetDay),
  );
  const estDays = Math.max(0, daysBetween(today, targetDate));
  const estBalance = active.currentBalance + active.dailyRate * estDays;

  const balance = splitAmount(active.currentBalance, active.currency);

  const fmtMonth = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const d0 = cells[0].date;
  const d6 = cells[6].date;
  const rangeLabel =
    d0.getUTCMonth() === d6.getUTCMonth()
      ? `${fmtMonth(d0)} ${d0.getUTCDate()} – ${d6.getUTCDate()}`
      : `${fmtMonth(d0)} ${d0.getUTCDate()} – ${fmtMonth(d6)} ${d6.getUTCDate()}`;

  const wrapRef = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;
    const i = Math.round(((x - PLOT_L) / PLOT_W) * 6);
    setHover(Math.min(6, Math.max(0, i)));
  }

  const hoverCell = hover !== null ? cells[hover] : null;
  const showHover = hoverCell != null && hoverCell.balance !== null;

  const prevDisabled = weekOffset <= minOffset;
  const nextDisabled = weekOffset >= MAX_FORWARD_WEEKS;

  return (
    <Card className="overflow-hidden">
      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-100 px-5">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 py-3 text-sm font-medium transition-colors",
              tab === key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="px-5 pt-4">
        <p className="text-sm text-gray-500">Current balance</p>
        <p className="mt-0.5 text-3xl font-semibold tracking-tight text-gray-900">
          {balance.main}
          <span className="text-xl text-gray-400">{balance.dec}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
          <span className="font-medium text-gray-900">
            {formatCurrency(estBalance, active.currency)}
          </span>
          <span>estimated until</span>
          {editingTarget ? (
            <input
              type="number"
              min={1}
              max={monthEnd.getUTCDate()}
              value={targetDay}
              autoFocus
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) {
                  setTargetDay(
                    Math.min(monthEnd.getUTCDate(), Math.max(1, n)),
                  );
                }
              }}
              onBlur={() => setEditingTarget(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingTarget(false);
              }}
              className="w-14 rounded border border-gray-300 px-1 py-0.5 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTarget(true)}
              className="flex items-center gap-1 font-semibold text-gray-900 hover:text-gray-600"
              aria-label="Edit estimate target date"
            >
              {ordinal(targetDay)}
              <PencilIcon />
            </button>
          )}
        </p>
      </div>

      {/* Chart */}
      <div
        ref={wrapRef}
        className="relative mt-2 aspect-[12/5] w-full select-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Vertical day gridlines */}
          {cells.map((c) => (
            <line
              key={c.key}
              x1={xFor(c.index)}
              x2={xFor(c.index)}
              y1={PLOT_T}
              y2={PLOT_B}
              stroke="#f1f3f5"
              strokeWidth="1"
            />
          ))}
          {/* Baseline */}
          <line
            x1={PLOT_L}
            x2={PLOT_R}
            y1={PLOT_B}
            y2={PLOT_B}
            stroke="#e5e7eb"
            strokeWidth="1"
          />

          {/* History area + line */}
          {historyPts.length > 1 && (
            <path d={areaPath(historyPts)} fill="url(#balFill)" />
          )}
          {historyPts.length > 1 && (
            <path
              d={linePath(historyPts)}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Forecast line (dashed) */}
          {forecastPts.length > 1 && (
            <path
              d={linePath(forecastPts)}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Endpoint markers */}
          {historyPts.length > 0 && (
            <circle
              cx={historyPts[0].x}
              cy={historyPts[0].y}
              r="5"
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="2.5"
            />
          )}
          {historyPts.length > 0 && (
            <circle
              cx={historyPts[historyPts.length - 1].x}
              cy={historyPts[historyPts.length - 1].y}
              r="5"
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}
          {forecastPts.length > 0 && (
            <circle
              cx={forecastPts[0].x}
              cy={forecastPts[0].y}
              r="5"
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="2.5"
            />
          )}

          {/* Hover guide */}
          {showHover && (
            <>
              <line
                x1={xFor(hoverCell.index)}
                x2={xFor(hoverCell.index)}
                y1={PLOT_T}
                y2={PLOT_B}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={xFor(hoverCell.index)}
                cy={yFor(hoverCell.balance as number)}
                r="5.5"
                fill={hoverCell.forecast ? "#94a3b8" : "#2563eb"}
                stroke="#ffffff"
                strokeWidth="2.5"
              />
            </>
          )}
        </svg>

        {/* Y-axis labels (HTML overlay for crisp text) */}
        {[hi, lo].map((v) => (
          <span
            key={v}
            className="absolute text-xs text-gray-400"
            style={{
              left: `${(PLOT_R / VB_W) * 100 + 1}%`,
              top: `${(yFor(v) / VB_H) * 100}%`,
              transform: "translateY(-50%)",
            }}
          >
            {compactCurrency(v, active.currency)}
          </span>
        ))}

        {/* X-axis day labels */}
        {cells.map((c) => (
          <span
            key={c.key}
            className={cn(
              "absolute -translate-x-1/2 text-xs",
              c.key === todayKey
                ? "font-semibold text-gray-900"
                : "text-gray-400",
            )}
            style={{
              left: `${(xFor(c.index) / VB_W) * 100}%`,
              top: `${((PLOT_B + 10) / VB_H) * 100}%`,
            }}
          >
            {c.letter}
          </span>
        ))}

        {/* Hover tooltip */}
        {showHover && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{
              left: `${(xFor(hoverCell.index) / VB_W) * 100}%`,
              top: `${(yFor(hoverCell.balance as number) / VB_H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
          >
            <div className="font-semibold">
              {formatCurrency(hoverCell.balance, active.currency)}
            </div>
            <div className="text-gray-400">
              {hoverCell.date.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
              {hoverCell.forecast ? " · forecast" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={prevDisabled}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous week"
        >
          <ChevronIcon direction="left" />
        </button>
        <span className="text-sm font-medium text-gray-600">{rangeLabel}</span>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={nextDisabled}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next week"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
    </Card>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}
