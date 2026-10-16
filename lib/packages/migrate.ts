/**
 * Package format migrations. Each entry upgrades a package from version N to
 * N + 1; packages are migrated step by step up to PACKAGE_SCHEMA_VERSION.
 * Packages from a newer game version are rejected with a clear message.
 */
import { PACKAGE_FORMAT, PACKAGE_SCHEMA_VERSION, PackageError } from "./schema";

type Raw = Record<string, unknown>;

export const MIGRATIONS: Record<number, (pkg: Raw) => Raw> = {
  // 1 -> 2 will live here when the format changes, e.g.:
  // 1: (pkg) => ({ ...pkg, schemaVersion: 2, content: renameColumn(pkg.content, "wrestlers", "old", "new") }),
};

export function migratePackage(input: unknown): Raw {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new PackageError("This isn't a valid booking-sim package.");
  }
  let pkg = input as Raw;
  if (pkg.format !== PACKAGE_FORMAT) throw new PackageError("This file isn't a booking-sim package.");
  const version = pkg.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new PackageError("This package has no valid format version.");
  }
  if (version > PACKAGE_SCHEMA_VERSION) {
    throw new PackageError("This package was made with a newer version of the game. Update the game and try again.");
  }
  for (let v = version; v < PACKAGE_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new PackageError(`No upgrade path for package format ${v}.`);
    pkg = step(pkg);
  }
  return pkg;
}
