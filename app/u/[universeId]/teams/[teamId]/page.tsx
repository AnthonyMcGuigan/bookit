import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUniverseState, getWrestlerRecords } from "@/lib/game/load";
import { teamMembers } from "@/lib/domain/selectors";
import { TEAM_KIND_LABELS, TEAM_ROLES } from "@/lib/domain/enums";
import { formatGameDate } from "@/lib/domain/dates";
import { Badge, Button, Card, CardHeader, Field, PageHeader, Select } from "@/components/ui";
import { TeamLogo, WrestlerAvatar } from "@/components/artwork";
import { ActionForm } from "@/components/action-form";
import { addTeamMemberAction, disbandTeamAction, removeTeamMemberAction, saveTeamAction, setMemberRoleAction } from "@/features/teams/actions";
import { TeamFields } from "@/features/teams/team-fields";
import { ImageUpload } from "@/components/image-upload";
import { removeEntityImageAction, uploadEntityImageAction } from "@/features/media/actions";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ universeId: string; teamId: string }> }) {
  const { universeId, teamId } = await params;
  const [state] = await Promise.all([getUniverseState(universeId), getWrestlerRecords(universeId)]);
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) notFound();
  const base = `/u/${universeId}`;
  const current = state.teamMemberships.filter((m) => m.team_id === team.id && m.left_on === null);
  const former = teamMembers(state, team.id, true).filter((m) => m.left_on !== null);
  const wrestlers = new Map(state.wrestlers.map((w) => [w.id, w]));
  const memberIds = new Set(current.map((m) => m.wrestler_id));
  const candidates = state.wrestlers.filter((w) => !memberIds.has(w.id) && !w.archived_at && w.career_status !== "retired").sort((a, b) => a.ring_name.localeCompare(b.ring_name));
  const titleReigns = state.titleReigns.filter((r) => r.team_id === team.id);
  const hidden = (
    <>
      <input type="hidden" name="universeId" value={universeId} />
      <input type="hidden" name="teamId" value={team.id} />
    </>
  );
  return (
    <>
      <PageHeader
        back={{ href: `${base}/teams`, label: "Teams" }}
        title={<span className="flex items-center gap-3"><TeamLogo name={team.name} assetId={team.logo_asset_id} size={44} /><span className="truncate">{team.name}</span></span>}
        subtitle={`${TEAM_KIND_LABELS[team.kind]} · formed ${formatGameDate(team.formed_on)}${team.disbanded_on ? ` · disbanded ${formatGameDate(team.disbanded_on)}` : ""}`}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Current members" />
          <ul className="divide-y divide-border">
            {current.map((m) => {
              const w = wrestlers.get(m.wrestler_id);
              if (!w) return null;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <WrestlerAvatar name={w.ring_name} assetId={w.portrait_asset_id} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/roster/${w.id}`} className="block truncate text-sm font-medium hover:underline">{w.ring_name}</Link>
                    <p className="text-xs text-muted">since {formatGameDate(m.joined_on)}</p>
                  </div>
                  <form action={setMemberRoleAction} className="flex items-center gap-1">
                    {hidden}
                    <input type="hidden" name="membershipId" value={m.id} />
                    <Select name="role" defaultValue={m.role} aria-label={`${w.ring_name} role`} className="h-9 w-28 text-xs">
                      {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                    <Button size="sm" variant="ghost">Set</Button>
                  </form>
                  <ActionForm action={removeTeamMemberAction} submitLabel="Remove" submitSize="sm" submitVariant="secondary" confirm={`Remove ${w.ring_name} from ${team.name}?`} className="space-y-1">
                    {hidden}
                    <input type="hidden" name="membershipId" value={m.id} />
                  </ActionForm>
                </li>
              );
            })}
            {current.length === 0 && <li className="p-4 text-sm text-muted">No current members.</li>}
          </ul>
          <div className="border-t border-border p-4">
            <ActionForm action={addTeamMemberAction} submitLabel="Add member" submitSize="sm" resetOnSuccess>
              {hidden}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Wrestler" htmlFor="wrestler_id" className="sm:col-span-2">
                  <Select id="wrestler_id" name="wrestler_id" defaultValue="">
                    <option value="" disabled>Choose…</option>
                    {candidates.map((w) => <option key={w.id} value={w.id}>{w.ring_name}</option>)}
                  </Select>
                </Field>
                <Field label="Role" htmlFor="role">
                  <Select id="role" name="role" defaultValue="member">{TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
                </Field>
              </div>
            </ActionForm>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Membership history" />
            <ul className="divide-y divide-border">
              {former.map((m, i) => (
                <li key={`${m.wrestler.id}-${i}`} className="flex justify-between gap-2 px-4 py-2 text-sm">
                  <Link href={`${base}/roster/${m.wrestler.id}`} className="truncate hover:underline">{m.wrestler.ring_name}</Link>
                  <span className="shrink-0 text-xs text-muted">{formatGameDate(m.joined_on)} – {formatGameDate(m.left_on!)}</span>
                </li>
              ))}
              {former.length === 0 && <li className="p-4 text-sm text-muted">No former members.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Championships" />
            <ul className="divide-y divide-border">
              {titleReigns.map((r) => {
                const c = state.championships.find((x) => x.id === r.championship_id);
                return (
                  <li key={r.id} className="flex justify-between gap-2 px-4 py-2 text-sm">
                    <Link href={`${base}/championships/${r.championship_id}`} className="truncate hover:underline">{c?.name}</Link>
                    <span className="shrink-0 text-xs text-muted">{formatGameDate(r.started_on)} – {r.ended_on ? formatGameDate(r.ended_on) : <Badge tone="gold">current</Badge>}</span>
                  </li>
                );
              })}
              {titleReigns.length === 0 && <li className="p-4 text-sm text-muted">No title reigns as a team.</li>}
            </ul>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader title="Edit team" />
          <div className="p-4">
            <div className="mb-4"><ImageUpload
            uploadAction={uploadEntityImageAction}
            removeAction={removeEntityImageAction}
            hasImage={Boolean(team.logo_asset_id)}
            label="Team logo"
            hidden={<><input type="hidden" name="universeId" value={universeId} /><input type="hidden" name="target" value="team" /><input type="hidden" name="entityId" value={team.id} /></>}
          />
</div>
            <ActionForm action={saveTeamAction} submitLabel="Save team">
              {hidden}
              <TeamFields team={team} promotions={state.promotions.filter((p) => !p.archived_at)} />
            </ActionForm>
          </div>
        </Card>
        <ActionForm
          action={disbandTeamAction}
          submitLabel={team.disbanded_on ? "Reunite team" : "Disband team"}
          submitVariant={team.disbanded_on ? "secondary" : "danger"}
          submitSize="sm"
          confirm={team.disbanded_on ? undefined : `Disband ${team.name}? Current members leave today; history is kept.`}
        >
          {hidden}
        </ActionForm>
      </div>
    </>
  );
}
