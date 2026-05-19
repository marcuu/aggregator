export const metadata = {
  title: "Get started — Trajectory",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-10 pt-8">
      {children}
    </main>
  );
}
