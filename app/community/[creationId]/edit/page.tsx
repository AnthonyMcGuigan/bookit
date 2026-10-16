import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/site-header";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Checkbox, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteCreationAction, updateCreationAction } from "@/features/community/actions";

export const metadata: Metadata = { title: "Edit creation" };

export default async function EditCreationPage({ params }: { params: Promise<{ creationId: string }> }) {
  const { creationId } = await params;
  const user = await requireUser(`/community/${creationId}/edit`);
  if (!/^[0-9a-f-]{36}$/i.test(creationId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: c } = await supabase.from("community_creations").select("*").eq("id", creationId).eq("owner_id", user.id).maybeSingle();
  if (!c) notFound();
  const removed = c.moderation_state === "removed";
  return (
    <SiteShell>
      <PageHeader title="Edit creation" subtitle={c.title} />
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="p-4 sm:p-6">
          <ActionForm action={updateCreationAction} submitLabel="Save changes" redirectTo={`/community/${c.id}`}>
            <input type="hidden" name="creationId" value={c.id} />
            <Field label="Title" htmlFor="title"><Input id="title" name="title" defaultValue={c.title} required minLength={3} maxLength={80} /></Field>
            <Field label="Summary" htmlFor="summary"><Input id="summary" name="summary" defaultValue={c.summary} maxLength={200} /></Field>
            <Field label="Description" htmlFor="description"><Textarea id="description" name="description" defaultValue={c.description} rows={6} maxLength={5000} /></Field>
            <Field label="Tags" htmlFor="tags" hint="Separated by commas."><Input id="tags" name="tags" defaultValue={c.tags.join(", ")} maxLength={400} /></Field>
            <Field label="Visibility" htmlFor="visibility" hint={removed ? "Removed creations can't be made visible again; you can appeal the decision." : undefined}>
              <Select id="visibility" name="visibility" defaultValue={c.visibility} disabled={removed}>
                <option value="published">Published</option>
                <option value="unlisted">Unlisted</option>
                <option value="draft">Draft (hidden)</option>
              </Select>
            </Field>
            {removed && <input type="hidden" name="visibility" value="draft" />}
            <Checkbox name="allowDerivatives" defaultChecked={c.allow_derivatives} label="Allow remixes" />
            <Checkbox name="isFanContent" defaultChecked={c.is_fan_content} label="This is fan content" />
          </ActionForm>
        </Card>
        {!removed && (
          <Card>
            <CardHeader title="Delete" />
            <div className="p-4">
              <p className="mb-3 text-sm text-muted">Deletes every version, rating and image of this creation. Players who imported it keep their own copies.</p>
              <ActionForm action={deleteCreationAction} submitLabel="Delete creation" submitVariant="danger" submitSize="sm" confirm="Delete this creation permanently?">
                <input type="hidden" name="creationId" value={c.id} />
              </ActionForm>
            </div>
          </Card>
        )}
      </div>
    </SiteShell>
  );
}
