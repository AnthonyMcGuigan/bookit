import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingEvent } from "./provider";

/**
 * Applies a verified billing event. Idempotent: each provider event is stored
 * once (billing_events unique key) and entitlements are keyed by the
 * provider reference. Expiry or cancellation only changes limits for new
 * actions; existing universes and creations are never deleted or locked.
 */
export async function applyBillingEvent(event: BillingEvent): Promise<"applied" | "duplicate" | "ignored"> {
  const admin = createSupabaseAdminClient();
  const { error: insertError } = await admin
    .from("billing_events")
    .insert({ provider: event.provider, provider_event_id: event.eventId, event_type: event.type, payload: event.raw as never });
  if (insertError) {
    if (insertError.code === "23505") return "duplicate";
    throw insertError;
  }
  if (event.type === "ignored" || !event.reference) return "ignored";

  if (event.userId && event.customerId) {
    await admin.from("billing_customers").upsert({ user_id: event.userId, provider: event.provider, provider_customer_id: event.customerId });
  }
  const status =
    event.type === "entitlement.cancelled" ? "cancelled" : event.type === "entitlement.expired" ? "expired" : event.type === "entitlement.revoked" ? "revoked" : "active";

  const { data: existing } = await admin.from("entitlements").select("id").eq("provider", event.provider).eq("provider_reference", event.reference).maybeSingle();
  if (existing) {
    const { error } = await admin
      .from("entitlements")
      .update({ status, expires_at: event.expiresAt, auto_renews: event.autoRenews && status === "active" })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    if (!event.userId) return "ignored";
    const { error } = await admin.from("entitlements").insert({
      user_id: event.userId,
      plan: "premium",
      source: "purchase",
      status,
      expires_at: event.expiresAt,
      auto_renews: event.autoRenews,
      provider: event.provider,
      provider_reference: event.reference,
    });
    if (error) throw error;
  }
  await admin.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("provider", event.provider).eq("provider_event_id", event.eventId);
  return "applied";
}
