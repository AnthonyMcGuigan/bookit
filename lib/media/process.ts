/**
 * Image validation and re-encoding. Every upload is decoded and re-encoded
 * to WebP, which strips metadata (EXIF/GPS) and neutralises polyglot files.
 */
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import type { MediaKind } from "@/lib/domain/enums";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DIMENSION = 4096;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

const OUTPUT_SIZE: Record<MediaKind, { full: number; thumb: number; square: boolean }> = {
  portrait: { full: 768, thumb: 192, square: true },
  promotion_logo: { full: 768, thumb: 192, square: false },
  championship: { full: 768, thumb: 192, square: false },
  team_logo: { full: 768, thumb: 192, square: false },
  venue: { full: 1280, thumb: 320, square: false },
  event_poster: { full: 1600, thumb: 400, square: false },
  show_graphic: { full: 1600, thumb: 400, square: false },
  creation_thumbnail: { full: 1200, thumb: 400, square: false },
};

export class MediaValidationError extends Error {}

export interface ProcessedImage {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  sha256: string;
}

export async function processImage(input: Buffer, kind: MediaKind): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new MediaValidationError("The file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new MediaValidationError("Images must be 5 MB or smaller.");
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION, failOn: "error" }).metadata();
  } catch {
    throw new MediaValidationError("That file isn't a valid image.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new MediaValidationError("Use a JPEG, PNG or WebP image.");
  if (!meta.width || !meta.height) throw new MediaValidationError("That file isn't a valid image.");
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) throw new MediaValidationError(`Images can be at most ${MAX_DIMENSION}×${MAX_DIMENSION} pixels.`);
  if ((meta.pages ?? 1) > 1) throw new MediaValidationError("Animated images aren't supported.");

  const size = OUTPUT_SIZE[kind];
  const base = () => sharp(input, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION }).rotate();
  const full = await base()
    .resize(size.full, size.full, { fit: size.square ? "cover" : "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base()
    .resize(size.thumb, size.thumb, { fit: size.square ? "cover" : "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  return {
    full: full.data,
    thumb,
    width: full.info.width,
    height: full.info.height,
    sha256: createHash("sha256").update(full.data).digest("hex"),
  };
}
