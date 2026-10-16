# Milestone 1: core game loop

Branch `claude/core-game`, draft PR https://github.com/AnthonyMcGuigan/bookit/pull/1

## What works now

- **Accounts (real Supabase Auth):** sign up with email verification, sign in/out, password reset by email, profiles. Sessions refresh server-side; no tokens or service keys reach the browser.
- **Private cloud saves:** every universe table has owner-only row-level security. Universes can be created (blank or starter), archived, restored and deleted (type the name to confirm). Creation is idempotent, so a double tap never makes two universes. Save slots come from the server-side entitlement service (free: 3).
- **Fictional starter universe:** Ironside Pro Wrestling (yours) and Pacific Rift Wrestling (AI rival), 31 original wrestlers, tag teams, a faction, 7 championships with lineages, storylines, rivalries, 8 weeks of simulated history, the next weekly show booked and a major event coming up.
- **Dashboard:** next show, finances, champions, injuries, hottest storylines, momentum leaders, recent results, upcoming events and industry news.
- **Roster:** filter, search and sort; wrestler profiles with independent 0–100 attributes (no overall rating), record, title history, storylines, rivalries, chemistry, recent matches and career timeline; create/edit wrestlers; sign, release and transfer contracts; real or storyline injuries; retire and archive.
- **Teams and factions:** create, add/remove members with roles, membership history, disband/reunite.
- **Promotions and venues:** create, edit, archive; promotions can be player- or AI-controlled.
- **Championships:** create with eligibility rules, lineage with stats, vacate/strip, manual award override, editing past reigns with a "this rewrites history" confirmation and overlap checks, retire/reactivate, delete.
- **Booking:** calendar of your shows and rival shows, schedule shows, segment editor (11 segment types, 10 match types, 12 stipulations, title matches, planned winners and finish styles, interference, storylines, teams), drag-and-drop or arrow-button running order, non-blocking booking warnings, auto-book, lock card, cancel.
- **Simulation:** seeded and deterministic; respects planned winners; favourites usually but not always win. Simulating runs any rival shows due first, advances the calendar (recovery, contracts, payroll, ability progression, rival signings) and saves everything in one database transaction. A second submit or another tab is rejected, so results are recorded exactly once. Results show star ratings, crowd reactions, recaps, "why this rating", the rating breakdown, attendance and finances. Results can be edited afterwards with a clear warning that consequences aren't recalculated.

## Test results

- Typecheck: clean.
- Unit (Vitest): 5/5 passing (planner: rival shows, determinism, chronology guard, exactly-once guard).
- End-to-end (Playwright, mobile Pixel 7 against local Supabase): 2/2 passing. One covers roster, contract, injury, team and championship flows; the other covers booking, reordering and simulating a show, with checks for no horizontal scrolling on mobile and no page errors.

## Known limitations (in progress)

Storylines, history, finances, settings and account pages; image uploads; export/import and the community library; moderation and policy pages; entitlement UI; the full unit, integration and e2e suites; README and `.env.example`. Tournaments exist in the data model and engine but have no UI yet.

## How to run

```bash
npm install
npx supabase start          # local Postgres, Auth, Storage, Mailpit
cp .env.example .env.local  # fill in the keys printed by `supabase start`
npm run dev                 # http://localhost:3000
```

Verification emails arrive in the local Mailpit inbox at http://127.0.0.1:54324.
