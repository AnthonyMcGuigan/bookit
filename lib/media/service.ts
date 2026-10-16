import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MediaKind } from "@/lib/domain/enums";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { AppError } from "@/lib/errors";
import { processImage, type ProcessedImage } from "./process";

/** Validates, re-encodes and stores an image for the signed-in user. Returns the new asset id. */
export async function storeUserImage(supabase: AppSupabaseClient, userId: string, file: File, kind: MediaKind): Promise<string> {
  const { error: rateError } = await supabase.rpc("consume_rate_limit", { p_action: "media_upload", p_max: 40, p_window: "1 hour" });
  if (rateError) throw rateError;
  const processed = await processImage(Buffer.from(await file.arrayBuffer()), kind);
  const summary = await getEntitlementSummary(supabase);
  const needed = processed.full.byteLength + processed.thumb.byteLength;
  if (summary.usage.media_storage_bytes + needed > summary.limits.media_storage_bytes) {
    throw new AppError("You've used all of your image storage. Remove some images (they stay safe until you do) or upgrade for more space.", "MEDIA_QUOTA", 402);
  }
  return storeProcessedImage(userId, processed, kind, { filename: file.name });
}

export interface StoreOptions {
  bucket?: "media-private" | "media-public";
  filename?: string | null;
  sourceAssetId?: string | null;
}

/**
 * Writes an already-validated image to storage and records it. Callers must
 * have authenticated the user and checked quota.
 */
export async function storeProcessedImage(userId: string, processed: ProcessedImage, kind: MediaKind, options: StoreOptions = {}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.webp`;
  const thumbPath = `${userId}/${id}.thumb.webp`;
  const bucket = options.bucket ?? "media-private";
  const up1 = await admin.storage.from(bucket).upload(path, processed.full, { contentType: "image/webp", upsert: false });
  if (up1.error) throw new AppError("Couldn't store the image. Please try again.", "STORAGE_ERROR", 503);
  const up2 = await admin.storage.from(bucket).upload(thumbPath, processed.thumb, { contentType: "image/webp", upsert: false });
  if (up2.error) {
    await admin.storage.from(bucket).remove([path]);
    throw new AppError("Couldn't store the image. Please try again.", "STORAGE_ERROR", 503);
  }
  const { error } = await admin.from("media_assets").insert({
    id,
    owner_id: userId,
    kind,
    bucket,
    storage_path: path,
    thumb_path: thumbPath,
    mime_type: "image/webp",
    bytes: processed.full.byteLength,
    thumb_bytes: processed.thumb.byteLength,
    width: processed.width,
    height: processed.height,
    sha256: processed.sha256,
    original_filename: options.filename?.slice(0, 200) ?? null,
    source_asset_id: options.sourceAssetId ?? null,
  });
  if (error) {
    await admin.storage.from(bucket).remove([path, thumbPath]);
    throw error;
  }
  return id;
}

/** Downloads an asset's full-size file with the service role. Callers check access first. */
export async function downloadAsset(asset: { bucket: string; storage_path: string }): Promise<Uint8Array | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(asset.bucket).download(asset.storage_path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** Marks an asset deleted and removes its files, if the user owns it. */
export async function deleteUserImage(userId: string, assetId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("media_assets").select("id, bucket, storage_path, thumb_path, owner_id").eq("id", assetId).eq("owner_id", userId).eq("status", "active").maybeSingle();
  if (!data) return;
  await admin.from("media_assets").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", data.id);
  await admin.storage.from(data.bucket).remove([data.storage_path, ...(data.thumb_path ? [data.thumb_path] : [])]);
}

/**
 * Copies one of the user's private images into the public bucket (for a
 * community publication). Returns the new public asset id and its size, or
 * null when the source isn't the user's active image.
 */
export async function copyAssetToPublic(userId: string, assetId: string): Promise<{ id: string; bytes: number } | null> {
  const admin = createSupabaseAdminClient();
  const { data: asset } = await admin
    .from("media_assets")
    .select("*")
    .eq("id", assetId)
    .eq("owner_id", userId)
    .eq("status", "active")
    .eq("bucket", "media-private")
    .maybeSingle();
  if (!asset) return null;
  const full = await admin.storage.from("media-private").download(asset.storage_path);
  const thumb = asset.thumb_path ? await admin.storage.from("media-private").download(asset.thumb_path) : null;
  if (full.error || !full.data) return null;
  const processed: ProcessedImage = {
    full: Buffer.from(await full.data.arrayBuffer()),
    thumb: thumb?.data ? Buffer.from(await thumb.data.arrayBuffer()) : Buffer.from(await full.data.arrayBuffer()),
    width: asset.width,
    height: asset.height,
    sha256: asset.sha256,
  };
  const id = await storeProcessedImage(userId, processed, asset.kind as MediaKind, { bucket: "media-public", sourceAssetId: asset.id, filename: asset.original_filename });
  return { id, bytes: processed.full.byteLength + processed.thumb.byteLength };
}

