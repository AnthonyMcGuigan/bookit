# Milestone 2: packages, community and moderation

Branch `claude/core-game`, PR https://github.com/AnthonyMcGuigan/bookit/pull/1

## Implemented
- **Package format** (`lib/packages`): versioned `pwbs-package` JSON (schema v1, migration chain, newer versions rejected), every row validated against its entity schema, save-specific columns stripped. Kinds: universe, scenario (no history), wrestler, team, championship, promotion (roster, contracts, titles, current reigns), storyline, venue.
- **Export** (`/u/{id}/export`): JSON or ZIP with images; download route checks ownership via RLS and is rate limited.
- **Import** (`/universes/import`): JSON or ZIP, zip-bomb limits (entry count, declared and actual sizes, allowed paths only). The wizard shows contents, picks the target universe, lists name matches with *use existing / rename / duplicate / skip*, and asks for a promotion when records need one. All records get fresh ids, dangling references are repaired or dropped, images are re-encoded into the importer's private storage within quota, and failures roll back stored images.
- **Community**: publish from a universe (new creation or new version, tags, visibility, remix permission, fan-content flag, required rights confirmation, optional cover image), library with search, categories, tags, sorting and paging, creation pages with versions, contents, ratings (one per user, not your own), downloads (counted once per user), reports, remix lineage, My creations, edit and delete, creator profiles.
- **Publishing rules in the database** (`publish_creation`): restrictions, rate limit, active-creation quota (also enforced on draft → published), remix permission, image ownership, moderation routing (review mode, images, flagged terms). Shared images are served only while their creation is visible.
- **Moderation** (`/moderation`, moderators only): review queue, reports, appeals, IP takedowns, account restrictions, admin role changes, audit log. Every decision requires a reason. Creators see decisions and appeal under `/account/moderation`.
- **Policies**: content policy (incl. fan content rules), creator guidelines, IP page with a public takedown form (throttled per email; a linked creation is hidden pending review).
- `npm run role -- <email> moderator` grants a role locally with the service key.

## Tests
- Unit: 17 passing (12 new package tests: round trips, scenario, team package, version/format rejection, invalid rows, new-universe import, each conflict resolution, promotion reassignment, ZIP round trip, zip bomb, path traversal).
- E2E (mobile, against local Supabase): community flow (export, publish, anon library view, rate, import with rename, download count, full-universe file import, report) and moderation flow (pending invisible incl. image, approve, IP report auto-hide, appeal and uphold, audit log, restriction blocks publishing but not play, anonymous takedown hides content). All pass.

## Known limitations
- No outbound email for moderation or takedown replies; moderators contact claimants manually (stated in the UI).
- Library search uses simple substring matching; fine at this scale, swap to full-text ranking later.
- Policy pages are templates and say operators should review them with counsel.

## Run
`npx supabase start`, `npx supabase db reset`, copy `.env.example` to `.env.local` with the local keys, `npm run dev`.
