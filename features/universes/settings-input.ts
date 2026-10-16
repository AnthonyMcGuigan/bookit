import { universeSettingsSchema, type UniverseSettings } from "@/lib/domain/settings";

/** Reads universe settings from form fields (checkboxes + selects). */
export function settingsFromForm(formData: FormData, base: Partial<UniverseSettings> = {}): UniverseSettings {
  const bool = (name: string) => formData.get(name) === "on";
  const num = (name: string) => {
    const v = formData.get(name);
    return v === null || v === "" ? undefined : Number(v);
  };
  const str = (name: string) => {
    const v = formData.get(name);
    return v === null || v === "" ? undefined : String(v);
  };
  return universeSettingsSchema.parse({
    ...base,
    financesEnabled: bool("financesEnabled"),
    injuriesEnabled: bool("injuriesEnabled"),
    moraleEnabled: bool("moraleEnabled"),
    rivalPromotionsEnabled: bool("rivalPromotionsEnabled"),
    autoProgression: bool("autoProgression"),
    abilityProgression: bool("abilityProgression"),
    realism: str("realism") ?? base.realism,
    matchRandomness: num("matchRandomness") ?? base.matchRandomness,
    difficulty: str("difficulty") ?? base.difficulty,
    startingCapital: num("startingCapital") ?? base.startingCapital,
    customRules: str("customRules") ?? base.customRules ?? "",
    bookingRules: {
      ...(base.bookingRules ?? {}),
      maxSegmentsPerWrestler: num("maxSegmentsPerWrestler") ?? base.bookingRules?.maxSegmentsPerWrestler,
      warnFatigueAbove: num("warnFatigueAbove") ?? base.bookingRules?.warnFatigueAbove,
      repeatMatchupWindowDays: num("repeatMatchupWindowDays") ?? base.bookingRules?.repeatMatchupWindowDays,
      requireChampionInTitleMatch: formData.has("bookingRulesPresent") ? bool("requireChampionInTitleMatch") : base.bookingRules?.requireChampionInTitleMatch,
      enforceDivisionEligibility: formData.has("bookingRulesPresent") ? bool("enforceDivisionEligibility") : base.bookingRules?.enforceDivisionEligibility,
    },
  });
}
