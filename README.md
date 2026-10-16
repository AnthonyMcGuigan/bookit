# Pro Wrestling Booking Simulator

A mobile-first web game where you run a fictional wrestling promotion: sign
talent, book shows on a drag-and-drop card, simulate them with a seeded,
deterministic engine, crown champions, build storylines and share your
creations with the community.

Built with Next.js (App Router), React, TypeScript, Tailwind CSS, Supabase
(Postgres, Auth, Storage), Zod, Vitest and Playwright.

## Features

- **Accounts**: email sign-up with verification, sign-in/out, password reset, email and password changes, public creator profiles. Sessions are real Supabase Auth sessions in HTTP-only cookies.
- **Private cloud saves**: multiple universes per account (blank, fictional starter, or imported), each with its own rules. Row-level security makes every universe readable and writable only by its owner.
- **Roster**: wrestlers with 0–100 attributes (no single overall rating), contracts, injuries, retirement, teams, trios and factions.
- **Championships**: lineage, vacancies, eligibility rules, manual awards and history edits that warn before changing the record.
- **Booking**: show calendar, drag-and-drop card (with keyboard and button fallbacks), match and segment editor, predetermined or simulated winners, non-blocking booking warnings, auto-booking.
- **Simulation**: seeded and deterministic, respects predetermined winners, advances time (injuries, morale, contracts, rival promotions), and saves results exactly once (revision-checked transaction).
- **Story and history**: storylines with developments, rivalries, a timeline, a show archive, finances.
- **Images**: portraits, logos, belts and posters are validated, re-encoded to WebP with metadata stripped, stored privately and counted against a quota.
- **Packages**: versioned JSON or ZIP packages for whole universes, scenarios, or single wrestlers, teams, titles, promotions, storylines and venues; import with conflict resolution (use existing, rename, duplicate, skip).
- **Community**: publish, version, search, tag, rate (once per user), download, report and remix creations, with remix credit and creator pages.
- **Moderation**: review queue, reports, appeals, IP takedown requests, account restrictions, roles and an audit log. Every decision requires a reason the creator can see.
- **Premium (provider-independent)**: plan limits and a Premium analytics page decided by server-side entitlement records. No payment provider is integrated; see [docs/billing.md](docs/billing.md).

Official content is fictional. No real wrestler portraits, company logos or music are bundled.

## Quick start (local)

Requirements: Node 20+, Docker (for the local Supabase stack).

```bash
npm install
npm run supabase:start          # starts Supabase in Docker and applies migrations
npx supabase status             # shows the local URL and keys
cp .env.example .env.local      # paste the local URL, publishable key and secret key
npx supabase db reset           # optional: fresh database with seed data
npm run dev                     # http://localhost:3000
```

Local emails (confirmation, password reset) go to Mailpit at http://127.0.0.1:54324.

To try moderation, create an account and grant it a role:

```bash
npm run role -- you@example.com moderator    # or admin; add --revoke to remove
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable (anon) key; safe to expose, RLS protects data |
| `SUPABASE_SECRET_KEY` | **server only** | Secret/service-role key for the media pipeline, publishing copies and admin scripts |
| `NEXT_PUBLIC_SITE_URL` | server | Base URL used in auth email links |
| `ENABLE_DEV_ENTITLEMENTS` | server | Shows the Premium test switcher in development |
| `ALLOW_DEV_ENTITLEMENTS_IN_PRODUCTION` | server | Only for e2e runs against a production build; never set in real production |
| `BILLING_PROVIDER` | server | Leave unset; no provider is integrated |

`.env.example` holds placeholders only. Secrets are never imported into client components (`server-only` guards the admin client).

If Supabase isn't configured or reachable, pages show an "unavailable" state; the app never pretends an online action succeeded.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm test` | Unit tests (simulation, packages, analytics, billing) |
| `npm run test:integration` | Database tests against local Supabase (RLS, RPCs, community rules, entitlements) |
| `npm run e2e` | Playwright tests against a production build (`npm run build` first) and local Supabase |
| `npm run supabase:start` / `supabase:reset` / `supabase:types` | Local stack, reset, regenerate DB types |
| `npm run sim:sanity` | Prints rating ranges from many simulated shows |
| `npm run role -- <email> <role>` | Grants moderator/admin locally |

## Testing

1. `npm run supabase:start` and fill `.env.local` as above.
2. `npm test` for unit tests.
3. `npm run test:integration` for database and security tests. They create throwaway users and briefly change `plan_limits`/`app_config`, so use a local database only.
4. `npm run build && npm run e2e` for browser tests (mobile viewport by default, plus a desktop check). Set `E2E_BASE_URL=http://localhost:3000` to run against an already running dev server instead.

## Project layout

```
app/                 routes (App Router): auth, universes, /u/[id]/…, community, moderation, policies, media and export routes
features/            server actions and client components per area (booking, roster, community, moderation, packages…)
lib/domain/          entity schemas (Zod), enums, selectors, settings
lib/simulation/      deterministic engine: match/segment sim, AI booker, career progression, planner, change application
lib/packages/        package format, validation, migrations, build, merge/conflicts, ZIP
lib/community/       publishing and community package loading
lib/media/           image validation/re-encoding and storage
lib/entitlements/    plan limits and server-side entitlement checks
lib/billing/         payment-provider boundary (no provider configured)
supabase/migrations  schema, RLS policies and security-definer RPCs
tests/               unit, integration and e2e suites
docs/                billing and architecture notes
```

More detail: [docs/architecture.md](docs/architecture.md).

## Deployment

1. Create a Supabase project, run the migrations (`npx supabase link` then `npx supabase db push`), and configure Auth: site URL, redirect URLs (`https://<site>/auth/confirm`), SMTP, and the email templates in `supabase/templates/` (they link to `/auth/confirm?token_hash=…`).
2. Set the environment variables on your host. Keep `SUPABASE_SECRET_KEY` server-side.
3. Make sure development entitlements are off: leave `ENABLE_DEV_ENTITLEMENTS` unset and run `update public.app_config set dev_entitlements_enabled = false;`.
4. Choose the community moderation mode in `app_config` (`community_moderation_mode` `auto` or `review`, `review_creations_with_images`, `flagged_terms`, `auto_hide_report_threshold`).
5. Review the policy pages (`app/policies/*`) with counsel and add your takedown contact details.
6. Grant the first admin with `npm run role -- <email> admin` (with production keys in `.env.local`) or SQL.

## Known limitations

- No outbound email from the app itself for moderation decisions or takedown replies; creators see decisions in the app and moderators contact claimants manually.
- Community search is substring matching, adequate for small to medium libraries.
- No real payments: Premium can only be granted by development grants (when enabled) or manual `grant` rows.
Milestone reports: [docs/milestones](docs/milestones).
