import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/server";

export const CREATION_LIST_COLUMNS =
  "id, title, summary, category, tags, thumbnail_asset_id, rating_count, rating_sum, download_count, owner_id, is_fan_content, visibility, moderation_state, published_at, updated_at, current_version";

/** Public profile fields for a set of users. */
export async function profilesFor(supabase: AppSupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, { handle: string; display_name: string }>();
  const { data } = await supabase.from("profiles").select("id, handle, display_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, { handle: p.handle, display_name: p.display_name }]));
}

/** Strips characters that have meaning in PostgREST filter syntax. */
export function safeSearch(q: string): string {
  return q.replace(/[%_,.()*:\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
