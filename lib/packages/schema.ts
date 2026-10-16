/**
 * Versioned package format for exports, backups and community creations.
 * A package carries entity rows in the same shape as UniverseState (minus
 * universe ids and timestamps), validated row-by-row on import.
 */
import { z } from "zod";
import {
  businessDealSchema,
  championshipSchema,
  chemistrySchema,
  contractSchema,
  financialTransactionSchema,
  injurySchema,
  promotionSchema,
  rivalrySchema,
  rosterMembershipSchema,
  segmentParticipantSchema,
  segmentResultSchema,
  segmentSchema,
  showSchema,
  storylineDevelopmentSchema,
  storylineParticipantSchema,
  storylineSchema,
  teamMembershipSchema,
  teamSchema,
  timelineEventSchema,
  titleReignHolderSchema,
  titleReignSchema,
  tournamentSchema,
  venueSchema,
  wrestlerSchema,
  type UniverseCollectionKey,
} from "@/lib/domain/entities";
import { universeSettingsSchema } from "@/lib/domain/settings";

export const PACKAGE_FORMAT = "pwbs-package";
export const PACKAGE_SCHEMA_VERSION = 1;

export const PACKAGE_KINDS = ["wrestler", "team", "championship", "promotion", "venue", "storyline", "scenario", "universe"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];
export const PACKAGE_KIND_LABELS: Record<PackageKind, string> = {
  wrestler: "Wrestler",
  team: "Tag team / faction",
  championship: "Championship",
  promotion: "Promotion",
  venue: "Venue",
  storyline: "Storyline",
  scenario: "Scenario",
  universe: "Full universe",
};

export const LIMITS = {
  /** Uploaded file size (JSON or ZIP). */
  maxFileBytes: 25 * 1024 * 1024,
  /** Decompressed JSON size. */
  maxJsonBytes: 20 * 1024 * 1024,
  /** Community packages are stored in the database. */
  maxCommunityJsonBytes: 4 * 1024 * 1024,
  maxRowsPerCollection: 20000,
  maxZipEntries: 400,
  maxZipUncompressedBytes: 80 * 1024 * 1024,
  maxMediaFiles: 300,
  maxMediaBytes: 5 * 1024 * 1024,
} as const;

/** Row schemas keyed by collection. */
export const COLLECTION_SCHEMAS = {
  promotions: promotionSchema,
  venues: venueSchema,
  wrestlers: wrestlerSchema,
  rosterMemberships: rosterMembershipSchema,
  contracts: contractSchema,
  injuries: injurySchema,
  teams: teamSchema,
  teamMemberships: teamMembershipSchema,
  chemistry: chemistrySchema,
  championships: championshipSchema,
  titleReigns: titleReignSchema,
  titleReignHolders: titleReignHolderSchema,
  shows: showSchema,
  tournaments: tournamentSchema,
  segments: segmentSchema,
  segmentParticipants: segmentParticipantSchema,
  segmentResults: segmentResultSchema,
  storylines: storylineSchema,
  storylineParticipants: storylineParticipantSchema,
  storylineDevelopments: storylineDevelopmentSchema,
  rivalries: rivalrySchema,
  businessDeals: businessDealSchema,
  financialTransactions: financialTransactionSchema,
  timelineEvents: timelineEventSchema,
} satisfies Record<UniverseCollectionKey, z.ZodType>;

/** Foreign references inside packages; used to drop or null dangling links. */
export interface RefSpec {
  col: string;
  to: UniverseCollectionKey;
  required: boolean;
}
export const REFS: Partial<Record<UniverseCollectionKey, RefSpec[]>> = {
  rosterMemberships: [{ col: "wrestler_id", to: "wrestlers", required: true }, { col: "promotion_id", to: "promotions", required: true }],
  contracts: [{ col: "wrestler_id", to: "wrestlers", required: true }, { col: "promotion_id", to: "promotions", required: true }],
  injuries: [{ col: "wrestler_id", to: "wrestlers", required: true }, { col: "segment_id", to: "segments", required: false }],
  teams: [{ col: "promotion_id", to: "promotions", required: false }],
  teamMemberships: [{ col: "team_id", to: "teams", required: true }, { col: "wrestler_id", to: "wrestlers", required: true }],
  chemistry: [{ col: "wrestler_a", to: "wrestlers", required: true }, { col: "wrestler_b", to: "wrestlers", required: true }],
  championships: [{ col: "promotion_id", to: "promotions", required: true }],
  titleReigns: [
    { col: "championship_id", to: "championships", required: true },
    { col: "team_id", to: "teams", required: false },
    { col: "won_segment_id", to: "segments", required: false },
    { col: "lost_segment_id", to: "segments", required: false },
  ],
  titleReignHolders: [{ col: "reign_id", to: "titleReigns", required: true }, { col: "wrestler_id", to: "wrestlers", required: true }],
  shows: [{ col: "promotion_id", to: "promotions", required: true }, { col: "venue_id", to: "venues", required: false }],
  tournaments: [{ col: "promotion_id", to: "promotions", required: true }, { col: "championship_id", to: "championships", required: false }, { col: "winner_wrestler_id", to: "wrestlers", required: false }],
  segments: [{ col: "show_id", to: "shows", required: true }, { col: "storyline_id", to: "storylines", required: false }, { col: "championship_id", to: "championships", required: false }, { col: "tournament_id", to: "tournaments", required: false }],
  segmentParticipants: [{ col: "segment_id", to: "segments", required: true }, { col: "wrestler_id", to: "wrestlers", required: true }, { col: "team_id", to: "teams", required: false }],
  segmentResults: [{ col: "segment_id", to: "segments", required: true }, { col: "show_id", to: "shows", required: true }],
  storylines: [{ col: "promotion_id", to: "promotions", required: false }, { col: "championship_id", to: "championships", required: false }],
  storylineParticipants: [{ col: "storyline_id", to: "storylines", required: true }, { col: "wrestler_id", to: "wrestlers", required: false }, { col: "team_id", to: "teams", required: false }],
  storylineDevelopments: [{ col: "storyline_id", to: "storylines", required: true }, { col: "show_id", to: "shows", required: false }, { col: "segment_id", to: "segments", required: false }],
  rivalries: [{ col: "wrestler_a", to: "wrestlers", required: true }, { col: "wrestler_b", to: "wrestlers", required: true }, { col: "storyline_id", to: "storylines", required: false }],
  businessDeals: [{ col: "promotion_id", to: "promotions", required: true }],
  financialTransactions: [{ col: "promotion_id", to: "promotions", required: true }, { col: "show_id", to: "shows", required: false }],
  timelineEvents: [{ col: "promotion_id", to: "promotions", required: false }, { col: "show_id", to: "shows", required: false }, { col: "segment_id", to: "segments", required: false }, { col: "championship_id", to: "championships", required: false }],
};

/** Media columns per collection (asset ids are always re-created on import). */
export const MEDIA_COLUMNS: Partial<Record<UniverseCollectionKey, string>> = {
  promotions: "logo_asset_id",
  venues: "image_asset_id",
  wrestlers: "portrait_asset_id",
  teams: "logo_asset_id",
  championships: "image_asset_id",
  shows: "poster_asset_id",
};

/** Collections that can be name-matched against an existing universe during import. */
export const MATCHABLE: Partial<Record<UniverseCollectionKey, string>> = {
  promotions: "name",
  venues: "name",
  wrestlers: "ring_name",
  teams: "name",
  championships: "name",
  storylines: "title",
};

const rowArray = z.array(z.record(z.string(), z.unknown())).max(LIMITS.maxRowsPerCollection);

export const packageEnvelopeSchema = z.object({
  format: z.literal(PACKAGE_FORMAT),
  schemaVersion: z.int().min(1),
  kind: z.enum(PACKAGE_KINDS),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(5000).default(""),
  exportedAt: z.string().max(40),
  generator: z.string().max(80).default("unknown"),
  universe: z
    .object({
      name: z.string().trim().min(1).max(80),
      description: z.string().max(2000).default(""),
      start_date: z.iso.date(),
      game_date: z.iso.date(),
      settings: z.unknown(),
    })
    .nullable()
    .default(null),
  content: z.record(z.string(), rowArray),
  media: z
    .array(z.object({ id: z.uuid(), kind: z.string().max(40), file: z.string().regex(/^media\/[0-9a-f-]{36}\.(webp|png|jpe?g)$/) }))
    .max(LIMITS.maxMediaFiles)
    .default([]),
  attribution: z
    .array(z.object({ creationId: z.uuid(), version: z.int(), title: z.string().max(120), author: z.string().max(80) }))
    .max(50)
    .default([]),
});
export type PackageEnvelope = z.infer<typeof packageEnvelopeSchema>;

export type PackageContent = Partial<Record<UniverseCollectionKey, Array<Record<string, unknown>>>>;

export interface ValidPackage extends Omit<PackageEnvelope, "content" | "universe"> {
  content: PackageContent;
  universe: (Omit<NonNullable<PackageEnvelope["universe"]>, "settings"> & { settings: z.infer<typeof universeSettingsSchema> }) | null;
}

export class PackageError extends Error {}
