import type { Universe } from "@/lib/domain/entities";

/** The subset of universe fields accepted by import_universe_rows. */
export function universeRow(u: Universe) {
  return {
    id: u.id,
    name: u.name,
    description: u.description,
    origin: u.origin,
    source_creation_id: u.source_creation_id,
    source_version: u.source_version,
    attribution: u.attribution,
    start_date: u.start_date,
    game_date: u.game_date,
    settings: u.settings,
    schema_version: u.schema_version,
    idempotency_key: u.idempotency_key,
  };
}
