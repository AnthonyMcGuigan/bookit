# Architecture

## Layers

1. **Domain** (`lib/domain`): Zod schemas whose fields match the Postgres columns, so the same shapes flow through the database, packages and the engine. No React, Next.js or Supabase imports.
2. **Engine** (`lib/simulation`): pure functions over a `UniverseState`. It never mutates its input; it produces `WorldChanges` describing what happened.
   - `planSimulation` advances the calendar day by day: rival shows are auto-booked and simulated, then the player's show, then the next weekly rival show is scheduled. Each step is one `WorldChanges`.
   - Randomness comes from `createRng(seed)`. The server seeds with `${universeId}:r${revision}:${target}`, so a given save state always produces the same result, and a predetermined winner is always honoured (finish planning only changes *how* they win).
   - `applyChanges` applies a step to in-memory state; it mirrors the database function `apply_world_changes`, and a unit test checks the two paths agree.
3. **Persistence** (`supabase/migrations`, `lib/storage`, `lib/game`): RLS on every table; game writes go through security-invoker RPCs, so RLS still applies.
   - `simulate_batch` locks the universe row, checks the expected `revision`, inserts generated rival shows and applies every step in one transaction. A double submit or a second tab gets `UNIVERSE_CHANGED`, so results are saved exactly once.
   - `import_universe_rows` inserts whole states (new universes, imports) and forces the universe id on every row.
4. **Application** (`features/*`, `app/*`): server actions authenticate with `requireUser`, validate with Zod, call the engine and RPCs, then revalidate. Client components only handle interaction (drag-and-drop, editors, wizards).

## Security model

- Private game data: owner-only RLS policy on `universes` and every child table (composite foreign keys keep children inside their universe).
- Accounts: `profiles` are public creator identities; email stays in `auth.users`.
- Entitlements, roles, restrictions, counters and moderation state can't be written by clients. They change only through security-definer functions that check `auth.uid()` and roles, or through the service role after server-side verification.
- Community creations: owners may edit descriptive fields and visibility through column grants; a trigger blocks re-publishing removed content and enforces the active-creation quota. `publish_creation` does every authority check (restrictions, rate limits, quota, remix permission, image ownership, moderation routing) atomically.
- Images: uploads are decoded, size- and dimension-checked, re-encoded to WebP (metadata stripped) and written with the service role. `/media/[id]` serves an image only if RLS lets the requester see the asset row, and shared images only while their creation is visible (`public_asset_visible`). Neither bucket is publicly readable.
- Packages: untrusted JSON/ZIP is size-limited, migrated, validated row by row against the entity schemas, re-identified with fresh ids, and reference-checked before insertion. ZIP reading rejects excessive entries and expansion, and ignores unexpected paths.

## Packages

`{ format: "pwbs-package", schemaVersion, kind, title, universe?, content: { <collection>: rows[] }, media: [{ id, kind, file }], attribution }`

- `lib/packages/migrate.ts` upgrades older versions step by step; newer versions are rejected.
- `build.ts` selects rows per kind and prunes dangling references (promotion references may dangle in single-entity packages; the importer reassigns them).
- `merge.ts` detects name conflicts against the target universe and applies resolutions. Relationship rows between records that already existed are not imported, so imports never rewrite a save's own history.

## Entitlements

`effective_plan(user)` reads `entitlements` (honouring `development` rows only while `app_config.dev_entitlements_enabled`) and `plan_limits`. The app reads limits through `my_entitlements()`. Expired Premium never deletes or locks data; limits apply to new actions only. See [billing.md](billing.md).
