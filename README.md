# Open Banking Aggregator

A personal financial aggregator built on **Next.js 16** (App Router + Turbopack), **Supabase** (Auth + Postgres with RLS), and **TrueLayer** Open Banking. It connects a user's bank accounts, ingests balances and transactions, projects a financial trajectory, and provides an AI chat surface over the user's own data.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Database / Auth:** Supabase (Postgres, Row-Level Security, SSR cookies)
- **Open Banking:** TrueLayer (sandbox + production)
- **Validation:** Zod v4
- **AI:** Vercel AI SDK + AI Gateway (`@ai-sdk/react`, `ai`)
- **Styling:** Tailwind CSS v4
- **Tests:** Vitest

## Getting started

### 1. Prerequisites

- Node.js 20+
- A Supabase project (linked via `supabase link`)
- A TrueLayer developer app (sandbox is fine for local)

### 2. Install

```bash
npm install
cp .env.example .env.local
# fill in the variables described below
```

### 3. Database

Migrations live in `supabase/migrations/`. Apply them to your linked project (or via the Supabase MCP / dashboard SQL editor), then regenerate types:

```bash
npm run db:types
```

### 4. Run

```bash
npm run dev          # http://localhost:3000
npm run build        # production build check
npm run test         # Vitest one-shot
npm run test:watch   # Vitest watch mode
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (used by SSR + browser clients) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, bypasses RLS) |
| `TRUELAYER_CLIENT_ID` | TrueLayer app client id |
| `TRUELAYER_CLIENT_SECRET` | TrueLayer app client secret |
| `TRUELAYER_REDIRECT_URI` | OAuth callback — must match TrueLayer app |
| `TRUELAYER_WEBHOOK_SECRET` | Shared secret for webhook signature verification |
| `NEXT_PUBLIC_APP_URL` | Public base URL (used in absolute links / OAuth) |
| `OB_TOKEN_ENCRYPTION_KEY` | 32-byte hex (`openssl rand -hex 32`) — encrypts stored OB tokens |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` endpoints |
| `AI_GATEWAY_API_KEY` | Optional; only required locally. Vercel uses OIDC. |

Never commit `.env.local`. Production secrets live in the Vercel dashboard.

## Project layout

```
app/
  (auth)/login/         Auth pages
  api/                  Server route handlers (all OB calls go here)
    auth/  chat/  cron/  dashboard/  goals/  ob/  prompts/
    trajectory/  webhooks/
  dashboard/            Authenticated app (accounts, transactions, connect)
  onboarding/           Multi-step onboarding flow (0..4 + reveal)
  trajectory/           Long-term financial trajectory view
components/             UI building blocks grouped by feature
lib/
  supabase/             server.ts (cookie-based), client.ts (browser)
  truelayer/            TrueLayer client, OAuth, sync, crypto
  validators/           Zod schemas for external API payloads
  trajectory/           Trajectory projection logic
  prompts/              Prompt definitions for the AI surface
supabase/migrations/    SQL migrations (applied in order)
tests/                  Vitest suites
types/database.ts       Generated Supabase types — do not hand-edit
middleware.ts           Supabase session refresh
```

## Conventions

- **Supabase access:**
  - Server: `lib/supabase/server.ts` (cookie-based, respects RLS as the logged-in user)
  - Browser: `lib/supabase/client.ts`
  - Service role: server-only, used sparingly (e.g. cron, webhooks)
- **Open Banking calls** happen **only** in `app/api/**` route handlers — never from the client. Tokens are encrypted at the app layer before being stored in `ob_tokens`.
- **Validation:** every external API response is parsed through a Zod schema in `lib/validators/`.
- **Route handlers** return `NextResponse` (App Router style — no `res.json()`).
- **RLS** is enabled on every user-scoped table. Test with the anon key, not the service role.
- **DB types** are regenerated with `npm run db:types` after any schema change.

## Deployment

- `main` auto-deploys to Vercel.
- Set every variable listed above in the Vercel dashboard.
- The cron endpoints under `app/api/cron/` are invoked by `vercel.json` schedules and authenticated with `CRON_SECRET`.

## Testing

```bash
npm run test
```

Vitest config is in `vitest.config.ts`. Coverage runs via `@vitest/coverage-v8`. Tests cover crypto, validators, sync, the webhook handler, balance history, prompts, and trajectory math.

## Further reading

- `CLAUDE.md` — short context block for Claude Code sessions.
- `AGENTS.md` — instructions for AI coding agents working in this repo.
