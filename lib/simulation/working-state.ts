import { clamp } from "./rng";
import type { WrestlerDelta } from "./types";
import { emptyDelta } from "./types";
import type { Wrestler } from "@/lib/domain/entities";

/**
 * Tracks deltas accumulated during a show so later segments see earlier
 * effects (a wrestler booked twice is more tired in their second match).
 */
export class WorkingState {
  private readonly deltas = new Map<string, WrestlerDelta>();

  constructor(private readonly wrestlers: Map<string, Wrestler>) {}

  private base(id: string): Wrestler {
    const w = this.wrestlers.get(id);
    if (!w) throw new Error(`Unknown wrestler ${id}`);
    return w;
  }

  delta(id: string): WrestlerDelta {
    let d = this.deltas.get(id);
    if (!d) {
      d = emptyDelta();
      this.deltas.set(id, d);
    }
    return d;
  }

  apply(id: string, change: WrestlerDelta): void {
    const d = this.delta(id);
    d.popularity += change.popularity;
    d.momentum += change.momentum;
    d.morale += change.morale;
    d.fatigue += change.fatigue;
    d.reputation += change.reputation;
    for (const [k, v] of Object.entries(change.attributes)) d.attributes[k] = (d.attributes[k] ?? 0) + (v ?? 0);
  }

  fatigue(id: string): number {
    return clamp(this.base(id).fatigue + (this.deltas.get(id)?.fatigue ?? 0), 0, 100);
  }

  momentum(id: string): number {
    return clamp(this.base(id).momentum + (this.deltas.get(id)?.momentum ?? 0), -100, 100);
  }

  popularity(id: string): number {
    return clamp(this.base(id).popularity + (this.deltas.get(id)?.popularity ?? 0), 0, 100);
  }

  entries(): Array<[string, WrestlerDelta]> {
    return [...this.deltas.entries()];
  }
}
