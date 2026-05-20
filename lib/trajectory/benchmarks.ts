import type { Sector, TrajectoryTier } from "@/lib/validators/profile";

export type BenchmarkRow = {
  sector: Sector;
  tier: TrajectoryTier;
  age: number;
  salary_p25: number;
  salary_p50: number;
  salary_p75: number;
};

/**
 * Project salary at a target age based on sector, tier, and current salary.
 *
 * The user's actual salary is scaled by the benchmark p50 growth ratio so
 * that someone above or below their cohort keeps that relative position.
 * Linear interpolation fills the gaps between benchmark age points.
 */
export function projectSalary(
  currentAge: number,
  currentSalary: number,
  targetAge: number,
  sector: Sector,
  tier: TrajectoryTier,
  benchmarks: BenchmarkRow[],
): number {
  if (targetAge <= currentAge) return currentSalary;

  const tierBenchmarks = benchmarks
    .filter((b) => b.sector === sector && b.tier === tier)
    .sort((a, b) => a.age - b.age);

  if (tierBenchmarks.length === 0) return currentSalary;

  const benchmarkAtCurrent = interpolate(currentAge, tierBenchmarks);
  const benchmarkAtTarget = interpolate(targetAge, tierBenchmarks);

  if (benchmarkAtCurrent <= 0) return currentSalary;

  const growthRatio = benchmarkAtTarget / benchmarkAtCurrent;
  return Math.round(currentSalary * growthRatio);
}

/**
 * Estimate a user's percentile within their cohort (sector + tier) at their
 * current age. Uses piecewise linear interpolation between p25, p50, and p75,
 * with clamped extrapolation at the tails.
 *
 * Returns null when there is insufficient benchmark data.
 */
export function calculateCohortPercentile(
  salary: number,
  currentAge: number,
  benchmarks: BenchmarkRow[],
): number | null {
  const sorted = [...benchmarks].sort((a, b) => a.age - b.age);
  if (sorted.length === 0) return null;

  const p25 = interpolateField(currentAge, sorted, "salary_p25");
  const p50 = interpolateField(currentAge, sorted, "salary_p50");
  const p75 = interpolateField(currentAge, sorted, "salary_p75");

  if (p25 <= 0 || p50 <= 0 || p75 <= 0) return null;

  // Extrapolation anchors: assume ~1st percentile at half of p25, ~99th at
  // p75 + (p75 - p25) — a symmetric spread above the top quartile.
  const floor = p25 * 0.5;
  const ceil = p75 + (p75 - p25);

  let pct: number;
  if (salary <= floor) {
    pct = 1;
  } else if (salary <= p25) {
    pct = 1 + 24 * ((salary - floor) / (p25 - floor));
  } else if (salary <= p50) {
    pct = 25 + 25 * ((salary - p25) / (p50 - p25));
  } else if (salary <= p75) {
    pct = 50 + 25 * ((salary - p50) / (p75 - p50));
  } else if (salary <= ceil) {
    pct = 75 + 24 * ((salary - p75) / (ceil - p75));
  } else {
    pct = 99;
  }

  return Math.round(Math.min(99, Math.max(1, pct)));
}

/** Linear interpolation of p50 salary across benchmark age points. */
function interpolate(age: number, sorted: BenchmarkRow[]): number {
  return interpolateField(age, sorted, "salary_p50");
}

function interpolateField(
  age: number,
  sorted: BenchmarkRow[],
  field: "salary_p25" | "salary_p50" | "salary_p75",
): number {
  if (age <= sorted[0].age) return sorted[0][field];
  const last = sorted[sorted.length - 1];
  if (age >= last.age) return last[field];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (age >= sorted[i].age && age <= sorted[i + 1].age) {
      const span = sorted[i + 1].age - sorted[i].age;
      const t = span === 0 ? 0 : (age - sorted[i].age) / span;
      return sorted[i][field] + t * (sorted[i + 1][field] - sorted[i][field]);
    }
  }
  return last[field];
}
