import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-header";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/features/packages/import-wizard";

export const metadata: Metadata = { title: "Import a package" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireUser(`/universes/import${params.creation ? `?creation=${params.creation}` : ""}`);
  let community: { creationId: string; version: number | null; title: string } | null = null;
  if (params.creation && UUID.test(params.creation)) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("community_creations").select("id, title").eq("id", params.creation).maybeSingle();
    if (data) {
      const version = Number(params.version);
      community = { creationId: data.id, version: Number.isInteger(version) && version > 0 ? version : null, title: data.title };
    }
  }
  const into = params.into && UUID.test(params.into) ? params.into : null;
  return (
    <SiteShell>
      <PageHeader
        title="Import"
        subtitle="Bring in a universe, scenario, wrestler, team, championship, promotion, venue or storyline."
      />
      <div className="mx-auto max-w-2xl">
        <ImportWizard community={community} initialTarget={into} />
        <p className="mt-4 text-xs text-muted">
          Looking for something to import? Browse the <Link href="/community" className="text-accent">community library</Link>.
        </p>
      </div>
    </SiteShell>
  );
}
