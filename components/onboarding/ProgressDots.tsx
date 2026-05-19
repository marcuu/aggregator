/** The step indicator shown at the top of every onboarding screen. */
export function ProgressDots({
  current,
  total = 4,
}: {
  current: number;
  total?: number;
}) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const filled = n <= current;
        return (
          <span
            key={n}
            className={`h-1.5 rounded-full transition-all ${
              n === current ? "w-6" : "w-1.5"
            }`}
            style={{
              backgroundColor: filled
                ? "var(--text-primary)"
                : "var(--border-subtle)",
            }}
          />
        );
      })}
    </div>
  );
}
