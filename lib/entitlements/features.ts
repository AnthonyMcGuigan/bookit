/**
 * Premium feature catalogue. Premium never gates basic booking, simulation,
 * championships, core saving or essential community participation.
 */
export type Plan = "free" | "premium";

export const LIMITED_FEATURES = ["universe_slots", "media_storage_bytes", "advanced_analytics", "published_creations"] as const;
export type LimitedFeature = (typeof LIMITED_FEATURES)[number];

export const FEATURE_INFO: Record<LimitedFeature, { label: string; description: string; format: (v: number) => string }> = {
  universe_slots: { label: "Cloud universe slots", description: "How many universes you can keep in the cloud.", format: (v) => `${v}` },
  media_storage_bytes: { label: "Custom image storage", description: "Total space for uploaded portraits, logos and posters.", format: (v) => `${Math.round(v / 1048576)} MB` },
  advanced_analytics: { label: "Advanced analytics", description: "Detailed booking trends, rating breakdown history and roster insights.", format: (v) => (v ? "Included" : "Not included") },
  published_creations: { label: "Active community creations", description: "Published or unlisted creations at one time.", format: (v) => `${v}` },
};

export const DEFAULT_FREE_LIMITS: Record<LimitedFeature, number> = {
  universe_slots: 3,
  media_storage_bytes: 52428800,
  advanced_analytics: 0,
  published_creations: 50,
};

export interface EntitlementRecord {
  id: string;
  plan: Plan;
  source: "development" | "purchase" | "grant";
  status: "active" | "cancelled" | "expired" | "revoked";
  starts_at: string;
  expires_at: string | null;
  auto_renews: boolean;
  honoured: boolean;
}

export interface EntitlementSummary {
  plan: Plan;
  limits: Record<LimitedFeature, number>;
  usage: { universe_slots: number; media_storage_bytes: number; published_creations: number };
  entitlements: EntitlementRecord[];
  devEntitlementsEnabled: boolean;
}

/** Pure helper: whether a usage count is within a limit. */
export function withinLimit(summary: Pick<EntitlementSummary, "limits">, feature: LimitedFeature, prospectiveUsage: number): boolean {
  return prospectiveUsage <= (summary.limits[feature] ?? DEFAULT_FREE_LIMITS[feature]);
}

/** Pure helper used by tests and UI: describe an entitlement's state at a moment in time. */
export function describeEntitlement(e: Pick<EntitlementRecord, "status" | "expires_at" | "starts_at">, now = new Date()): "active" | "ending" | "expired" | "revoked" | "scheduled" {
  if (e.status === "revoked") return "revoked";
  if (new Date(e.starts_at) > now) return "scheduled";
  if (e.expires_at && new Date(e.expires_at) <= now) return "expired";
  if (e.status === "expired") return "expired";
  if (e.status === "cancelled") return "ending";
  return "active";
}
