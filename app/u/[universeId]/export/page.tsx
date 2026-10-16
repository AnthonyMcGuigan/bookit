import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { Card, CardHeader, LinkButton, PageHeader, Select, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Export & share" };

export default async function ExportPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const action = `${base}/export/download`;
  const byName = <T,>(list: T[], key: (x: T) => string) => list.slice().sort((a, b) => key(a).localeCompare(key(b)));
  const entityGroups = [
    { kind: "wrestler", label: "Wrestler", items: byName(state.wrestlers.filter((w) => !w.archived_at), (w) => w.ring_name).map((w) => [w.id, w.ring_name]) },
    { kind: "team", label: "Tag team / faction", items: byName(state.teams, (t) => t.name).map((t) => [t.id, t.name]) },
    { kind: "championship", label: "Championship", items: byName(state.championships, (c) => c.name).map((c) => [c.id, c.name]) },
    { kind: "promotion", label: "Promotion (with roster and titles)", items: byName(state.promotions, (p) => p.name).map((p) => [p.id, p.name]) },
    { kind: "storyline", label: "Storyline", items: byName(state.storylines, (s) => s.title).map((s) => [s.id, s.title]) },
    { kind: "venue", label: "Venue", items: byName(state.venues, (v) => v.name).map((v) => [v.id, v.name]) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="Export & share"
        subtitle="Download backups and packages, import from a file, or publish to the community."
        actions={<LinkButton href={`${base}/community`} size="sm">Publish to community</LinkButton>}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Full backup" subtitle="Everything in this universe, including history." />
          <div className="flex flex-wrap gap-2 p-4">
            <a className={buttonClass("primary", "sm")} href={`${action}?kind=universe&format=zip`} download data-testid="export-universe-zip">Download ZIP (with images)</a>
            <a className={buttonClass("secondary", "sm")} href={`${action}?kind=universe&format=json`} download>Download JSON</a>
          </div>
        </Card>
        <Card>
          <CardHeader title="Scenario" subtitle="Rosters, titles, storylines and upcoming shows, without past results." />
          <div className="flex flex-wrap gap-2 p-4">
            <a className={buttonClass("primary", "sm")} href={`${action}?kind=scenario&format=zip`} download>Download ZIP</a>
            <a className={buttonClass("secondary", "sm")} href={`${action}?kind=scenario&format=json`} download>Download JSON</a>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Single item" subtitle="Export one wrestler, team, title, promotion, storyline or venue to share or reuse in another universe." />
          <ul className="divide-y divide-border">
            {entityGroups.map((g) => (
              <li key={g.kind} className="p-4">
                <form action={action} method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="kind" value={g.kind} />
                  <label className="min-w-0 flex-1 text-sm">
                    <span className="mb-1 block font-medium">{g.label}</span>
                    <Select name="root" aria-label={g.label}>
                      {g.items.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                  </label>
                  <Select name="format" aria-label="Format" className="sm:w-40" defaultValue="zip">
                    <option value="zip">ZIP (images)</option>
                    <option value="json">JSON</option>
                  </Select>
                  <button className={buttonClass("secondary", "md")}>Download</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Import" />
          <div className="p-4 text-sm">
            <p className="text-muted">Add wrestlers, teams, titles and more from a package file or the community library. You&apos;ll review name matches before anything is added.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton href={`/universes/import?into=${universeId}`} size="sm" variant="secondary">Import a file</LinkButton>
              <LinkButton href="/community" size="sm" variant="ghost">Browse the community</LinkButton>
            </div>
            <p className="mt-3 text-xs text-muted">Packages are versioned JSON (optionally zipped with images). See <Link href="/policies/content" className="text-accent">the content policy</Link> before sharing.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
