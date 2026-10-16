import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUniverseState } from "@/lib/game/load";
import { indexById, lineage } from "@/lib/domain/selectors";
import { CHAMPIONSHIP_FORMAT_LABELS, CHAMPIONSHIP_TIER_LABELS, DIVISION_LABELS, REIGN_END_REASONS } from "@/lib/domain/enums";
import { formatGameDate } from "@/lib/domain/dates";
import { Alert, Badge, Card, CardHeader, Checkbox, Field, Input, PageHeader, Select, Stat } from "@/components/ui";
import { ChampionshipArt, WrestlerAvatar } from "@/components/artwork";
import { ActionForm } from "@/components/action-form";
import {
  awardChampionshipAction,
  deleteChampionshipAction,
  deleteReignAction,
  saveChampionshipAction,
  setChampionshipStatusAction,
  updateReignAction,
  vacateChampionshipAction,
} from "@/features/championships/actions";
import { ChampionshipFields } from "@/features/championships/championship-fields";
import { ImageUpload } from "@/components/image-upload";
import { removeEntityImageAction, uploadEntityImageAction } from "@/features/media/actions";

export const metadata: Metadata = { title: "Championship" };

const END_LABELS: Record<string, string> = { lost: "Lost", vacated: "Vacated", stripped: "Stripped", retired: "Title retired", injury: "Vacated (injury)", manual: "Changed by management" };

export default async function ChampionshipPage({ params }: { params: Promise<{ universeId: string; championshipId: string }> }) {
  const { universeId, championshipId } = await params;
  const state = await getUniverseState(universeId, "full");
  const c = state.championships.find((x) => x.id === championshipId);
  if (!c) notFound();
  const base = `/u/${universeId}`;
  const reigns = lineage(state, c.id);
  const current = reigns.find((r) => !r.reign.ended_on) ?? null;
  const showsById = indexById(state.shows);
  const segById = indexById(state.segments);
  const holderCount = { singles: 1, tag: 2, trios: 3 }[c.format];
  const candidates = state.wrestlers.filter((w) => !w.archived_at && w.career_status === "active").sort((a, b) => a.ring_name.localeCompare(b.ring_name));
  const teams = state.teams.filter((t) => !t.disbanded_on && !t.archived_at);
  const longest = reigns.slice().sort((a, b) => b.days - a.days)[0];
  const counts = new Map<string, { name: string; n: number }>();
  for (const r of reigns) for (const h of r.holders) counts.set(h.id, { name: h.ring_name, n: (counts.get(h.id)?.n ?? 0) + 1 });
  const most = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  const hidden = (
    <>
      <input type="hidden" name="universeId" value={universeId} />
      <input type="hidden" name="championshipId" value={c.id} />
    </>
  );

  return (
    <>
      <PageHeader
        back={{ href: `${base}/championships`, label: "Championships" }}
        title={<span className="flex items-center gap-3"><ChampionshipArt name={c.name} assetId={c.image_asset_id} tier={c.tier} size={52} /><span className="min-w-0 truncate">{c.name}</span></span>}
        subtitle={`${CHAMPIONSHIP_TIER_LABELS[c.tier]} · ${CHAMPIONSHIP_FORMAT_LABELS[c.format]} · ${DIVISION_LABELS[c.division]} · established ${formatGameDate(c.established_on)}`}
      />
      {c.status === "retired" && <div className="mb-4"><Alert tone="gold">This championship was retired{c.retired_on ? ` on ${formatGameDate(c.retired_on)}` : ""}.</Alert></div>}

      <Card className="mb-4">
        <CardHeader title="Current champion" />
        <div className="p-4">
          {current ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex -space-x-2">{current.holders.map((h) => <WrestlerAvatar key={h.id} name={h.ring_name} assetId={h.portrait_asset_id} size={52} className="ring-2 ring-surface" />)}</div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gold">
                  {current.holders.map((h, i) => <span key={h.id}>{i > 0 && " & "}<Link href={`${base}/roster/${h.id}`} className="hover:underline">{h.ring_name}</Link></span>)}
                </p>
                <p className="text-sm text-muted">{current.team ? `${current.team.name} · ` : ""}since {formatGameDate(current.reign.started_on)} · {current.days} days · {current.reign.defenses} defenses</p>
              </div>
            </div>
          ) : (
            <p className="font-semibold text-muted">Vacant</p>
          )}
        </div>
        {c.status === "active" && (
          <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2">
            {current && (
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Vacate or strip</summary>
                <ActionForm action={vacateChampionshipAction} submitLabel="Vacate championship" submitVariant="danger" submitSize="sm" className="mt-3" confirm="Vacate this championship?">
                  {hidden}
                  <Field label="Reason" htmlFor="reason">
                    <Select id="reason" name="reason" defaultValue="vacated">
                      <option value="vacated">Vacated</option>
                      <option value="stripped">Stripped</option>
                      <option value="injury">Injury</option>
                    </Select>
                  </Field>
                  <Field label="Note (optional)" htmlFor="note"><Input id="note" name="note" maxLength={500} /></Field>
                </ActionForm>
              </details>
            )}
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Award manually (override)</summary>
              <ActionForm action={awardChampionshipAction} submitLabel="Award championship" submitSize="sm" className="mt-3">
                {hidden}
                <p className="text-xs text-muted">Normally titles change hands in matches. A manual award ends the current reign on the chosen date. Choose {holderCount} holder(s){c.format !== "singles" ? ", or pick a team to use its members" : ""}.</p>
                {c.format !== "singles" && (
                  <Field label="Team (optional)" htmlFor="team_id">
                    <Select id="team_id" name="team_id" defaultValue=""><option value="">No team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                  </Field>
                )}
                {c.format === "singles" ? (
                  <Field label="New champion" htmlFor="holders">
                    <Select id="holders" name="holders" defaultValue=""><option value="" disabled>Choose…</option>{candidates.map((w) => <option key={w.id} value={w.id}>{w.ring_name}</option>)}</Select>
                  </Field>
                ) : (
                  <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {candidates.map((w) => <li key={w.id}><label className="flex items-center gap-3 px-3 py-1.5 text-sm"><input type="checkbox" name="holders" value={w.id} className="h-4 w-4 accent-[var(--accent)]" />{w.ring_name}</label></li>)}
                  </ul>
                )}
                <Field label="Effective date" htmlFor="started_on" hint="Defaults to today in the universe."><Input id="started_on" name="started_on" type="date" defaultValue={state.universe.game_date} /></Field>
                <Field label="Note" htmlFor="award-notes"><Input id="award-notes" name="notes" maxLength={500} placeholder="e.g. Named champion by the commissioner" /></Field>
                <Checkbox name="acknowledge" label="I understand" hint="Needed when the award rewrites history or bends eligibility rules." />
              </ActionForm>
            </details>
          </div>
        )}
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Reigns" value={reigns.length} />
        <Stat label="Prestige" value={c.prestige} />
        <Stat label="Longest reign" value={longest ? `${longest.days}d` : "—"} hint={longest?.holders.map((h) => h.ring_name).join(" & ")} />
        <Stat label="Most reigns" value={most ? most.n : "—"} hint={most?.name} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Lineage" subtitle="Editing a past reign changes the record books only. Match results are never re-simulated." />
        <ol className="divide-y divide-border">
          {reigns.length === 0 && <li className="p-4 text-sm text-muted">No reigns yet.</li>}
          {reigns.map((r, i) => {
            const won = r.reign.won_segment_id ? segById.get(r.reign.won_segment_id) : undefined;
            const wonShow = won ? showsById.get(won.show_id) : undefined;
            return (
              <li key={r.reign.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 shrink-0 pt-0.5 text-right text-xs font-semibold text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {r.holders.map((h) => h.ring_name).join(" & ") || "Unknown"}{r.team ? <span className="text-muted"> ({r.team.name})</span> : null}
                      {!r.reign.ended_on && <Badge tone="gold" className="ml-2">Current</Badge>}
                      {r.reign.is_manual && <Badge className="ml-2">Edited</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {formatGameDate(r.reign.started_on)} – {r.reign.ended_on ? formatGameDate(r.reign.ended_on) : "present"} · {r.days} days · {r.reign.defenses} defenses
                      {r.reign.end_reason ? ` · ${END_LABELS[r.reign.end_reason]}` : ""}
                      {wonShow ? <> · won at <Link className="text-accent" href={`${base}/booking/${wonShow.id}`}>{wonShow.name}</Link></> : null}
                    </p>
                    {r.reign.notes && <p className="text-xs italic text-muted">{r.reign.notes}</p>}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-accent">Edit reign</summary>
                      <div className="mt-2 space-y-3 rounded-lg border border-border p-3">
                        <Alert tone="gold">You are editing recorded history. Dates must not overlap other reigns.</Alert>
                        <ActionForm action={updateReignAction} submitLabel="Save reign" submitSize="sm">
                          {hidden}
                          <input type="hidden" name="reignId" value={r.reign.id} />
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="Started" htmlFor={`s-${r.reign.id}`}><Input id={`s-${r.reign.id}`} name="started_on" type="date" required defaultValue={r.reign.started_on} /></Field>
                            <Field label="Ended (blank = current)" htmlFor={`e-${r.reign.id}`}><Input id={`e-${r.reign.id}`} name="ended_on" type="date" defaultValue={r.reign.ended_on ?? ""} /></Field>
                            <Field label="End reason" htmlFor={`r-${r.reign.id}`}>
                              <Select id={`r-${r.reign.id}`} name="end_reason" defaultValue={r.reign.end_reason ?? ""}><option value="">—</option>{REIGN_END_REASONS.map((x) => <option key={x} value={x}>{END_LABELS[x]}</option>)}</Select>
                            </Field>
                            <Field label="Defenses" htmlFor={`d-${r.reign.id}`}><Input id={`d-${r.reign.id}`} name="defenses" type="number" min={0} max={999} defaultValue={r.reign.defenses} /></Field>
                            <Field label="Notes" htmlFor={`n-${r.reign.id}`} className="sm:col-span-2"><Input id={`n-${r.reign.id}`} name="notes" maxLength={500} defaultValue={r.reign.notes} /></Field>
                          </div>
                          <Checkbox name="acknowledge" label="I understand this rewrites history" />
                        </ActionForm>
                        <ActionForm action={deleteReignAction} submitLabel="Delete this reign" submitVariant="ghost" submitSize="sm" confirm="Delete this reign from the lineage? This cannot be undone.">
                          {hidden}
                          <input type="hidden" name="reignId" value={r.reign.id} />
                        </ActionForm>
                      </div>
                    </details>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Edit championship" />
        <div className="p-4">
          <div className="mb-4"><ImageUpload
            uploadAction={uploadEntityImageAction}
            removeAction={removeEntityImageAction}
            hasImage={Boolean(c.image_asset_id)}
            label="Belt image"
            hidden={<><input type="hidden" name="universeId" value={universeId} /><input type="hidden" name="target" value="championship" /><input type="hidden" name="entityId" value={c.id} /></>}
          />
</div>
          <ActionForm action={saveChampionshipAction} submitLabel="Save championship">
            {hidden}
            <ChampionshipFields championship={c} promotions={state.promotions.filter((p) => !p.archived_at || p.id === c.promotion_id)} />
          </ActionForm>
        </div>
      </Card>

      <Card>
        <CardHeader title="Danger zone" />
        <div className="space-y-4 p-4">
          <ActionForm action={setChampionshipStatusAction} submitLabel={c.status === "active" ? "Retire championship" : "Reactivate championship"} submitVariant="secondary" submitSize="sm" confirm={c.status === "active" ? "Retire this championship? The current reign ends today." : undefined}>
            {hidden}
          </ActionForm>
          <ActionForm action={deleteChampionshipAction} submitLabel="Delete permanently" submitVariant="danger" submitSize="sm">
            {hidden}
            <Field label={`Type "${c.name}" to delete it and its entire lineage`} htmlFor="confirmName"><Input id="confirmName" name="confirmName" autoComplete="off" /></Field>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
