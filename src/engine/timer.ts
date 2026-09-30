export type Now = () => number;

/**
 * Drift-free countdown timer based on a monotonic clock.
 * Remaining time is derived, never accumulated, so frame drops do not matter.
 */
export class CountdownTimer {
  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private durationMs = 0;
  private running = false;
  private frozenRemaining = 0;
  private started = false;

  constructor(private readonly now: Now = () => performance.now()) {}

  start(durationMs: number): void {
    this.durationMs = durationMs;
    this.startedAt = this.now();
    this.pausedAt = null;
    this.pausedTotal = 0;
    this.running = true;
    this.started = true;
  }

  pause(): void {
    if (!this.running || this.pausedAt !== null) return;
    this.pausedAt = this.now();
  }

  resume(): void {
    if (!this.running || this.pausedAt === null) return;
    this.pausedTotal += this.now() - this.pausedAt;
    this.pausedAt = null;
  }

  /** Stops the clock and freezes the remaining time at this instant. */
  stop(): void {
    if (this.running) this.frozenRemaining = Math.max(0, this.durationMs - this.elapsed());
    this.running = false;
  }

  get hasStarted(): boolean {
    return this.started;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isPaused(): boolean {
    return this.pausedAt !== null;
  }

  elapsed(): number {
    if (!this.running) return 0;
    const end = this.pausedAt ?? this.now();
    return Math.max(0, end - this.startedAt - this.pausedTotal);
  }

  remaining(): number {
    if (!this.running) return this.frozenRemaining;
    return Math.max(0, this.durationMs - this.elapsed());
  }

  /** 0..1 fraction of time left. */
  fraction(): number {
    if (this.durationMs <= 0) return 0;
    return this.remaining() / this.durationMs;
  }

  get duration(): number {
    return this.durationMs;
  }
}
