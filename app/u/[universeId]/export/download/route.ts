import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exportPackage } from "@/lib/packages/service";
import { PACKAGE_KINDS } from "@/lib/packages/schema";
import { errorMessage } from "@/lib/errors";

const querySchema = z.object({
  kind: z.enum(PACKAGE_KINDS),
  root: z.uuid().optional(),
  format: z.enum(["json", "zip"]).default("zip"),
});

/** Downloads an export of the signed-in player's own universe. RLS limits it to their saves. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL(`/sign-in?next=/u/${universeId}/export`, request.url));
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(universeId)) return new NextResponse("Invalid export request", { status: 400 });
  const { kind, root, format } = parsed.data;
  if (kind !== "universe" && kind !== "scenario" && !root) return new NextResponse("Choose what to export", { status: 400 });
  const { data: owned } = await supabase.from("universes").select("id").eq("id", universeId).maybeSingle();
  if (!owned) return new NextResponse("Not found", { status: 404 });
  const { error: rateError } = await supabase.rpc("consume_rate_limit", { p_action: "package_export", p_max: 60, p_window: "1 hour" });
  if (rateError) return new NextResponse(errorMessage(rateError), { status: 429 });
  try {
    const file = await exportPackage(supabase, universeId, { kind, rootId: root ?? null, format });
    return new NextResponse(Buffer.from(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return new NextResponse(errorMessage(e), { status: 400 });
  }
}
