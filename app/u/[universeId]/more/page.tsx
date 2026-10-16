import type { Metadata } from "next";
import { List, ListLink, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "More" };

export default async function MorePage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const base = `/u/${universeId}`;
  const items = [
    ["storylines", "Storylines & rivalries", "Arcs, feuds and their developments"],
    ["history", "History & timeline", "Every show, title change and career moment"],
    ["promotions", "Promotions", "Your companies and AI rivals"],
    ["teams", "Teams & factions", "Tag teams, trios, factions and their history"],
    ["venues", "Venues", "Buildings you can run shows in"],
    ["finances", "Finances", "Cash, revenue and expenses"],
    ["export", "Export & share", "Download a backup or publish to the community"],
    ["settings", "Universe settings", "Realism, randomness, injuries, booking rules"],
  ] as const;
  return (
    <>
      <PageHeader title="More" />
      <List>
        {items.map(([slug, title, sub]) => (
          <ListLink key={slug} href={`${base}/${slug}`}>
            <span className="min-w-0">
              <span className="block font-medium">{title}</span>
              <span className="block truncate text-xs text-muted">{sub}</span>
            </span>
          </ListLink>
        ))}
      </List>
      <List className="mt-4">
        <ListLink href="/universes"><span className="font-medium">Switch universe</span></ListLink>
        <ListLink href="/account"><span className="font-medium">Account</span></ListLink>
        <ListLink href="/community"><span className="font-medium">Community library</span></ListLink>
      </List>
    </>
  );
}
