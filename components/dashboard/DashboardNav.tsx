import Link from "next/link";

import { SignOutButton } from "@/components/auth/SignOutButton";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/accounts", label: "Accounts" },
  { href: "/dashboard/transactions", label: "Transactions" },
];

export function DashboardNav({ email }: { email: string }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">Aggregator</span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
