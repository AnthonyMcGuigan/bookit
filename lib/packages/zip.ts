/**
 * ZIP packages: package.json plus media/<id>.webp files. Reading enforces
 * entry-count, per-file and total-size limits before inflating anything, and
 * only accepts the expected file names (no paths outside the archive layout).
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { LIMITS, PackageError } from "./schema";

const MEDIA_NAME = /^media\/([0-9a-f-]{36})\.(webp|png|jpe?g)$/i;

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export interface ReadZipResult {
  json: string;
  /** Raw media bytes keyed by the file path inside the archive. */
  media: Map<string, Uint8Array>;
}

export function readPackageZip(bytes: Uint8Array): ReadZipResult {
  let entries = 0;
  let declaredTotal = 0;
  let problem: string | null = null;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(file) {
        entries++;
        if (entries > LIMITS.maxZipEntries) problem = "This archive has too many files.";
        const isPackage = file.name === "package.json";
        const isMedia = MEDIA_NAME.test(file.name);
        if (!isPackage && !isMedia) return false; // ignore anything unexpected (folders, OS metadata)
        const limit = isPackage ? LIMITS.maxJsonBytes : LIMITS.maxMediaBytes;
        if (file.originalSize > limit) problem = `${file.name} is too large.`;
        declaredTotal += file.originalSize;
        if (declaredTotal > LIMITS.maxZipUncompressedBytes) problem = "This archive expands to more data than allowed.";
        return problem === null;
      },
    });
  } catch {
    throw new PackageError("This ZIP file is damaged or uses an unsupported format.");
  }
  if (problem) throw new PackageError(problem);
  const pkg = files["package.json"];
  if (!pkg) throw new PackageError("This ZIP doesn't contain a package.json file.");
  // Declared sizes can lie; check what was actually inflated.
  let actualTotal = 0;
  const media = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(files)) {
    actualTotal += data.byteLength;
    if (name !== "package.json") {
      if (data.byteLength > LIMITS.maxMediaBytes) throw new PackageError(`${name} is too large.`);
      media.set(name.toLowerCase(), data);
    }
  }
  if (pkg.byteLength > LIMITS.maxJsonBytes || actualTotal > LIMITS.maxZipUncompressedBytes) {
    throw new PackageError("This archive expands to more data than allowed.");
  }
  return { json: strFromU8(pkg), media };
}

export function writePackageZip(json: string, media: Array<{ file: string; data: Uint8Array }>): Uint8Array {
  const files: Zippable = { "package.json": [strToU8(json), { level: 6 }] };
  // Images are already compressed; store them as-is.
  for (const m of media) files[m.file] = [m.data, { level: 0 }];
  return zipSync(files);
}
