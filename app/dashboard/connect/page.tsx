export const metadata = {
  title: "Connect a bank — Open Banking Aggregator",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Your session expired before the connection completed. Please try again.",
  missing_code: "TrueLayer did not return an authorization code. Please try again.",
  connection_failed: "Something went wrong while linking your bank. Please try again.",
  access_denied: "You declined the bank connection request.",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error
    ? (ERROR_MESSAGES[error] ?? "We couldn't connect your bank. Please try again.")
    : null;

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Connect your bank</h1>
      <p className="mt-2 text-gray-500">
        Securely link a bank account through TrueLayer to start aggregating your
        balances and transactions.
      </p>

      {message && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </p>
      )}

      <a
        href="/api/ob/connect"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
      >
        Connect a bank account
      </a>
    </div>
  );
}
