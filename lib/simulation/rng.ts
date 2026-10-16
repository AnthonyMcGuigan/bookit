/**
 * Deterministic, seedable pseudo-random number generator (sfc32 seeded via
 * cyrb128). Identical seeds always produce identical simulations, which makes
 * results reproducible in tests and lets a stored seed explain a past result.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** True with the given probability (0-1). */
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Weighted choice; weights must be non-negative and not all zero. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** Approximately normal value with mean 0 and the given standard deviation. */
  normal(stdDev?: number): number;
  shuffle<T>(items: readonly T[]): T[];
  /** Derive an independent generator for a sub-task. */
  fork(label: string): Rng;
  readonly seed: string;
}

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const [a, b, c, d] = cyrb128(seed);
  const raw = sfc32(a, b, c, d);
  // Warm up the generator.
  for (let i = 0; i < 12; i++) raw();

  const rng: Rng = {
    seed,
    next: raw,
    int(min, max) {
      return Math.floor(raw() * (max - min + 1)) + min;
    },
    range(min, max) {
      return raw() * (max - min) + min;
    },
    chance(p) {
      return raw() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error("Cannot pick from an empty list");
      return items[Math.floor(raw() * items.length)];
    },
    weighted(items, weights) {
      const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
      if (items.length === 0 || total <= 0) throw new Error("Invalid weighted choice");
      let roll = raw() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= Math.max(0, weights[i]);
        if (roll < 0) return items[i];
      }
      return items[items.length - 1];
    },
    normal(stdDev = 1) {
      // Irwin-Hall approximation: sum of 6 uniforms.
      let s = 0;
      for (let i = 0; i < 6; i++) s += raw();
      return (s - 3) * stdDev * Math.SQRT2;
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    fork(label) {
      return createRng(`${seed}::${label}`);
    },
  };
  return rng;
}

/** Deterministic RFC 4122 version-4-shaped UUID from an RNG. */
export function rngUuid(rng: Rng): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(rng.int(0, 255).toString(16).padStart(2, "0"));
  hex[6] = ((parseInt(hex[6], 16) & 0x0f) | 0x40).toString(16).padStart(2, "0");
  hex[8] = ((parseInt(hex[8], 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
