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

/** Linear interpolation of p50 salary across benchmark age points. */
function interpolate(age: number, sorted: BenchmarkRow[]): number {
  if (age <= sorted[0].age) return sorted[0].salary_p50;
  const last = sorted[sorted.length - 1];
  if (age >= last.age) return last.salary_p50;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (age >= sorted[i].age && age <= sorted[i + 1].age) {
      const span = sorted[i + 1].age - sorted[i].age;
      const t = span === 0 ? 0 : (age - sorted[i].age) / span;
      return (
        sorted[i].salary_p50 +
        t * (sorted[i + 1].salary_p50 - sorted[i].salary_p50)
      );
    }
  }
  return last.salary_p50;
}
