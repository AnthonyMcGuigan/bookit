import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { buildStarterUniverse } from "@/lib/seed/starter";
import { remapUniverseIds } from "@/lib/storage/remap";
import { buildPackage } from "@/lib/packages/build";
import { validatePackage, parsePackageJson } from "@/lib/packages/validate";
import { analysePackage, preparePackageImport } from "@/lib/packages/merge";
import { readPackageZip, writePackageZip } from "@/lib/packages/zip";
import { PACKAGE_SCHEMA_VERSION, PackageError } from "@/lib/packages/schema";

const starter = buildStarterUniverse({ name: "Package test" });
const roundTrip = (kind: Parameters<typeof buildPackage>[1]["kind"], rootId?: string) =>
  validatePackage(JSON.parse(JSON.stringify(buildPackage(starter, { kind, rootId }))));

describe("package build and validation", () => {
  it("round-trips a full universe without losing rows", () => {
    const pkg = roundTrip("universe");
    expect(pkg.content.wrestlers?.length).toBe(starter.wrestlers.length);
    expect(pkg.content.championships?.length).toBe(starter.championships.length);
    expect(pkg.universe?.name).toBe("Package test");
    // Save-specific columns are not exported.
    expect(pkg.content.wrestlers?.[0]).not.toHaveProperty("universe_id");
  });

  it("builds a scenario without history", () => {
    const pkg = roundTrip("scenario");
    expect(pkg.content.segmentResults).toBeUndefined();
    expect(pkg.content.timelineEvents).toBeUndefined();
    expect((pkg.content.shows ?? []).every((s) => s.status !== "completed")).toBe(true);
    expect((pkg.content.titleReigns ?? []).every((r) => r.ended_on === null)).toBe(true);
  });

  it("builds a self-contained team package", () => {
    const team = starter.teams[0];
    const pkg = roundTrip("team", team.id);
    expect(pkg.content.teams?.[0].id).toBe(team.id);
    const memberIds = new Set(pkg.content.teamMemberships?.map((m) => m.wrestler_id));
    expect(new Set(pkg.content.wrestlers?.map((w) => w.id))).toEqual(memberIds);
  });

  it("rejects packages from a newer version and bad formats", () => {
    const pkg = buildPackage(starter, { kind: "wrestler", rootId: starter.wrestlers[0].id });
    expect(() => validatePackage({ ...pkg, schemaVersion: PACKAGE_SCHEMA_VERSION + 1 })).toThrow(/newer version/);
    expect(() => validatePackage({ ...pkg, format: "other" })).toThrow(PackageError);
    expect(() => parsePackageJson("{nope")).toThrow(/valid JSON/);
  });

  it("reports invalid rows instead of importing them", () => {
    const pkg = buildPackage(starter, { kind: "wrestler", rootId: starter.wrestlers[0].id });
    const broken = JSON.parse(JSON.stringify(pkg));
    broken.content.wrestlers[0].charisma = 400;
    expect(() => validatePackage(broken)).toThrow(/invalid/);
  });
});

describe("import planning", () => {
  const target = remapUniverseIds(starter).state;

  it("creates a new universe from a universe package with fresh ids", () => {
    const pkg = roundTrip("universe");
    const prepared = preparePackageImport(pkg, { targetUniverseId: "11111111-1111-4111-8111-111111111111", target: null });
    const wrestlers = prepared.rows.wrestlers as Array<{ id: string; universe_id: string }>;
    expect(wrestlers).toHaveLength(starter.wrestlers.length);
    expect(wrestlers.every((w) => w.universe_id === "11111111-1111-4111-8111-111111111111")).toBe(true);
    const oldIds = new Set(starter.wrestlers.map((w) => w.id));
    expect(wrestlers.some((w) => oldIds.has(w.id))).toBe(false);
    // Every reign still points at an imported championship.
    const champIds = new Set((prepared.rows.championships as Array<{ id: string }>).map((c) => c.id));
    expect((prepared.rows.title_reigns as Array<{ championship_id: string }>).every((r) => champIds.has(r.championship_id))).toBe(true);
  });

  it("detects name conflicts and applies each resolution", () => {
    const team = starter.teams.find((t) => starter.teamMemberships.filter((m) => m.team_id === t.id && m.left_on === null).length >= 2)!;
    const pkg = roundTrip("team", team.id);
    const analysis = analysePackage(pkg, target);
    const teamConflict = analysis.conflicts.find((c) => c.collection === "teams")!;
    const wrestlerConflicts = analysis.conflicts.filter((c) => c.collection === "wrestlers");
    expect(teamConflict.existingName).toBe(team.name);
    expect(wrestlerConflicts.length).toBeGreaterThanOrEqual(2);

    // Rename the team, link members to the existing wrestlers.
    const prepared = preparePackageImport(pkg, {
      targetUniverseId: target.universe.id,
      target,
      resolutions: { [teamConflict.key]: { action: "rename", name: "Fresh Squad" } },
    });
    const teams = prepared.rows.teams as Array<{ id: string; name: string }>;
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe("Fresh Squad");
    expect(prepared.rows.wrestlers).toBeUndefined();
    const memberships = prepared.rows.team_memberships as Array<{ team_id: string; wrestler_id: string }>;
    const existingIds = new Set(target.wrestlers.map((w) => w.id));
    expect(memberships.every((m) => m.team_id === teams[0].id && existingIds.has(m.wrestler_id))).toBe(true);

    // Skipping the team drops its memberships too.
    const skipped = preparePackageImport(pkg, { targetUniverseId: target.universe.id, target, resolutions: { [teamConflict.key]: { action: "skip" } } });
    expect(skipped.rows.teams).toBeUndefined();
    expect(skipped.rows.team_memberships).toBeUndefined();

    // Importing everything as new keeps duplicate names but fresh ids.
    const asNew = preparePackageImport(pkg, {
      targetUniverseId: target.universe.id,
      target,
      resolutions: Object.fromEntries(analysis.conflicts.map((c) => [c.key, { action: "new" as const }])),
    });
    expect((asNew.rows.wrestlers as unknown[]).length).toBe(pkg.content.wrestlers!.length);
    expect((asNew.rows.wrestlers as Array<{ id: string }>).some((w) => existingIds.has(w.id))).toBe(false);
  });

  it("assigns a championship to the chosen promotion and clears media without files", () => {
    const champ = starter.championships[0];
    const pkg = roundTrip("championship", champ.id);
    const blank = { ...target, championships: [], titleReigns: [], titleReignHolders: [] };
    const analysis = analysePackage(pkg, blank);
    expect(analysis.needsPromotion).toBe(true);
    const promo = blank.promotions[0];
    const prepared = preparePackageImport(pkg, { targetUniverseId: blank.universe.id, target: blank, defaultPromotionId: promo.id });
    const rows = prepared.rows.championships as Array<{ promotion_id: string; image_asset_id: string | null }>;
    expect(rows[0].promotion_id).toBe(promo.id);
    expect(rows[0].image_asset_id).toBeNull();
  });
});

describe("zip packages", () => {
  it("round-trips package.json and media", () => {
    const data = writePackageZip('{"a":1}', [{ file: "media/11111111-1111-4111-8111-111111111111.webp", data: new Uint8Array([1, 2, 3]) }]);
    const read = readPackageZip(data);
    expect(read.json).toBe('{"a":1}');
    expect(read.media.get("media/11111111-1111-4111-8111-111111111111.webp")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects archives that expand beyond the limits", () => {
    const big = new Uint8Array(6 * 1024 * 1024); // compresses to almost nothing
    const bomb = zipSync({ "package.json": strToU8("{}"), "media/11111111-1111-4111-8111-111111111111.webp": big });
    expect(() => readPackageZip(bomb)).toThrow(/too large/);
  });

  it("ignores unexpected paths such as traversal attempts", () => {
    const zip = zipSync({ "package.json": strToU8("{}"), "../evil.sh": strToU8("rm -rf /") });
    expect(readPackageZip(zip).media.size).toBe(0);
  });

  it("requires package.json", () => {
    expect(() => readPackageZip(zipSync({ "readme.txt": strToU8("hi") }))).toThrow(/package.json/);
  });
});
