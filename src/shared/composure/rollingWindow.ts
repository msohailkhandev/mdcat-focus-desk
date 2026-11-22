/**
 * A time-bounded window of `(timestamp, value)` points.
 *
 * Points older than `durationMs` relative to the newest point are evicted on
 * every push, so the window never grows unbounded during a long session.
 */
export class RollingWindow {
  private readonly points: { tsMs: number; value: number }[] = [];

  public constructor(private readonly durationMs: number) {
    if (durationMs <= 0) {
      throw new RangeError('durationMs must be positive');
    }
  }

  public push(tsMs: number, value: number): void {
    this.points.push({ tsMs, value });
    this.evictBefore(tsMs - this.durationMs);
  }

  /** Drop points older than `tsMs` without adding a new one. */
  public advanceTo(tsMs: number): void {
    this.evictBefore(tsMs - this.durationMs);
  }

  public get size(): number {
    return this.points.length;
  }

  public mean(): number | null {
    if (this.points.length === 0) {
      return null;
    }
    let sum = 0;
    for (const p of this.points) {
      sum += p.value;
    }
    return sum / this.points.length;
  }

  /** Fraction (0-1) of points whose value satisfies `predicate`. */
  public fraction(predicate: (value: number) => boolean): number {
    if (this.points.length === 0) {
      return 0;
    }
    let hits = 0;
    for (const p of this.points) {
      if (predicate(p.value)) {
        hits += 1;
      }
    }
    return hits / this.points.length;
  }

  public clear(): void {
    this.points.length = 0;
  }

  private evictBefore(cutoffMs: number): void {
    let drop = 0;
    while (drop < this.points.length) {
      const point = this.points[drop];
      if (point === undefined || point.tsMs >= cutoffMs) {
        break;
      }
      drop += 1;
    }
    if (drop > 0) {
      this.points.splice(0, drop);
    }
  }
}
