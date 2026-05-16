import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export const metadata = {
  title: "Transactions — Open Banking Aggregator",
};

const PAGE_SIZE = 25;

function isCredit(amount: number, type: string | null): boolean {
  if (type) return type.toUpperCase() === "CREDIT";
  return amount > 0;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: transactions, count } = await supabase
    .from("ob_transactions")
    .select(
      "id, timestamp, description, merchant_name, category, amount, currency, transaction_type",
      { count: "exact" },
    )
    .order("timestamp", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasRows = transactions && transactions.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>

      {!hasRows ? (
        <p className="mt-8 text-gray-500">
          No transactions yet. Connect a bank and sync to see activity here.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Description</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx) => {
                  const credit = isCredit(tx.amount, tx.transaction_type);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(tx.timestamp)}
                      </TableCell>
                      <TableCell>
                        {tx.merchant_name ?? tx.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {tx.category ? (
                          <Badge>{tx.category}</Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          credit ? "text-green-600" : "text-gray-900",
                        )}
                      >
                        {formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {page} of {totalPages} · {total} transactions
            </span>
            <div className="flex gap-2">
              <PageLink page={page - 1} disabled={page <= 1}>
                Previous
              </PageLink>
              <PageLink page={page + 1} disabled={page >= totalPages}>
                Next
              </PageLink>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-md border border-gray-200 px-3 py-1.5 text-gray-300">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={`/dashboard/transactions?page=${page}`}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
    >
      {children}
    </Link>
  );
}
