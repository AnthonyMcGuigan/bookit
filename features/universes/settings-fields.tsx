import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { DEFAULT_SETTINGS, DIFFICULTY_LEVELS, REALISM_LEVELS, type UniverseSettings } from "@/lib/domain/settings";

const REALISM_LABEL: Record<string, string> = { arcade: "Arcade (more chaos)", balanced: "Balanced", realistic: "Realistic" };
const DIFFICULTY_LABEL: Record<string, string> = { sandbox: "Sandbox (generous)", easy: "Easy", normal: "Normal", hard: "Hard" };

export function SettingsFields({ settings = DEFAULT_SETTINGS, detailed = false }: { settings?: UniverseSettings; detailed?: boolean }) {
  return (
    <div className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-semibold">Systems</legend>
        <Checkbox name="financesEnabled" defaultChecked={settings.financesEnabled} label="Financial management" hint="Payroll, tickets, merchandise, deals and profit/loss." />
        <Checkbox name="injuriesEnabled" defaultChecked={settings.injuriesEnabled} label="Injuries" hint="Matches can injure wrestlers; they recover over time." />
        <Checkbox name="moraleEnabled" defaultChecked={settings.moraleEnabled} label="Morale and backstage politics" hint="Unused or losing talent becomes unhappy." />
        <Checkbox name="rivalPromotionsEnabled" defaultChecked={settings.rivalPromotionsEnabled} label="Rival promotions" hint="AI promotions book shows, sign free agents and generate news." />
        <Checkbox name="autoProgression" defaultChecked={settings.autoProgression} label="Automatic career effects" hint="Booking changes popularity, momentum and storylines. Turn off to control everything manually." />
        <Checkbox name="abilityProgression" defaultChecked={settings.abilityProgression} label="Ability growth and decline" hint="Prospects improve; veterans slow down." />
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Simulation realism" htmlFor="realism">
          <Select id="realism" name="realism" defaultValue={settings.realism}>
            {REALISM_LEVELS.map((r) => <option key={r} value={r}>{REALISM_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Difficulty" htmlFor="difficulty">
          <Select id="difficulty" name="difficulty" defaultValue={settings.difficulty}>
            {DIFFICULTY_LEVELS.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
          </Select>
        </Field>
        <Field label="Starting capital" htmlFor="startingCapital" hint="Used when finances are on.">
          <Input id="startingCapital" name="startingCapital" type="number" min={0} step={10000} defaultValue={settings.startingCapital} />
        </Field>
      </div>
      <Field label={`Match randomness`} htmlFor="matchRandomness" hint="Low: favourites usually win. High: anything can happen.">
        <input id="matchRandomness" name="matchRandomness" type="range" min={0} max={100} defaultValue={settings.matchRandomness} className="w-full" />
      </Field>
      {detailed && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-semibold">Booking rules (warnings only)</legend>
          <input type="hidden" name="bookingRulesPresent" value="1" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Max segments per wrestler" htmlFor="maxSegmentsPerWrestler">
              <Input id="maxSegmentsPerWrestler" name="maxSegmentsPerWrestler" type="number" min={1} max={10} defaultValue={settings.bookingRules.maxSegmentsPerWrestler} />
            </Field>
            <Field label="Warn when fatigue above" htmlFor="warnFatigueAbove">
              <Input id="warnFatigueAbove" name="warnFatigueAbove" type="number" min={0} max={100} defaultValue={settings.bookingRules.warnFatigueAbove} />
            </Field>
            <Field label="Rematch window (days)" htmlFor="repeatMatchupWindowDays">
              <Input id="repeatMatchupWindowDays" name="repeatMatchupWindowDays" type="number" min={0} max={365} defaultValue={settings.bookingRules.repeatMatchupWindowDays} />
            </Field>
          </div>
          <Checkbox name="requireChampionInTitleMatch" defaultChecked={settings.bookingRules.requireChampionInTitleMatch} label="Warn when the champion is missing from a title match" />
          <Checkbox name="enforceDivisionEligibility" defaultChecked={settings.bookingRules.enforceDivisionEligibility} label="Warn about championship eligibility" />
          <Field label="House rules" htmlFor="customRules" hint="Your own booking notes, shown on the booking screen.">
            <Textarea id="customRules" name="customRules" maxLength={1000} defaultValue={settings.customRules} />
          </Field>
        </fieldset>
      )}
    </div>
  );
}
