import type { CrowdReaction } from "@/lib/domain/enums";

/** Converts a 0-100 quality score to a 0-5 star rating in quarter steps. */
export function starRatingFor(quality: number): number {
  const stars = Math.max(0, Math.min(5, quality / 20));
  return Math.round(stars * 4) / 4;
}

export function crowdReactionFor(quality: number, heat: number): CrowdReaction {
  const score = quality * 0.6 + heat * 0.4;
  if (score < 32) return "dead";
  if (score < 48) return "mild";
  if (score < 63) return "warm";
  if (score < 78) return "hot";
  return "electric";
}

export const CROWD_SCORE: Record<CrowdReaction, number> = { dead: 10, mild: 35, warm: 55, hot: 75, electric: 92 };

export function formatStars(stars: number): string {
  const full = Math.floor(stars);
  const frac = stars - full;
  const fracText = frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "";
  return `${"★".repeat(full)}${fracText}`.trim() || "DUD";
}

export function qualityDescriptor(quality: number): string {
  if (quality >= 90) return "an all-time classic";
  if (quality >= 80) return "an outstanding contest";
  if (quality >= 70) return "a very good match";
  if (quality >= 60) return "a solid outing";
  if (quality >= 45) return "a passable bout";
  if (quality >= 30) return "a sloppy encounter";
  return "a disaster";
}
