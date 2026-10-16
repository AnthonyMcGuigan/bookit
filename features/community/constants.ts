import type { PackageKind } from "@/lib/packages/schema";

export const REPORT_CATEGORIES = [
  { value: "ip_infringement", label: "Uses someone else's intellectual property (logos, photos, music)" },
  { value: "impersonation", label: "Impersonates a real person or creator" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hateful", label: "Hateful content" },
  { value: "sexual", label: "Sexual content" },
  { value: "violent_real_world", label: "Real-world violence or threats" },
  { value: "malicious_file", label: "Broken or malicious file" },
  { value: "spam", label: "Spam or misleading" },
  { value: "other", label: "Something else" },
] as const;

export const CATEGORY_LABELS: Record<PackageKind, string> = {
  wrestler: "Wrestlers",
  team: "Teams & factions",
  championship: "Championships",
  promotion: "Promotions",
  venue: "Venues",
  storyline: "Storylines",
  scenario: "Scenarios",
  universe: "Universes",
};

export const MODERATION_LABELS: Record<string, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
  hidden: "Hidden pending review",
  removed: "Removed",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  draft: "Draft (only you)",
  published: "Published",
  unlisted: "Unlisted (link only)",
};
