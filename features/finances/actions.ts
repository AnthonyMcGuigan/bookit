"use server";

import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { emptyChanges } from "@/lib/simulation/changes";
import { failure, formFields, invalid, revalidateUniverse, universeAction } from "@/features/game/context";

const adjustForm = z.object({
  promotion_id: z.uuid("Choose a promotion"),
  amount: z.coerce.number().int().min(-100_000_000).max(100_000_000).refine((v) => v !== 0, "Enter a non-zero amount"),
  description: z.string().trim().min(1, "Add a short description").max(300),
});

/** Manual cash adjustment, applied atomically through the same RPC as simulations. */
export async function adjustCashAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    if (!ctx.settings.financesEnabled) return { error: "Finances are turned off for this universe." };
    const parsed = adjustForm.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { data: promo } = await ctx.supabase.from("promotions").select("id").eq("id", parsed.data.promotion_id).eq("universe_id", ctx.universeId).maybeSingle();
    if (!promo) return { error: "Promotion not found." };
    const changes = emptyChanges();
    changes.transactions.push({ id: crypto.randomUUID(), promotion_id: promo.id, occurred_on: ctx.gameDate, category: "adjustment", amount: parsed.data.amount, show_id: null, description: parsed.data.description });
    changes.promotionDeltas.push({ id: promo.id, popularity: 0, reputation: 0, cash: parsed.data.amount });
    const { error } = await ctx.supabase.rpc("apply_world_changes", { p_universe: ctx.universeId, p_changes: changes as never });
    if (error) throw error;
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Adjustment recorded." };
  } catch (e) {
    return failure(e);
  }
}
