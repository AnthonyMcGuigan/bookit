import Link from "next/link";
import { Badge } from "@/components/ui";
import type { PackageKind } from "@/lib/packages/schema";
import { PACKAGE_KIND_LABELS } from "@/lib/packages/schema";

export interface CreationListItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  thumbnail_asset_id: string | null;
  rating_count: number;
  rating_sum: number;
  download_count: number;
  owner_id: string;
  is_fan_content: boolean;
  visibility?: string;
  moderation_state?: string;
}

export function averageRating(c: Pick<CreationListItem, "rating_count" | "rating_sum">): number | null {
  return c.rating_count > 0 ? Math.round((c.rating_sum / c.rating_count) * 10) / 10 : null;
}

export function CreationCard({ creation, author }: { creation: CreationListItem; author?: { handle: string; display_name: string } | null }) {
  const avg = averageRating(creation);
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface" data-testid="creation-card">
      <Link href={`/community/${creation.id}`} className="group flex flex-1 flex-col">
        <div className="flex aspect-[16/9] items-center justify-center bg-surface-2">
          {creation.thumbnail_asset_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/media/${creation.thumbnail_asset_id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="text-3xl font-black uppercase tracking-tight text-muted/40">{creation.title.slice(0, 2)}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="upcoming">{PACKAGE_KIND_LABELS[creation.category as PackageKind] ?? creation.category}</Badge>
            {creation.is_fan_content && <Badge>Fan content</Badge>}
          </div>
          <h3 className="line-clamp-2 font-semibold group-hover:text-accent">{creation.title}</h3>
          {creation.summary && <p className="line-clamp-2 text-xs text-muted">{creation.summary}</p>}
          <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted">
            {author && <span className="truncate">by {author.display_name}</span>}
            <span className="ml-auto whitespace-nowrap">{avg !== null ? `★ ${avg.toFixed(1)} (${creation.rating_count})` : "No ratings"}</span>
            <span className="whitespace-nowrap">↓ {creation.download_count}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
