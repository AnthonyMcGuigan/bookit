"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/errors";
import { buildStarterUniverse, emptyUniverseState } from "@/lib/seed/starter";
import { remapUniverseIds, toImportRows } from "@/lib/storage/remap";
import { importUniverseRows } from "@/lib/storage/universe-repo";
import { universeRow } from "@/lib/storage/universe-row";
import type { Promotion } from "@/lib/domain/entities";
import { settingsFromForm } from "./settings-input";

const createSchema = z.object({
  mode: z.enum(["blank", "starter"]),
  name: z.string().trim().min(1, "Give your universe a name").max(80),
  promotionName: z.string().trim().max(80).optional(),
  startDate: z.iso.date().optional(),
  idempotencyKey: z.uuid(),
});

export async function createUniverseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    mode: formData.get("mode"),
    name: formData.get("name"),
    promotionName: formData.get("promotionName") || undefined,
    startDate: formData.get("startDate") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  // A retried submission with the same key returns the universe already created.
  const existing = await supabase.from("universes").select("id").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing.data) redirect(`/u/${existing.data.id}`);

  let universeId: string;
  try {
    const settings = settingsFromForm(formData);
    const now = new Date().toISOString();
    if (input.mode === "starter") {
      const starter = buildStarterUniverse({ settings, name: input.name });
      const { state } = remapUniverseIds(starter);
      state.universe.name = input.name;
      state.universe.settings = settings;
      state.universe.idempotency_key = input.idempotencyKey;
      if (!settings.financesEnabled) {
        state.financialTransactions = [];
        for (const p of state.promotions) p.cash_balance = 0;
      }
      universeId = await importUniverseRows(supabase, universeRow(state.universe), state.universe.id, toImportRows(state, now));
    } else {
      const startDate = input.startDate ?? new Date().toISOString().slice(0, 10);
      const id = crypto.randomUUID();
      const state = emptyUniverseState({
        id,
        owner_id: "00000000-0000-4000-8000-000000000000",
        name: input.name,
        description: "",
        origin: "blank",
        source_creation_id: null,
        source_version: null,
        attribution: [],
        start_date: startDate,
        game_date: startDate,
        settings,
        schema_version: 1,
        revision: 0,
        idempotency_key: input.idempotencyKey,
        archived_at: null,
        last_played_at: now,
        created_at: now,
        updated_at: now,
      });
      const promotion: Promotion = {
        id: crypto.randomUUID(),
        universe_id: id,
        name: input.promotionName || `${input.name} Wrestling`,
        abbreviation: abbreviate(input.promotionName || `${input.name} Wrestling`),
        tagline: "",
        description: "",
        region: "National",
        audience_profile: "mainstream",
        primary_color: "#b91c1c",
        secondary_color: "#111827",
        logo_asset_id: null,
        reputation: 30,
        popularity: 25,
        controlled_by: "player",
        cash_balance: settings.financesEnabled ? settings.startingCapital : 0,
        founded_on: startDate,
        archived_at: null,
        created_at: now,
        updated_at: now,
      };
      state.promotions.push(promotion);
      if (settings.financesEnabled) {
        state.financialTransactions.push({
          id: crypto.randomUUID(), universe_id: id, promotion_id: promotion.id, occurred_on: startDate,
          category: "starting_capital", amount: settings.startingCapital, show_id: null, description: "Starting capital", created_at: now,
        });
      }
      universeId = await importUniverseRows(supabase, universeRow(state.universe), id, toImportRows(state, now));
    }
  } catch (e) {
    // Concurrent duplicate submission: send the player to the universe that won.
    const retry = await supabase.from("universes").select("id").eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (retry.data) redirect(`/u/${retry.data.id}`);
    return { error: errorMessage(e) };
  }
  revalidatePath("/universes");
  redirect(`/u/${universeId}`);
}


function abbreviate(name: string): string {
  const letters = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase();
  return (letters || name.slice(0, 3).toUpperCase()).slice(0, 8);
}

const idSchema = z.uuid();

export async function archiveUniverseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = idSchema.parse(formData.get("universeId"));
  const archive = formData.get("archive") === "true";
  const supabase = await createSupabaseServerClient();
  await supabase.from("universes").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/universes");
}

export async function deleteUniverseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("universeId"));
  if (!id.success) return { error: "Invalid universe." };
  const supabase = await createSupabaseServerClient();
  const { data: universe } = await supabase.from("universes").select("name").eq("id", id.data).maybeSingle();
  if (!universe) return { error: "Universe not found." };
  if (String(formData.get("confirmName") ?? "").trim() !== universe.name) {
    return { error: `Type "${universe.name}" exactly to confirm deletion.` };
  }
  const { error } = await supabase.from("universes").delete().eq("id", id.data);
  if (error) return { error: errorMessage(error) };
  revalidatePath("/universes");
  redirect("/universes");
}

export async function updateUniverseSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = idSchema.safeParse(formData.get("universeId"));
  if (!id.success) return { error: "Invalid universe." };
  const name = z.string().trim().min(1).max(80).safeParse(formData.get("name"));
  if (!name.success) return { error: "Name is required.", fieldErrors: { name: ["Name is required"] } };
  const description = String(formData.get("description") ?? "").slice(0, 2000);
  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase.from("universes").select("settings").eq("id", id.data).maybeSingle();
  if (!current) return { error: "Universe not found." };
  let settings;
  try {
    settings = settingsFromForm(formData, current.settings as never);
  } catch {
    return { error: "Some settings were invalid." };
  }
  const { error } = await supabase.from("universes").update({ name: name.data, description, settings }).eq("id", id.data);
  if (error) return { error: errorMessage(error) };
  revalidatePath(`/u/${id.data}`, "layout");
  return { ok: true, message: "Settings saved." };
}
