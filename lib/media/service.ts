import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MediaKind } from "@/lib/domain/enums";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { AppError } from "@/lib/errors";
import { processImage } from "./process";

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
  const admin = createSupabaseAdminClient();
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.webp`;
  const thumbPath = `${userId}/${id}.thumb.webp`;
  const bucket = "media-private";
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
    original_filename: file.name.slice(0, 200),
  });
  if (error) {
    await admin.storage.from(bucket).remove([path, thumbPath]);
    throw error;
  }
  return id;
}

/** Marks an asset deleted and removes its files, if the user owns it. */
export async function deleteUserImage(userId: string, assetId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("media_assets").select("id, bucket, storage_path, thumb_path, owner_id").eq("id", assetId).eq("owner_id", userId).eq("status", "active").maybeSingle();
  if (!data) return;
  await admin.from("media_assets").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", data.id);
  await admin.storage.from(data.bucket).remove([data.storage_path, ...(data.thumb_path ? [data.thumb_path] : [])]);
}
