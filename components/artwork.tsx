/**
 * Original placeholder artwork generated from entity names, so every entity
 * looks distinct without a custom image. No external assets are used.
 */
import clsx from "clsx";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTE = ["#7c2d12", "#1e3a8a", "#14532d", "#581c87", "#7f1d1d", "#134e4a", "#713f12", "#312e81", "#3f3f46", "#831843"];

export function mediaUrl(assetId: string, variant: "thumb" | "full" = "thumb"): string {
  return `/media/${assetId}?v=${variant}`;
}

export function WrestlerAvatar({ name, assetId, size = 48, className }: { name: string; assetId?: string | null; size?: number; className?: string }) {
  if (assetId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl(assetId)} alt={`${name} portrait`} width={size} height={size} className={clsx("shrink-0 rounded-lg object-cover", className)} style={{ width: size, height: size }} />;
  }
  const h = hash(name);
  const bg = PALETTE[h % PALETTE.length];
  const accent = PALETTE[(h >> 4) % PALETTE.length];
  return (
    <svg role="img" aria-label={`${name} placeholder portrait`} width={size} height={size} viewBox="0 0 64 64" className={clsx("shrink-0 rounded-lg", className)}>
      <rect width="64" height="64" fill={bg} />
      <path d="M0 64 L0 50 Q32 30 64 50 L64 64 Z" fill={accent} opacity="0.8" />
      <circle cx="32" cy="26" r="13" fill="#ffffff" opacity="0.14" />
      <path d="M14 64 Q16 44 32 42 Q48 44 50 64 Z" fill="#ffffff" opacity="0.14" />
      <text x="32" y="31" textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff" fontFamily="system-ui, sans-serif">
        {initials(name)}
      </text>
    </svg>
  );
}

export function PromotionLogo({ name, abbreviation, primary, secondary, assetId, size = 48, className }: { name: string; abbreviation: string; primary: string; secondary: string; assetId?: string | null; size?: number; className?: string }) {
  if (assetId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl(assetId)} alt={`${name} logo`} width={size} height={size} className={clsx("shrink-0 rounded-lg object-contain", className)} style={{ width: size, height: size }} />;
  }
  const label = abbreviation.slice(0, 4).toUpperCase();
  return (
    <svg role="img" aria-label={`${name} logo`} width={size} height={size} viewBox="0 0 64 64" className={clsx("shrink-0", className)}>
      <path d="M32 3 L58 12 L54 44 Q46 56 32 61 Q18 56 10 44 L6 12 Z" fill={secondary} stroke={primary} strokeWidth="3" />
      <path d="M32 9 L52 16 L49 42 Q43 51 32 55 Q21 51 15 42 L12 16 Z" fill={primary} opacity="0.25" />
      <text x="32" y={label.length > 3 ? 38 : 40} textAnchor="middle" fontSize={label.length > 3 ? 13 : 16} fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif" letterSpacing="1">
        {label}
      </text>
    </svg>
  );
}

export function ChampionshipArt({ name, assetId, tier = "secondary", size = 48, className }: { name: string; assetId?: string | null; tier?: string; size?: number; className?: string }) {
  if (assetId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl(assetId)} alt={`${name} design`} width={size} height={size} className={clsx("shrink-0 rounded-lg object-contain", className)} style={{ width: size, height: size }} />;
  }
  const plate = tier === "world" ? "#ca8a04" : tier === "tag" ? "#9ca3af" : tier === "specialty" ? "#b45309" : "#d4d4d8";
  const strap = PALETTE[hash(name) % PALETTE.length];
  return (
    <svg role="img" aria-label={`${name} placeholder design`} width={size} height={size} viewBox="0 0 64 64" className={clsx("shrink-0", className)}>
      <rect x="2" y="24" width="60" height="16" rx="6" fill={strap} />
      <ellipse cx="32" cy="32" rx="17" ry="14" fill={plate} stroke="#00000033" strokeWidth="1.5" />
      <ellipse cx="32" cy="32" rx="11" ry="9" fill="none" stroke="#00000040" strokeWidth="1.5" />
      <rect x="8" y="27" width="7" height="10" rx="2" fill={plate} />
      <rect x="49" y="27" width="7" height="10" rx="2" fill={plate} />
      <text x="32" y="36" textAnchor="middle" fontSize="10" fontWeight="800" fill="#00000099" fontFamily="system-ui, sans-serif">
        {initials(name)}
      </text>
    </svg>
  );
}

export function TeamLogo({ name, assetId, size = 40, className }: { name: string; assetId?: string | null; size?: number; className?: string }) {
  if (assetId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl(assetId)} alt={`${name} logo`} width={size} height={size} className={clsx("shrink-0 rounded-lg object-cover", className)} style={{ width: size, height: size }} />;
  }
  const h = hash(name);
  const a = PALETTE[h % PALETTE.length];
  const b = PALETTE[(h >> 3) % PALETTE.length];
  return (
    <svg role="img" aria-label={`${name} placeholder logo`} width={size} height={size} viewBox="0 0 64 64" className={clsx("shrink-0 rounded-lg", className)}>
      <rect width="64" height="64" fill={a} />
      <path d="M0 64 L64 0 L64 64 Z" fill={b} opacity="0.7" />
      <text x="32" y="39" textAnchor="middle" fontSize="18" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">
        {initials(name)}
      </text>
    </svg>
  );
}

export function PosterArt({ title, assetId, className }: { title: string; assetId?: string | null; className?: string }) {
  if (assetId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl(assetId, "full")} alt={`${title} poster`} className={clsx("aspect-[16/9] w-full rounded-xl object-cover", className)} />;
  }
  const h = hash(title);
  return (
    <svg role="img" aria-label={`${title} placeholder graphic`} viewBox="0 0 160 90" className={clsx("aspect-[16/9] w-full rounded-xl", className)}>
      <rect width="160" height="90" fill={PALETTE[h % PALETTE.length]} />
      <path d={`M0 90 L${40 + (h % 60)} 0 L160 0 L160 90 Z`} fill={PALETTE[(h >> 5) % PALETTE.length]} opacity="0.6" />
      <text x="80" y="50" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">
        {title.slice(0, 26).toUpperCase()}
      </text>
    </svg>
  );
}
