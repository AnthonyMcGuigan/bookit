import { z } from "zod";

/**
 * Universe settings. Stored as JSON on the universe row; every field has a
 * default so older saves gain new settings automatically.
 */
export const REALISM_LEVELS = ["arcade", "balanced", "realistic"] as const;
export type RealismLevel = (typeof REALISM_LEVELS)[number];

export const DIFFICULTY_LEVELS = ["sandbox", "easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export const universeSettingsSchema = z.object({
  /** Business system (payroll, revenue, profit and loss). */
  financesEnabled: z.boolean().default(false),
  injuriesEnabled: z.boolean().default(true),
  /** Morale and backstage politics. */
  moraleEnabled: z.boolean().default(true),
  /** AI-controlled rival promotions book shows and compete for talent. */
  rivalPromotionsEnabled: z.boolean().default(false),
  /** Automatic popularity/momentum/morale changes from booking. */
  autoProgression: z.boolean().default(true),
  /** Attribute growth and decline over time. */
  abilityProgression: z.boolean().default(true),
  realism: z.enum(REALISM_LEVELS).default("balanced"),
  /** 0 = favourites nearly always win, 100 = chaos. */
  matchRandomness: z.int().min(0).max(100).default(35),
  difficulty: z.enum(DIFFICULTY_LEVELS).default("normal"),
  /** Starting capital per player promotion when finances are enabled. */
  startingCapital: z.int().min(0).max(1_000_000_000).default(500_000),
  /** Booking rules applied as warnings, never as hard blocks. */
  bookingRules: z
    .object({
      maxSegmentsPerWrestler: z.int().min(1).max(10).default(2),
      warnFatigueAbove: z.int().min(0).max(100).default(70),
      requireChampionInTitleMatch: z.boolean().default(true),
      enforceDivisionEligibility: z.boolean().default(true),
      repeatMatchupWindowDays: z.int().min(0).max(365).default(21),
    })
    .prefault({}),
  /** Free-form custom house rules shown in the booking screen. */
  customRules: z.string().max(1000).default(""),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
});

export type UniverseSettings = z.infer<typeof universeSettingsSchema>;

export function parseSettings(raw: unknown): UniverseSettings {
  const result = universeSettingsSchema.safeParse(raw ?? {});
  if (result.success) return result.data;
  // Recover from partially invalid settings by dropping invalid keys rather
  // than discarding the whole object.
  const base = universeSettingsSchema.parse({});
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const probe = universeSettingsSchema.safeParse({ ...base, [key]: value });
      if (probe.success) Object.assign(base, { [key]: (probe.data as Record<string, unknown>)[key] });
    }
  }
  return base;
}

export const DEFAULT_SETTINGS: UniverseSettings = universeSettingsSchema.parse({});
