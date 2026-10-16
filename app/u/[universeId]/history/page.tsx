import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseHeader } from "@/lib/game/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SHOW_TYPE_LABELS, TIMELINE_KINDS, type ShowType } from "@/lib/domain/enums";
import { formatGameDate } from "@/lib/domain/dates";
import { Button, LinkButton, PageHeader, Select, Stars, cx } from "@/components/ui";
import { starRatingFor } from "@/lib/simulation/scoring";

export const metadata: Metadata = { title: "History" };

const PAGE = 40;
const KIND_LABELS: Record<string, string> = {
  title_change: "Title changes", title_vacated: "Vacated titles", signing: "Signings", release: "Releases", transfer: "Transfers", injury: "Injuries",
  recovery: "Recoveries", retirement: "Retirements", team_formed: "Teams formed", team_disbanded: "Teams disbanded", faction_joined: "Faction joins",
  faction_left: "Faction exits", storyline: "Storylines", business: "Business", news: "Industry news", contract: "Contracts", show: "Shows", match: "Matches", debut: "Debuts", return: "Returns",
};

type Search = { tab?: string; kind?: string; promotion?: string; page?: string };

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ universeId: string }>; searchParams: Promise<Search> }) {
  const { universeId } = await params;
  const sp = await searchParams;
  const header = await getUniverseHeader(universeId);
  const supabase = await createSupabaseServerClient();
  const base = `/u/${universeId}`;
  const tab = sp.tab === "shows" ? "shows" : "timeline";
  const page = Math.max(0, Number(sp.page) || 0);
  const promotions = header.promotions ?? [];
  const promotion = promotions.find((p) => p.id === sp.promotion)?.id;
  const abbr = new Map(promotions.map((p) => [p.id, p.abbreviation]));
  const href = (patch: Partial<Search>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, tab, ...patch })) if (v !== undefined && v !== "") q.set(k, String(v));
    return `${base}/history?${q}`;
  };

  let rows: React.ReactNode;
  let more = false;
  if (tab === "timeline") {
    let query = supabase.from("timeline_events").select("id, occurred_on, kind, title, summary, promotion_id, show_id, importance").eq("universe_id", universeId);
    if (sp.kind && (TIMELINE_KINDS as readonly string[]).includes(sp.kind)) query = query.eq("kind", sp.kind as (typeof TIMELINE_KINDS)[number]);
    if (promotion) query = query.eq("promotion_id", promotion);
    const { data } = await query.order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE);
    const list = data ?? [];
    more = list.length > PAGE;
    rows = (
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {list.slice(0, PAGE).map((e) => (
          <li key={e.id} className="flex gap-3 px-4 py-2.5 text-sm">
            <span className="w-24 shrink-0 text-xs text-muted">{formatGameDate(e.occurred_on)}{e.promotion_id ? <span className="block">{abbr.get(e.promotion_id)}</span> : null}</span>
            <span className="min-w-0">
              {e.show_id ? <Link href={`${base}/booking/${e.show_id}`} className={cx("hover:underline", kindClass(e.kind, e.importance))}>{e.title}</Link> : <span className={kindClass(e.kind, e.importance)}>{e.title}</span>}
              {e.summary && <span className="block text-xs text-muted">{e.summary}</span>}
            </span>
          </li>
        ))}
        {list.length === 0 && <li className="p-4 text-sm text-muted">Nothing recorded yet.</li>}
      </ul>
    );
  } else {
    let query = supabase.from("shows").select("id, name, show_date, show_type, promotion_id, rating, attendance").eq("universe_id", universeId).eq("status", "completed");
    if (promotion) query = query.eq("promotion_id", promotion);
    const { data } = await query.order("show_date", { ascending: false }).range(page * PAGE, page * PAGE + PAGE);
    const list = data ?? [];
    more = list.length > PAGE;
    rows = (
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {list.slice(0, PAGE).map((s) => (
          <li key={s.id}>
            <Link href={`${base}/booking/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted">{abbr.get(s.promotion_id)} · {SHOW_TYPE_LABELS[s.show_type as ShowType]} · {formatGameDate(s.show_date)} · {s.attendance?.toLocaleString("en-US")} fans</p>
              </div>
              <Stars value={starRatingFor(Number(s.rating ?? 0) * 20)} />
              <span className="w-10 text-right text-sm font-semibold tabular-nums">{Number(s.rating ?? 0).toFixed(2)}</span>
            </Link>
          </li>
        ))}
        {list.length === 0 && <li className="p-4 text-sm text-muted">No completed shows.</li>}
      </ul>
    );
  }

  return (
    <>
      <PageHeader title="History" back={{ href: `${base}/more`, label: "More" }} />
      <nav className="mb-3 flex gap-2" aria-label="History views">
        {(["timeline", "shows"] as const).map((t) => (
          <Link key={t} href={href({ tab: t, page: undefined })} aria-current={tab === t ? "page" : undefined} className={cx("rounded-full border px-3 py-1.5 text-sm font-medium", tab === t ? "border-accent bg-accent text-accent-contrast" : "border-border bg-surface")}>
            {t === "timeline" ? "Timeline" : "Show archive"}
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <Select name="promotion" defaultValue={promotion ?? ""} aria-label="Promotion" className="w-auto">
          <option value="">All promotions</option>
          {promotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        {tab === "timeline" && (
          <Select name="kind" defaultValue={sp.kind ?? ""} aria-label="Event type" className="w-auto">
            <option value="">All events</option>
            {TIMELINE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>)}
          </Select>
        )}
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {rows}
      <div className="mt-4 flex justify-between">
        {page > 0 ? <LinkButton href={href({ page: String(page - 1) })} variant="secondary" size="sm">Newer</LinkButton> : <span />}
        {more && <LinkButton href={href({ page: String(page + 1) })} variant="secondary" size="sm">Older</LinkButton>}
      </div>
    </>
  );
}

function kindClass(kind: string, importance: number) {
  if (kind === "title_change") return "font-semibold text-gold";
  if (kind === "injury") return "font-medium text-danger";
  return importance >= 3 ? "font-medium" : "";
}
