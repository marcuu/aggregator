import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { GoalTypePicker } from "@/components/onboarding/GoalTypePicker";

export default function Step3() {
  return (
    <>
      <ProgressDots current={4} total={6} />
      <h1 className="mt-8 text-2xl font-medium">What are you working towards?</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Choose the goals that matter most right now. Two is the sweet spot —
        enough to see the trade-offs without losing focus.
      </p>

      <GoalTypePicker />
    </>
  );
}
