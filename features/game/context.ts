import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient, type AppSupabaseClient } from "@/lib/supabase/server";
import { parseSettings, type UniverseSettings } from "@/lib/domain/settings";
import { AppError, NotFoundError, errorMessage } from "@/lib/errors";
import type { TimelineKind } from "@/lib/domain/enums";

export interface UniverseActionContext {
  supabase: AppSupabaseClient;
  universeId: string;
  gameDate: string;
  settings: UniverseSettings;
  userId: string;
}

/** Authenticates the player and loads the universe named by the form (RLS enforces ownership). */
export async function universeAction(formData: FormData): Promise<UniverseActionContext> {
  const user = await requireUser();
  const parsed = z.uuid().safeParse(formData.get("universeId"));
  if (!parsed.success) throw new NotFoundError("Universe not found.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("universes").select("id, game_date, settings").eq("id", parsed.data).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Universe not found.");
  return { supabase, universeId: data.id, gameDate: data.game_date, settings: parseSettings(data.settings), userId: user.id };
}

/** Plain object of the form's single-valued fields (empty strings become undefined). */
export function formFields(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    out[key] = value === "" ? undefined : value;
  }
  return out;
}

export function formIds(formData: FormData, name: string): string[] {
  return [...new Set(formData.getAll(name).map(String).filter((v) => z.uuid().safeParse(v).success))];
}

export function checked(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

export function invalid(error: z.ZodError, message = "Please fix the highlighted fields."): ActionState {
  return { error: message, fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

export function failure(error: unknown): ActionState {
  if (process.env.NODE_ENV !== "production" && !(error instanceof AppError)) console.error(error);
  return { error: errorMessage(error) };
}

/** Throws when a Supabase write failed. */
export function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}

export function revalidateUniverse(universeId: string) {
  revalidatePath(`/u/${universeId}`, "layout");
}

export async function addTimeline(
  ctx: UniverseActionContext,
  event: {
    kind: TimelineKind;
    title: string;
    summary?: string;
    occurred_on?: string;
    promotion_id?: string | null;
    wrestler_ids?: string[];
    championship_id?: string | null;
    show_id?: string | null;
    importance?: number;
  },
) {
  check(
    await ctx.supabase.from("timeline_events").insert({
      universe_id: ctx.universeId,
      kind: event.kind,
      title: event.title.slice(0, 200),
      summary: (event.summary ?? "").slice(0, 2000),
      occurred_on: event.occurred_on ?? ctx.gameDate,
      promotion_id: event.promotion_id ?? null,
      wrestler_ids: event.wrestler_ids ?? [],
      championship_id: event.championship_id ?? null,
      show_id: event.show_id ?? null,
      importance: event.importance ?? 2,
    }),
  );
}

/** Zod helpers for HTML form values. */
export const formNumber = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
export const optionalDate = z.iso.date().optional().transform((v) => v ?? null);
export const optionalUuid = z.uuid().optional().transform((v) => v ?? null);
