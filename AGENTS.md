# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, etc.) working in this repository. Human contributors should read this too — it captures the non-obvious rules.

## What this app is

A personal Open Banking aggregator. Users authenticate with Supabase, link bank accounts through TrueLayer, and the app ingests balances, transactions, and projects a financial trajectory. An AI chat surface answers questions over the user's own data.

## Ground rules

1. **Never make Open Banking calls from the client.** All TrueLayer requests go through `app/api/**` route handlers. The client talks to our API, the API talks to TrueLayer.
2. **Tokens are encrypted at the app layer.** Use the helpers in `lib/truelayer/` (see `crypto.ts`) — never write raw tokens to `ob_tokens`.
3. **Respect RLS.** Default to the cookie-based client in `lib/supabase/server.ts` so queries run as the logged-in user. Use the service role key only for cron, webhooks, or other server-only contexts where RLS must be bypassed — and justify it.
4. **Validate external data with Zod.** Any TrueLayer or third-party payload is parsed through a schema in `lib/validators/` before it touches business logic.
5. **App Router only.** Use `NextResponse` in route handlers; don't introduce Pages-router patterns or `res.json()`.
6. **Don't commit secrets.** `.env.local` is gitignored. Production secrets live in Vercel. `.env.example` is the source of truth for which variables exist.

## File-layout expectations

- New server endpoints → `app/api/<feature>/route.ts`
- New UI → `components/<feature>/`, mounted from `app/<route>/page.tsx`
- New Zod schemas → `lib/validators/<feature>.ts`
- New DB tables → a new `supabase/migrations/NNN_*.sql` file, monotonically numbered, then `npm run db:types`
- Tests → `tests/<feature>.test.ts` (mirror the module being tested)

## Supabase

- Migrations are append-only and applied in filename order. Do **not** edit a migration that has been merged — add a new one.
- After any schema change run `npm run db:types` and commit `types/database.ts`.
- When debugging, prefer `list_tables` / `get_logs` / `get_advisors` (Supabase MCP) before changing schema.
- RLS policies live in `002_rls_policies.sql` and subsequent migrations; keep new tables locked down by default.

## TrueLayer

- Sandbox base: `https://auth.truelayer-sandbox.com`. `TRUELAYER_REDIRECT_URI` must match the app registered in the TrueLayer console.
- OAuth, token refresh, sync, and webhook verification live in `lib/truelayer/`. Reuse those helpers — don't reimplement.
- Webhooks are signed with `TRUELAYER_WEBHOOK_SECRET`. The handler in `app/api/webhooks/` verifies signatures — keep that check intact.

## Cron

- Scheduled jobs are declared in `vercel.json` and implemented under `app/api/cron/`.
- They authenticate via a `Bearer ${CRON_SECRET}` header. Any new cron endpoint must enforce this check before doing work.

## AI chat

- The chat route uses Vercel AI Gateway via the AI SDK. Locally you need `AI_GATEWAY_API_KEY`; on Vercel deployments OIDC handles auth.
- Prompts live in `lib/prompts/`. Keep them version-controlled, not inlined in route handlers.

## Coding style

- TypeScript strict. No `any` unless there's a documented reason.
- Default to **no comments**. Only add a comment when the *why* is non-obvious (a hidden invariant, a subtle workaround). Don't restate what the code says.
- Don't add error handling for cases that can't happen. Validate at the boundary, then trust internal code.
- Don't speculatively abstract. Three similar lines is better than a premature helper.
- Don't introduce new dependencies for things the standard library or existing packages already do.

## Tests

- `npm run test` runs Vitest once. `npm run test:watch` for development.
- Add a test alongside any non-trivial change to `lib/` (validators, crypto, sync, trajectory math, webhooks).
- UI changes that can't be unit-tested should be exercised in the browser before being declared done.

## Git / PR workflow

- Develop on a feature branch; don't push directly to `main`.
- Commit messages: short, imperative, explain *why* over *what*.
- Run `npm run build` and `npm run test` before opening a PR.
- Don't open PRs unless the human asks for one.

## What not to do

- Don't call `createClient` with the service role key from anything reachable by the browser.
- Don't store plaintext OB tokens, refresh tokens, or webhook secrets in the DB or logs.
- Don't disable RLS to "make a query work" — fix the policy or use the server client.
- Don't hand-edit `types/database.ts` — regenerate it.
- Don't add `// removed` / `// kept for backwards-compat` comments. If it's unused, delete it.
- Don't bypass git hooks (`--no-verify`) or amend pushed commits without being asked.
