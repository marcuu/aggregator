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

const HISTORY_DAYS = 14;
const FORECAST_DAYS = 14;
const TOTAL_DAYS = HISTORY_DAYS + FORECAST_DAYS; // 28
const TODAY_INDEX = HISTORY_DAYS - 1; // 13
const TICKS = [0, 7, TODAY_INDEX, 20, TOTAL_DAYS - 1];
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

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

type DayCell = {
  index: number;
  date: Date;
  key: string;
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

  // Fixed window: 14 trailing days of history, then 14 days of forecast.
  const cells: DayCell[] = useMemo(() => {
    const windowStart = addDays(today, -TODAY_INDEX);
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const date = addDays(windowStart, i);
      const forecast = i > TODAY_INDEX;
      const balance = forecast
        ? active.currentBalance + active.dailyRate * (i - TODAY_INDEX)
        : (balanceByDate.get(keyOf(date)) ?? null);
      return { index: i, date, key: keyOf(date), balance, forecast };
    });
  }, [active, balanceByDate, today]);

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

  const xFor = (i: number) => PLOT_L + (i / (TOTAL_DAYS - 1)) * PLOT_W;
  const yFor = (v: number) => PLOT_B - ((v - lo) / (hi - lo)) * PLOT_H;

  const historyPts = cells
    .filter((c) => !c.forecast && c.balance !== null)
    .map((c) => ({ x: xFor(c.index), y: yFor(c.balance as number) }));

  const todayCell = cells[TODAY_INDEX];
  const forecastPts = cells
    .filter((c) => c.forecast && c.balance !== null)
    .map((c) => ({ x: xFor(c.index), y: yFor(c.balance as number) }));
  if (todayCell.balance != null && forecastPts.length > 0) {
    forecastPts.unshift({
      x: xFor(TODAY_INDEX),
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

  const wrapRef = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;
    const i = Math.round(((x - PLOT_L) / PLOT_W) * (TOTAL_DAYS - 1));
    setHover(Math.min(TOTAL_DAYS - 1, Math.max(0, i)));
  }

  const hoverCell = hover !== null ? cells[hover] : null;
  const showHover = hoverCell != null && hoverCell.balance !== null;

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
        className="relative mt-2 mb-1 aspect-[12/5] w-full select-none"
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

          {/* Weekly gridlines + today divider */}
          {TICKS.map((i) => (
            <line
              key={i}
              x1={xFor(i)}
              x2={xFor(i)}
              y1={PLOT_T}
              y2={PLOT_B}
              stroke={i === TODAY_INDEX ? "#d1d5db" : "#f1f3f5"}
              strokeWidth="1"
              strokeDasharray={i === TODAY_INDEX ? "4 3" : undefined}
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

        {/* X-axis date labels */}
        {TICKS.map((i) => {
          const isToday = i === TODAY_INDEX;
          const isFirst = i === 0;
          const isLast = i === TOTAL_DAYS - 1;
          return (
            <span
              key={i}
              className={cn(
                "absolute text-xs",
                isToday ? "font-semibold text-gray-900" : "text-gray-400",
                isFirst
                  ? "translate-x-0"
                  : isLast
                    ? "-translate-x-full"
                    : "-translate-x-1/2",
              )}
              style={{
                left: `${(xFor(i) / VB_W) * 100}%`,
                top: `${((PLOT_B + 10) / VB_H) * 100}%`,
              }}
            >
              {isToday ? "Today" : shortDate(cells[i].date)}
            </span>
          );
        })}

        {/* Hover tooltip */}
        {showHover && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{
              left: `${(xFor(hoverCell.index) / VB_W) * 100}%`,
              top: `${(yFor(hoverCell.balance as number) / VB_H) * 100}%`,
              transform: `translate(${
                hoverCell.index <= 3
                  ? "0%"
                  : hoverCell.index >= TOTAL_DAYS - 4
                    ? "-100%"
                    : "-50%"
              }, calc(-100% - 10px))`,
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
