import type { ControlPlaneService } from "./ControlPlaneService.js";

export class ControlPlaneMaintenance {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly service: ControlPlaneService,
    private readonly now: () => Date,
    private readonly offlineAfterMs = 45_000,
    private readonly intervalMs = 15_000
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.tick().catch(() => undefined); }, this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    const now = this.now();
    await this.service.sweepExpiredLeases(now.toISOString());
    const cutoff = new Date(now.getTime() - this.offlineAfterMs).toISOString();
    await this.service.markOfflineRuntimes(cutoff);
  }
}
