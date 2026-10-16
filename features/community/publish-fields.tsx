"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { PACKAGE_KIND_LABELS, type PackageKind } from "@/lib/packages/schema";

export interface PublishOptionGroup {
  kind: PackageKind;
  items: Array<[string, string]>;
}

export function PublishFields({
  groups,
  creations,
  defaultKind = "universe",
}: {
  groups: PublishOptionGroup[];
  creations: Array<{ id: string; title: string; category: string; current_version: number }>;
  defaultKind?: PackageKind;
}) {
  const [kind, setKind] = useState<PackageKind>(defaultKind);
  const [creationId, setCreationId] = useState("");
  const kinds: PackageKind[] = ["universe", "scenario", ...groups.map((g) => g.kind)];
  const sameKind = creations.filter((c) => c.category === kind);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="What to share" htmlFor="kind">
          <Select id="kind" name="kind" value={kind} onChange={(e) => { setKind(e.target.value as PackageKind); setCreationId(""); }}>
            {kinds.map((k) => <option key={k} value={k}>{PACKAGE_KIND_LABELS[k]}</option>)}
          </Select>
        </Field>
        {groups.map((g) => (
          <Field key={g.kind} label={PACKAGE_KIND_LABELS[g.kind]} htmlFor={`root_${g.kind}`} className={g.kind === kind ? "" : "hidden"}>
            <Select id={`root_${g.kind}`} name={`root_${g.kind}`}>
              {g.items.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </Field>
        ))}
        {(kind === "universe" || kind === "scenario") && (
          <p className="self-end text-xs text-muted">
            {kind === "universe" ? "Shares everything, including history (4 MB limit)." : "Shares rosters, titles, storylines and upcoming shows without past results."}
          </p>
        )}
      </div>

      {sameKind.length > 0 && (
        <Field label="Publish as" htmlFor="creationId" hint="Updating keeps ratings, downloads and the link; players see the new version.">
          <Select id="creationId" name="creationId" value={creationId} onChange={(e) => setCreationId(e.target.value)}>
            <option value="">A new creation</option>
            {sameKind.map((c) => <option key={c.id} value={c.id}>New version of “{c.title}” (now v{c.current_version})</option>)}
          </Select>
        </Field>
      )}

      <Field label="Title" htmlFor="title"><Input id="title" name="title" required minLength={3} maxLength={80} /></Field>
      <Field label="Summary" htmlFor="summary" hint="One line shown in the library (200 characters)."><Input id="summary" name="summary" maxLength={200} /></Field>
      <Field label="Description" htmlFor="description"><Textarea id="description" name="description" rows={5} maxLength={5000} /></Field>
      <Field label="Tags" htmlFor="tags" hint="Up to 10, separated by commas (for example: indie, tag-teams, 1990s-style)."><Input id="tags" name="tags" maxLength={400} /></Field>
      {creationId && <Field label="What changed" htmlFor="changelog"><Textarea id="changelog" name="changelog" rows={2} maxLength={1000} /></Field>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Visibility" htmlFor="visibility">
          <Select id="visibility" name="visibility" defaultValue="published">
            <option value="published">Published: listed in the library</option>
            <option value="unlisted">Unlisted: anyone with the link</option>
            <option value="draft">Draft: only you</option>
          </Select>
        </Field>
        <Field label="Cover image (optional)" htmlFor="thumbnail" hint="JPEG, PNG or WebP up to 5 MB. Must be your own work.">
          <Input id="thumbnail" name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <Checkbox name="includeImages" defaultChecked label="Include custom images" hint="Portraits, logos and posters are copied for sharing. Creations with images are reviewed before they appear." />
        <Checkbox name="allowDerivatives" defaultChecked label="Allow remixes" hint="Others may publish modified versions that credit you." />
        <Checkbox name="isFanContent" label="This is fan content" hint="Tick if it's inspired by real wrestlers or companies. Text only: real people's photos, logos and trademarks are not allowed." />
        <Checkbox
          name="rights"
          required
          label="I have the right to share this"
          hint={<>It&apos;s my own work (or I have permission), contains no unlicensed photos, logos, music or artwork, and follows the <Link href="/policies/content" className="text-accent" target="_blank">content policy</Link>.</>}
        />
      </div>
    </>
  );
}
