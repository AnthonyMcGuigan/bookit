import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Serves an image. Private images are only returned to their owner (RLS on
 * media_assets decides visibility); public images to anyone.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data: asset } = await supabase.from("media_assets").select("bucket, storage_path, thumb_path, mime_type, status").eq("id", assetId).eq("status", "active").maybeSingle();
  if (!asset) return new NextResponse("Not found", { status: 404 });
  const variant = request.nextUrl.searchParams.get("v") === "full" ? "full" : "thumb";
  const path = variant === "thumb" && asset.thumb_path ? asset.thumb_path : asset.storage_path;
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return new NextResponse("Image storage is not configured", { status: 503 });
  }
  const { data, error } = await admin.storage.from(asset.bucket).download(path);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": asset.mime_type,
      "Cache-Control": asset.bucket === "media-public" ? "public, max-age=86400, immutable" : "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
