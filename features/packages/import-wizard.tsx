"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { COLLECTION_LABELS, type Resolution, type ResolutionAction } from "@/lib/packages/merge";
import type { UniverseCollectionKey } from "@/lib/domain/entities";
import { analyseImportAction, runImportAction, type AnalyseResult } from "./actions";

type Source = { kind: "file"; file: File } | { kind: "community"; creationId: string; version: number | null };

const ACTION_LABELS: Record<ResolutionAction, string> = {
  existing: "Use the existing one",
  rename: "Import with a new name",
  new: "Import as a duplicate",
  skip: "Don't import",
};

export function ImportWizard({
  community,
  initialTarget,
}: {
  community?: { creationId: string; version: number | null; title: string } | null;
  initialTarget?: string | null;
}) {
  const [source, setSource] = useState<Source | null>(community ? { kind: "community", creationId: community.creationId, version: community.version } : null);
  const [result, setResult] = useState<Extract<AnalyseResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [universeName, setUniverseName] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [pending, start] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function baseForm(src: Source, target: string | null) {
    const fd = new FormData();
    if (src.kind === "file") {
      fd.set("source", "file");
      fd.set("file", src.file);
    } else {
      fd.set("source", "community");
      fd.set("creationId", src.creationId);
      if (src.version) fd.set("version", String(src.version));
    }
    if (target) fd.set("targetUniverseId", target);
    return fd;
  }

  function analyse(src: Source, target: string | null) {
    setError(null);
    start(async () => {
      const res = await analyseImportAction(baseForm(src, target));
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult(res);
      setResolutions(Object.fromEntries(res.analysis.conflicts.map((c) => [c.key, { action: "existing" as const }])));
      setNames(Object.fromEntries(res.analysis.conflicts.map((c) => [c.key, c.suggestedName])));
      setPromotionId(res.promotions[0]?.id ?? "");
      if (res.analysis.createsUniverse && !universeName) setUniverseName(res.analysis.title.slice(0, 80));
      // Entity packages go into a universe: pick one straight away if the player has exactly one.
      if (!res.analysis.createsUniverse && !target) {
        const preferred = initialTarget && res.universes.some((u) => u.id === initialTarget) ? initialTarget : res.universes.length === 1 ? res.universes[0].id : null;
        if (preferred) analyse(src, preferred);
      }
    });
  }

  function runImport() {
    if (!source || !result) return;
    const fd = baseForm(source, result.targetUniverseId);
    fd.set("mode", result.analysis.createsUniverse ? "new" : "into");
    fd.set("universeName", universeName);
    fd.set("defaultPromotionId", promotionId);
    fd.set("idempotencyKey", idempotencyKey);
    const final: Record<string, Resolution> = {};
    for (const [key, r] of Object.entries(resolutions)) final[key] = r.action === "rename" ? { action: "rename", name: names[key] } : r;
    fd.set("resolutions", JSON.stringify(final));
    setError(null);
    start(async () => {
      const res = await runImportAction(fd);
      if (res && !res.ok) setError(res.error);
    });
  }

  const counts = useMemo(
    () => Object.entries(result?.analysis.counts ?? {}).filter(([key]) => ["wrestlers", "promotions", "teams", "championships", "storylines", "venues", "shows", "titleReigns"].includes(key)),
    [result],
  );
  const needsTarget = result && !result.analysis.createsUniverse;
  const ready = result && (!needsTarget || result.targetUniverseId);

  return (
    <div className="space-y-4" data-testid="import-wizard">
      <Card>
        <CardHeader title="1. Choose a package" />
        <div className="space-y-3 p-4">
          {community ? (
            <p className="text-sm">
              Importing <span className="font-semibold">{community.title}</span> from the community library.
            </p>
          ) : (
            <Field label="Package file" htmlFor="package-file" hint="A .json or .zip package exported from this game (25 MB max).">
              <Input
                id="package-file"
                type="file"
                accept=".json,.zip,application/json,application/zip"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setResult(null);
                  if (file) {
                    const src: Source = { kind: "file", file };
                    setSource(src);
                    analyse(src, initialTarget ?? null);
                  }
                }}
              />
            </Field>
          )}
          {community && !result && (
            <Button type="button" onClick={() => source && analyse(source, initialTarget ?? null)} disabled={pending}>
              {pending ? "Checking…" : "Check package"}
            </Button>
          )}
          {pending && !result && <p className="text-sm text-muted" aria-live="polite">Checking the package…</p>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Card>

      {result && (
        <Card>
          <CardHeader title="2. Review" subtitle={result.sourceLabel} />
          <div className="space-y-4 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="upcoming">{result.analysis.kindLabel}</Badge>
                <span className="font-semibold">{result.analysis.title}</span>
              </div>
              {result.analysis.description && <p className="mt-1 text-sm text-muted">{result.analysis.description}</p>}
              <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted" data-testid="import-counts">
                {counts.map(([key, n]) => (
                  <li key={key} className="rounded-full bg-surface-2 px-2 py-1">
                    {n} {COLLECTION_LABELS[key as UniverseCollectionKey].toLowerCase()}
                  </li>
                ))}
                {result.analysis.mediaCount > 0 && <li className="rounded-full bg-surface-2 px-2 py-1">{result.analysis.mediaCount} image(s)</li>}
              </ul>
              {result.analysis.attribution.length > 0 && (
                <p className="mt-2 text-xs text-muted">Based on: {result.analysis.attribution.map((a) => `${a.title} by ${a.author}`).join(", ")}</p>
              )}
            </div>

            {result.analysis.createsUniverse ? (
              <Field label="New universe name" htmlFor="universe-name" hint="Universe and scenario packages always become a new save; nothing existing is changed.">
                <Input id="universe-name" value={universeName} maxLength={80} onChange={(e) => setUniverseName(e.target.value)} />
              </Field>
            ) : (
              <Field label="Import into" htmlFor="target-universe">
                <Select
                  id="target-universe"
                  value={result.targetUniverseId ?? ""}
                  onChange={(e) => source && analyse(source, e.target.value || null)}
                  disabled={pending}
                >
                  <option value="">Choose a universe…</option>
                  {result.universes.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            {needsTarget && result.universes.length === 0 && <Alert tone="gold">Create a universe first, then import this package into it.</Alert>}

            {result.targetUniverseId && result.analysis.needsPromotion && (
              <Field label="Promotion for championships and contracts" htmlFor="default-promotion" hint="This package doesn't include a promotion, so its records will belong to the one you choose.">
                <Select id="default-promotion" value={promotionId} onChange={(e) => setPromotionId(e.target.value)}>
                  {result.promotions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
            )}

            {result.analysis.conflicts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Name matches in this universe</h3>
                <p className="mb-2 text-xs text-muted">These records have the same name as something you already have. Choose what to do with each one.</p>
                <ul className="divide-y divide-border rounded-lg border border-border" data-testid="import-conflicts">
                  {result.analysis.conflicts.map((c) => {
                    const action = resolutions[c.key]?.action ?? "existing";
                    return (
                      <li key={c.key} className="space-y-2 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted">{COLLECTION_LABELS[c.collection]}</span>
                        </div>
                        <Select
                          aria-label={`What to do with ${c.name}`}
                          value={action}
                          onChange={(e) => setResolutions((r) => ({ ...r, [c.key]: { action: e.target.value as ResolutionAction } }))}
                        >
                          {(Object.keys(ACTION_LABELS) as ResolutionAction[]).map((a) => (
                            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                          ))}
                        </Select>
                        {action === "rename" && (
                          <Input aria-label={`New name for ${c.name}`} value={names[c.key] ?? ""} maxLength={80} onChange={(e) => setNames((n) => ({ ...n, [c.key]: e.target.value }))} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" onClick={runImport} disabled={!ready || pending || Boolean(needsTarget && result.analysis.needsPromotion && !promotionId)}>
                {pending ? "Importing…" : result.analysis.createsUniverse ? "Create universe" : "Import"}
              </Button>
              <p className="text-xs text-muted">Imported records get new ids, and images are copied into your own storage.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
