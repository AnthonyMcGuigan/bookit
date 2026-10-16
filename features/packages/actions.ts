"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient, type AppSupabaseClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/errors";
import { analysePackage, type ImportAnalysis, type Resolution } from "@/lib/packages/merge";
import { importPackage, loadFullUniverse, readUploadedPackage, type LoadedPackage } from "@/lib/packages/service";
import { loadCommunityPackage, type CommunitySource } from "@/lib/community/service";
import { PackageError } from "@/lib/packages/schema";

export interface ImportChoice {
  id: string;
  name: string;
}

export type AnalyseResult =
  | {
      ok: true;
      analysis: ImportAnalysis;
      universes: ImportChoice[];
      promotions: ImportChoice[];
      targetUniverseId: string | null;
      sourceLabel: string;
    }
  | { ok: false; error: string };

const uuid = z.uuid();

async function loadSource(supabase: AppSupabaseClient, formData: FormData): Promise<{ loaded: LoadedPackage; community: CommunitySource | null; label: string }> {
  if (formData.get("source") === "community") {
    const creationId = uuid.parse(formData.get("creationId"));
    const versionRaw = Number(formData.get("version"));
    const { loaded, source } = await loadCommunityPackage(supabase, creationId, Number.isInteger(versionRaw) && versionRaw > 0 ? versionRaw : null);
    return { loaded, community: source, label: `${source.title} (v${source.version}) by ${source.author}` };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) throw new PackageError("Choose a package file to import.");
  return { loaded: await readUploadedPackage(file), community: null, label: file.name };
}

export async function analyseImportAction(formData: FormData): Promise<AnalyseResult> {
  try {
    await requireUser("/universes/import");
    const supabase = await createSupabaseServerClient();
    const { loaded, label } = await loadSource(supabase, formData);
    const { data: universes } = await supabase.from("universes").select("id, name").is("archived_at", null).order("last_played_at", { ascending: false });
    const targetRaw = formData.get("targetUniverseId");
    const targetUniverseId = typeof targetRaw === "string" && uuid.safeParse(targetRaw).success ? targetRaw : null;
    const target = targetUniverseId ? await loadFullUniverse(supabase, targetUniverseId) : null;
    const analysis = analysePackage(loaded.pkg, target);
    return {
      ok: true,
      analysis,
      universes: universes ?? [],
      promotions: (target?.promotions ?? []).filter((p) => !p.archived_at).map((p) => ({ id: p.id, name: p.name })),
      targetUniverseId,
      sourceLabel: label,
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "That creation link isn't valid." };
    return { ok: false, error: errorMessage(e) };
  }
}

const resolutionSchema = z.record(
  z.string().max(120),
  z.object({ action: z.enum(["rename", "new", "skip", "existing"]), name: z.string().max(120).optional() }),
);

export async function runImportAction(formData: FormData): Promise<{ ok: false; error: string; warnings?: string[] }> {
  const user = await requireUser("/universes/import");
  let destination: string;
  try {
    const supabase = await createSupabaseServerClient();
    const { loaded, community } = await loadSource(supabase, formData);
    const resolutionsRaw = String(formData.get("resolutions") ?? "{}");
    const resolutions = resolutionSchema.parse(JSON.parse(resolutionsRaw.length > 200_000 ? "{}" : resolutionsRaw)) as Record<string, Resolution>;
    const targetRaw = String(formData.get("targetUniverseId") ?? "");
    const promotionRaw = String(formData.get("defaultPromotionId") ?? "");
    const keyRaw = String(formData.get("idempotencyKey") ?? "");
    const outcome = await importPackage(supabase, user.id, loaded, {
      mode: formData.get("mode") === "into" ? "into" : "new",
      targetUniverseId: uuid.safeParse(targetRaw).success ? targetRaw : null,
      universeName: String(formData.get("universeName") ?? "").slice(0, 80) || null,
      resolutions,
      defaultPromotionId: uuid.safeParse(promotionRaw).success ? promotionRaw : null,
      origin: community ? "community_import" : "file_import",
      source: community ? { creationId: community.creationId, version: community.version, title: community.title, author: community.author } : null,
      idempotencyKey: uuid.safeParse(keyRaw).success ? keyRaw : null,
    });
    if (community) {
      // Counted once per user; failures here never undo a finished import.
      await supabase.rpc("record_creation_download", { p_creation: community.creationId, p_version: community.version });
    }
    revalidatePath("/universes");
    revalidatePath(`/u/${outcome.universeId}`, "layout");
    const params = new URLSearchParams({ imported: String(outcome.imported) });
    if (outcome.warnings.length) params.set("warnings", outcome.warnings.join(" ").slice(0, 600));
    destination = `/u/${outcome.universeId}?${params}`;
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Some import choices were invalid. Please review them and try again." };
    return { ok: false, error: errorMessage(e) };
  }
  redirect(destination);
}
