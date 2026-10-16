import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { AppError, errorMessage } from "@/lib/errors";
import { DEFAULT_FREE_LIMITS, FEATURE_INFO, type EntitlementSummary, type LimitedFeature } from "./features";

/**
 * Server-side entitlement service. The authoritative plan is derived in the
 * database from entitlement records; client-provided flags are never used.
 */
export async function getEntitlementSummary(supabase: AppSupabaseClient, _userId?: string): Promise<EntitlementSummary> {
  const { data, error } = await supabase.rpc("my_entitlements");
  if (error) throw new AppError(errorMessage(error), "ENTITLEMENTS_UNAVAILABLE", 503);
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    plan: raw.plan === "premium" ? "premium" : "free",
    limits: { ...DEFAULT_FREE_LIMITS, ...((raw.limits as Record<LimitedFeature, number>) ?? {}) },
    usage: (raw.usage as EntitlementSummary["usage"]) ?? { universe_slots: 0, media_storage_bytes: 0, published_creations: 0 },
    entitlements: (raw.entitlements as EntitlementSummary["entitlements"]) ?? [],
    devEntitlementsEnabled: Boolean(raw.dev_entitlements_enabled),
  };
}

export class FeatureLimitError extends AppError {
  constructor(public feature: LimitedFeature, message: string) {
    super(message, "FEATURE_LIMIT", 402);
  }
}

/** Throws a FeatureLimitError with a clear message when a feature is not available. */
export async function requireFeature(supabase: AppSupabaseClient, feature: LimitedFeature): Promise<EntitlementSummary> {
  const summary = await getEntitlementSummary(supabase);
  if (!summary.limits[feature]) {
    throw new FeatureLimitError(feature, `${FEATURE_INFO[feature].label} is a Premium feature. Your saves and data stay fully available on the free plan.`);
  }
  return summary;
}
