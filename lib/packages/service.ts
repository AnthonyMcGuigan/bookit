import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { MediaKind } from "@/lib/domain/enums";
import type { UniverseState } from "@/lib/domain/entities";
import { MEDIA_KINDS } from "@/lib/domain/enums";
import { loadUniverseState, importUniverseRows } from "@/lib/storage/universe-repo";
import { universeRow } from "@/lib/storage/universe-row";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { processImage, type ProcessedImage } from "@/lib/media/process";
import { deleteUserImage, downloadAsset, storeProcessedImage } from "@/lib/media/service";
import { buildPackage, packageFilename, type BuildOptions } from "./build";
import { createsUniverse, preparePackageImport, type Resolution } from "./merge";
import { LIMITS, PackageError, type PackageEnvelope, type ValidPackage } from "./schema";
import { parsePackageJson } from "./validate";
import { isZip, readPackageZip, writePackageZip } from "./zip";

/** Loads a universe with its complete history (exports need everything). */
export function loadFullUniverse(supabase: AppSupabaseClient, universeId: string): Promise<UniverseState> {
  return loadUniverseState(supabase, universeId, { historyFrom: null });
}

export interface ExportFile {
  filename: string;
  contentType: string;
  body: Uint8Array;
}

/** Builds a JSON or ZIP export of the player's own universe (or one entity in it). */
export async function exportPackage(
  supabase: AppSupabaseClient,
  universeId: string,
  options: BuildOptions & { format: "json" | "zip" },
): Promise<ExportFile> {
  const state = await loadFullUniverse(supabase, universeId);
  const pkg = buildPackage(state, options);
  if (options.format === "json") {
    // JSON exports carry no image files, so image references are dropped.
    const json = JSON.stringify({ ...pkg, media: [] }, null, 2);
    return { filename: packageFilename(pkg, "json"), contentType: "application/json", body: new TextEncoder().encode(json) };
  }
  const files: Array<{ file: string; data: Uint8Array }> = [];
  const included: PackageEnvelope["media"] = [];
  if (pkg.media.length) {
    // RLS limits this to the player's own assets.
    const { data } = await supabase
      .from("media_assets")
      .select("id, bucket, storage_path")
      .in("id", pkg.media.map((m) => m.id))
      .eq("status", "active");
    for (const asset of data ?? []) {
      const bytes = await downloadAsset(asset);
      if (!bytes) continue;
      const entry = pkg.media.find((m) => m.id === asset.id)!;
      files.push({ file: entry.file, data: bytes });
      included.push(entry);
    }
  }
  const json = JSON.stringify({ ...pkg, media: included }, null, 2);
  return { filename: packageFilename(pkg, "zip"), contentType: "application/zip", body: writePackageZip(json, files) };
}

export interface LoadedPackage {
  pkg: ValidPackage;
  /** Loads the bytes of a media entry, or null when it isn't available. */
  loadMedia: (entry: ValidPackage["media"][number]) => Promise<Uint8Array | null>;
}

/** Reads an uploaded .json or .zip package. Throws PackageError with a player-facing message. */
export async function readUploadedPackage(file: File): Promise<LoadedPackage> {
  if (file.size === 0) throw new PackageError("Choose a package file to import.");
  if (file.size > LIMITS.maxFileBytes) throw new PackageError("Package files must be 25 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isZip(bytes)) {
    const { json, media } = readPackageZip(bytes);
    const pkg = parsePackageJson(json);
    return { pkg, loadMedia: async (entry) => media.get(entry.file.toLowerCase()) ?? null };
  }
  const pkg = parsePackageJson(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  return { pkg: { ...pkg, media: [] }, loadMedia: async () => null };
}

export interface ImportRequest {
  mode: "new" | "into";
  targetUniverseId?: string | null;
  universeName?: string | null;
  resolutions?: Record<string, Resolution>;
  defaultPromotionId?: string | null;
  origin: "file_import" | "community_import";
  source?: { creationId: string; version: number; title: string; author: string } | null;
  idempotencyKey?: string | null;
}

export interface ImportOutcome {
  universeId: string;
  imported: number;
  warnings: string[];
}

function mediaKind(kind: string): MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(kind) ? (kind as MediaKind) : "portrait";
}

/**
 * Imports a validated package for the signed-in user. Images are decoded and
 * re-encoded into the user's private storage (never shared with the source),
 * and every record gets a fresh id inside the user's own universe.
 */
export async function importPackage(supabase: AppSupabaseClient, userId: string, loaded: LoadedPackage, request: ImportRequest): Promise<ImportOutcome> {
  const { pkg } = loaded;
  const warnings: string[] = [];
  const { error: rateError } = await supabase.rpc("consume_rate_limit", { p_action: "package_import", p_max: 20, p_window: "1 hour" });
  if (rateError) throw rateError;

  const newUniverse = createsUniverse(pkg) || request.mode === "new";
  let target: UniverseState | null = null;
  if (!newUniverse) {
    if (!request.targetUniverseId) throw new PackageError("Choose a universe to import into.");
    target = await loadFullUniverse(supabase, request.targetUniverseId);
  }
  if (!createsUniverse(pkg) && newUniverse) throw new PackageError("Only universe and scenario packages can start a new universe.");

  const universeId = newUniverse ? crypto.randomUUID() : target!.universe.id;
  const now = new Date().toISOString();

  // Plan once without media to learn which images survive the merge.
  const dryRun = preparePackageImport(pkg, {
    targetUniverseId: universeId,
    target,
    resolutions: request.resolutions,
    defaultPromotionId: request.defaultPromotionId,
    mediaMap: new Map(pkg.media.map((m) => [m.id, m.id])),
    now,
  });
  const wanted = new Set<string>();
  for (const rows of Object.values(dryRun.rows)) {
    for (const row of rows as Array<Record<string, unknown>>) {
      for (const col of ["logo_asset_id", "image_asset_id", "portrait_asset_id", "poster_asset_id"]) {
        if (typeof row[col] === "string") wanted.add(row[col] as string);
      }
    }
  }

  // Re-encode and store the images that will be used, within the user's quota.
  const mediaMap = new Map<string, string>();
  const stored: string[] = [];
  const entries = pkg.media.filter((m) => wanted.has(m.id));
  if (entries.length) {
    const processed: Array<{ id: string; kind: MediaKind; image: ProcessedImage }> = [];
    let invalid = 0;
    for (const entry of entries) {
      const bytes = await loaded.loadMedia(entry);
      if (!bytes) continue;
      try {
        processed.push({ id: entry.id, kind: mediaKind(entry.kind), image: await processImage(Buffer.from(bytes), mediaKind(entry.kind)) });
      } catch {
        invalid++;
      }
    }
    if (invalid) warnings.push(`${invalid} image(s) in the package couldn't be read and were left out.`);
    const summary = await getEntitlementSummary(supabase);
    let available = summary.limits.media_storage_bytes - summary.usage.media_storage_bytes;
    let overQuota = 0;
    for (const item of processed) {
      const size = item.image.full.byteLength + item.image.thumb.byteLength;
      if (size > available) {
        overQuota++;
        continue;
      }
      const assetId = await storeProcessedImage(userId, item.image, item.kind, { filename: `${item.id}.webp` });
      stored.push(assetId);
      mediaMap.set(item.id, assetId);
      available -= size;
    }
    if (overQuota) warnings.push(`${overQuota} image(s) were skipped because your image storage is full.`);
  }

  try {
    const prepared = preparePackageImport(pkg, {
      targetUniverseId: universeId,
      target,
      resolutions: request.resolutions,
      defaultPromotionId: request.defaultPromotionId,
      mediaMap,
      now,
    });
    const dropped = Object.values(prepared.report.dropped).reduce((n, v) => n + (v ?? 0), 0);
    if (dropped) warnings.push(`${dropped} record(s) referred to things that weren't imported and were left out.`);
    const imported = Object.values(prepared.rows).reduce((n, rows) => n + rows.length, 0);
    if (imported === 0 && !newUniverse) throw new PackageError("Nothing to import: every record was skipped or already exists.");

    let universe: Record<string, unknown> | null = null;
    if (newUniverse) {
      const meta = pkg.universe;
      if (!meta) throw new PackageError("This package has no universe details.");
      const attribution = [...pkg.attribution, ...(request.source ? [request.source] : [])].slice(-50);
      universe = universeRow({
        id: universeId,
        owner_id: userId,
        name: (request.universeName?.trim() || meta.name).slice(0, 80),
        description: meta.description,
        origin: request.origin,
        source_creation_id: request.source?.creationId ?? null,
        source_version: request.source?.version ?? null,
        attribution,
        start_date: meta.start_date,
        game_date: meta.game_date,
        settings: meta.settings,
        schema_version: 1,
        revision: 0,
        idempotency_key: request.idempotencyKey ?? null,
        archived_at: null,
        last_played_at: now,
        created_at: now,
        updated_at: now,
      });
    }
    await importUniverseRows(supabase, universe, universeId, prepared.rows);
    return { universeId, imported, warnings };
  } catch (e) {
    // The import is one transaction; remove images stored for it so nothing leaks into quota.
    await Promise.all(stored.map((id) => deleteUserImage(userId, id).catch(() => undefined)));
    throw e;
  }
}
