import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/site-header";
import { ActionForm } from "@/components/action-form";
import { Card, EmptyState, Field, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreationCard, type CreationListItem } from "@/features/community/creation-card";
import { CREATION_LIST_COLUMNS } from "@/features/community/queries";
import { reportAction } from "@/features/community/actions";
import { REPORT_CATEGORIES } from "@/features/community/constants";

export const metadata: Metadata = { title: "Creator" };

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("id, handle, display_name, bio, website_url, created_at").eq("handle", handle).maybeSingle();
  if (!profile) notFound();
  const [{ data: auth }, { data }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("community_creations")
      .select(CREATION_LIST_COLUMNS)
      .eq("owner_id", profile.id)
      .eq("visibility", "published")
      .eq("moderation_state", "approved")
      .gt("current_version", 0)
      .order("published_at", { ascending: false })
      .limit(60),
  ]);
  const creations = (data ?? []) as CreationListItem[];
  const downloads = creations.reduce((n, c) => n + c.download_count, 0);
  const ratings = creations.reduce((n, c) => n + c.rating_count, 0);
  const isSelf = auth.user?.id === profile.id;

  return (
    <SiteShell>
      <PageHeader title={profile.display_name} subtitle={`@${profile.handle} · joined ${new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`} />
      {(profile.bio || profile.website_url) && (
        <Card className="mb-4 p-4 text-sm">
          {profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>}
          {profile.website_url && (
            <a href={profile.website_url} rel="nofollow ugc noopener noreferrer" target="_blank" className="mt-2 inline-block text-accent">{profile.website_url.replace(/^https:\/\//, "")}</a>
          )}
        </Card>
      )}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Creations" value={creations.length} />
        <Stat label="Downloads" value={downloads} />
        <Stat label="Ratings" value={ratings} />
      </div>
      {creations.length === 0 ? (
        <EmptyState title="No published creations yet" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {creations.map((c) => <CreationCard key={c.id} creation={c} />)}
        </ul>
      )}
      {auth.user && !isSelf && (
        <Card className="mt-6">
          <details>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Report this creator</summary>
            <div className="border-t border-border p-4">
              <ActionForm action={reportAction} submitLabel="Send report" submitVariant="danger" submitSize="sm" resetOnSuccess>
                <input type="hidden" name="targetType" value="user" />
                <input type="hidden" name="userId" value={profile.id} />
                <Field label="Reason" htmlFor="category">
                  <Select id="category" name="category" required defaultValue="">
                    <option value="" disabled>Choose a reason…</option>
                    {REPORT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                </Field>
                <Field label="Details (optional)" htmlFor="details"><Textarea id="details" name="details" rows={3} maxLength={2000} /></Field>
              </ActionForm>
            </div>
          </details>
        </Card>
      )}
    </SiteShell>
  );
}
