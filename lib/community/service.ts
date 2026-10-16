import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { processImage } from "@/lib/media/process";
import { copyAssetToPublic, deleteUserImage, downloadAsset, storeProcessedImage } from "@/lib/media/service";
import { buildPackage } from "@/lib/packages/build";
import { loadFullUniverse, type LoadedPackage } from "@/lib/packages/service";
import { LIMITS, PACKAGE_SCHEMA_VERSION, PackageError, type PackageKind } from "@/lib/packages/schema";
import { countRows, validatePackage } from "@/lib/packages/validate";

export interface PublishInput {
  universeId: string;
  kind: PackageKind;
  rootId: string | null;
  creationId: string | null;
  title: string;
  summary: string;
  description: string;
  tags: string[];
  visibility: "draft" | "published" | "unlisted";
  isFanContent: boolean;
  allowDerivatives: boolean;
  changelog: string;
  includeImages: boolean;
  thumbnail: File | null;
}

export interface PublishResult {
  creationId: string;
  version: number;
  moderationState: string;
  reviewReason: string | null;
  warnings: string[];
}

/** Normalises free-text tags: lowercase words, max 10, max 24 chars each. */
export function normaliseTags(raw: string): string[] {
  const tags = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9 \-]/g, "").replace(/\s+/g, "-").slice(0, 24))
    .filter((t) => t.length >= 2);
  return [...new Set(tags)].slice(0, 10);
}

/**
 * Publishes (or adds a version to) a community creation built from one of
 * the user's universes. Images are copied to shareable storage; the private
 * originals are untouched. All authority checks happen in publish_creation.
 */
export async function publishFromUniverse(supabase: AppSupabaseClient, userId: string, input: PublishInput): Promise<PublishResult> {
  const warnings: string[] = [];
  const state = await loadFullUniverse(supabase, input.universeId);
  const envelope = buildPackage(state, { kind: input.kind, rootId: input.rootId, title: input.title, description: input.description });

  // Copy images to shareable storage within the user's quota.
  const copied: string[] = [];
  const idMap = new Map<string, string>();
  try {
    if (input.includeImages && envelope.media.length) {
      const summary = await getEntitlementSummary(supabase);
      let available = summary.limits.media_storage_bytes - summary.usage.media_storage_bytes;
      let skipped = 0;
      for (const entry of envelope.media) {
        if (available <= 0) {
          skipped++;
          continue;
        }
        const copy = await copyAssetToPublic(userId, entry.id);
        if (!copy) continue;
        copied.push(copy.id);
        idMap.set(entry.id, copy.id);
        available -= copy.bytes;
      }
      if (skipped) warnings.push(`${skipped} image(s) weren't included because your image storage is full.`);
    }
    let thumbnailId: string | null = null;
    if (input.thumbnail && input.thumbnail.size > 0) {
      const processed = await processImage(Buffer.from(await input.thumbnail.arrayBuffer()), "creation_thumbnail");
      thumbnailId = await storeProcessedImage(userId, processed, "creation_thumbnail", { bucket: "media-public", filename: input.thumbnail.name });
      copied.push(thumbnailId);
    } else if (idMap.size) {
      thumbnailId = [...idMap.values()][0];
    }

    // Swap private image ids for the public copies; drop references to images not included.
    let json = JSON.stringify({ ...envelope, media: envelope.media.filter((m) => idMap.has(m.id)) });
    for (const [from, to] of idMap) json = json.replaceAll(from, to);
    const pkg = JSON.parse(json) as typeof envelope;
    for (const m of pkg.media) m.file = `media/${m.id}.webp`;
    const finalJson = JSON.stringify(pkg);
    const bytes = new TextEncoder().encode(finalJson).byteLength;
    if (bytes > LIMITS.maxCommunityJsonBytes) {
      throw new PackageError("This creation is too large to share (over 4 MB of data). Try sharing a scenario instead of a full universe with history.");
    }
    // Validate exactly what will be stored.
    const valid = validatePackage(JSON.parse(finalJson));

    const source = state.universe.source_creation_id
      ? { id: state.universe.source_creation_id, version: state.universe.source_version }
      : null;
    const { data, error } = await supabase.rpc("publish_creation", {
      p_creation: input.creationId as string,
      p_category: input.kind,
      p_title: input.title,
      p_summary: input.summary,
      p_description: input.description,
      p_tags: input.tags,
      p_visibility: input.visibility,
      p_is_fan_content: input.isFanContent,
      p_allow_derivatives: input.allowDerivatives,
      p_source_creation: (source?.id ?? null) as string,
      p_source_version: (source?.version ?? null) as number,
      p_lineage: pkg.attribution as never,
      p_package: pkg as never,
      p_package_bytes: bytes,
      p_schema_version: PACKAGE_SCHEMA_VERSION,
      p_media: pkg.media.map((m) => m.id),
      p_thumbnail: thumbnailId as string,
      p_changelog: input.changelog,
      p_entity_counts: countRows(valid.content) as never,
    });
    if (error) throw error;
    const row = (data ?? [])[0];
    if (!row) throw new AppError("Publishing failed. Please try again.");
    return { creationId: row.creation_id, version: row.version, moderationState: row.moderation_state, reviewReason: row.review_reason, warnings };
  } catch (e) {
    await Promise.all(copied.map((id) => deleteUserImage(userId, id).catch(() => undefined)));
    throw e;
  }
}

export interface CommunitySource {
  creationId: string;
  version: number;
  title: string;
  author: string;
  allowDerivatives: boolean;
}

/** Loads a visible community creation's package for import (RLS decides visibility). */
export async function loadCommunityPackage(
  supabase: AppSupabaseClient,
  creationId: string,
  version?: number | null,
): Promise<{ loaded: LoadedPackage; source: CommunitySource }> {
  const { data: creation } = await supabase
    .from("community_creations")
    .select("id, title, current_version, allow_derivatives, owner_id")
    .eq("id", creationId)
    .maybeSingle();
  if (!creation || creation.current_version < 1) throw new PackageError("That creation isn't available.");
  const wanted = version ?? creation.current_version;
  const { data: row } = await supabase
    .from("creation_versions")
    .select("version, package, media_asset_ids")
    .eq("creation_id", creationId)
    .eq("version", wanted)
    .maybeSingle();
  if (!row) throw new PackageError("That version isn't available.");
  const pkg = validatePackage(row.package);
  const allowed = new Set(row.media_asset_ids);
  const loaded: LoadedPackage = {
    pkg,
    loadMedia: async (entry) => {
      if (!allowed.has(entry.id)) return null;
      const { data: asset } = await supabase.from("media_assets").select("bucket, storage_path").eq("id", entry.id).eq("status", "active").maybeSingle();
      if (!asset || asset.bucket !== "media-public") return null;
      return downloadAsset(asset);
    },
  };
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", creation.owner_id).maybeSingle();
  return {
    loaded,
    source: {
      creationId,
      version: row.version,
      title: creation.title,
      author: profile?.display_name ?? "Unknown creator",
      allowDerivatives: creation.allow_derivatives,
    },
  };
}
