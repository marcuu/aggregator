import { describe, expect, it } from "vitest";

import { projectSalary } from "@/lib/trajectory/benchmarks";
import { lawFastBenchmarks } from "./fixtures";

describe("projectSalary", () => {
  it("returns the current salary when the target age is not in the future", () => {
    expect(
      projectSalary(28, 50_000, 28, "law", "fast", lawFastBenchmarks),
    ).toBe(50_000);
    expect(
      projectSalary(28, 50_000, 25, "law", "fast", lawFastBenchmarks),
    ).toBe(50_000);
  });

  it("returns the current salary when no benchmarks match", () => {
    expect(
      projectSalary(25, 50_000, 30, "law", "fast", []),
    ).toBe(50_000);
    expect(
      projectSalary(25, 50_000, 30, "banking", "steady", lawFastBenchmarks),
    ).toBe(50_000);
  });

  it("scales salary by the benchmark p50 growth ratio", () => {
    // law/fast p50: age 25 = 112,200, age 27 = 134,200.
    const ratio = 134_200 / 112_200;
    expect(
      projectSalary(25, 40_000, 27, "law", "fast", lawFastBenchmarks),
    ).toBe(Math.round(40_000 * ratio));
  });

  it("interpolates linearly between benchmark age points", () => {
    // Midpoint between age 25 (112,200) and age 26 (123,200).
    const midBenchmark = (112_200 + 123_200) / 2;
    const expected = Math.round(40_000 * (midBenchmark / 112_200));
    expect(
      projectSalary(25, 40_000, 25.5, "law", "fast", lawFastBenchmarks),
    ).toBe(expected);
  });

  it("clamps to the oldest benchmark when the target age is beyond range", () => {
    // age 30 is the last row (168,300); age 99 clamps to it.
    const atRange = projectSalary(25, 40_000, 30, "law", "fast", lawFastBenchmarks);
    const beyond = projectSalary(25, 40_000, 99, "law", "fast", lawFastBenchmarks);
    expect(beyond).toBe(atRange);
  });
});
