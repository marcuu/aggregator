# Open Banking Aggregator — Claude Code Context

## Project
Next.js (App Router, Turbopack), TypeScript, Supabase (Auth + Postgres + RLS),
TrueLayer open banking API, Tailwind CSS v4, Zod v4, Vitest, npm.

## Repo / Deploy
- GitHub remote: main branch → Vercel auto-deploy
- Vercel project linked; env vars set in Vercel dashboard (not committed)
- Supabase project: migrations live in /supabase/migrations/

## Key conventions
- All server-side Supabase access via lib/supabase/server.ts (cookie-based)
- All browser Supabase access via lib/supabase/client.ts
- Open banking API calls ONLY via server-side route handlers — never from client
- TrueLayer tokens stored in ob_tokens table via app-layer encryption
- Zod schemas for all external API responses live in lib/validators/
- Route handlers in app/api/ — use NextResponse, not res.json()
- DB types auto-generated: run `npm run db:types` after schema changes
- RLS enabled on all tables — always test with anon key, not service role

## Environment variables
See .env.example — never commit .env.local
Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET,
TRUELAYER_REDIRECT_URI, TRUELAYER_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL,
OB_TOKEN_ENCRYPTION_KEY, CRON_SECRET
Optional: AI_GATEWAY_API_KEY (Vercel AI Gateway — only needed locally;
Vercel deployments authenticate via OIDC)

## Commands
- npm run dev          → local dev (Turbopack)
- npm run build        → production build check
- npm run test         → Vitest
- npm run db:types     → regenerate Supabase TypeScript types
