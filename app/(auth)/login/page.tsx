import { Suspense } from "react";

import { LoginButton } from "@/components/auth/LoginButton";

export const metadata = {
  title: "Sign in — Open Banking Aggregator",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          Open Banking Aggregator
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Connect your bank accounts and see everything in one place.
        </p>
        <div className="mt-6">
          <Suspense fallback={null}>
            <LoginButton />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
