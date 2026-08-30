import { describe, expect, it, vi } from "vitest";
import type { LocalDaemonStatus } from "../../shared/domain/runtime.js";
import type { DaemonConfigStore } from "../daemon/config/DaemonConfigStore.js";
import { DaemonCliService } from "./DaemonCliService.js";
import type { DaemonLaunchdService } from "./DaemonLaunchdService.js";

describe("DaemonCliService", () => {
  it("stops a daemon with an incompatible strict-cut config so the server can archive it", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const service = new DaemonCliService(
      { load: async () => { throw new Error("Daemon config must contain exactly one Codex provider."); } } as unknown as DaemonConfigStore,
      { stop } as unknown as DaemonLaunchdService, { stdout: vi.fn() }
    );
    await service.stopIfIdle(); expect(stop).toHaveBeenCalledOnce();
  });

  it("waits for the current launchd PID instead of accepting a stale online heartbeat", async () => {
    const config = { load: async () => ({ serverUrl: "http://127.0.0.1:53321" }) } as unknown as DaemonConfigStore;
    const launchd = { start: vi.fn(), status: async () => ({ loaded: true, running: true, pid: 22 }) } as unknown as DaemonLaunchdService;
    const statuses = [runtime(11), runtime(22)];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(statuses.shift() ?? runtime(22)), { status: 200 })) as unknown as typeof fetch;
    const service = new DaemonCliService(config, launchd, { stdout: vi.fn() }, fetchImpl);
    await expect(service.ensureStarted(1_000)).resolves.toEqual(expect.objectContaining({ pid: 22 }));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("allows launchd to transition through its bootstrap state", async () => {
    const config = { load: async () => ({ serverUrl: "http://127.0.0.1:53321" }) } as unknown as DaemonConfigStore;
    const states = [{ loaded: true, running: false }, { loaded: true, running: true, pid: 22 }];
    const launchd = { start: vi.fn(), status: async () => states.shift() ?? { loaded: true, running: true, pid: 22 } } as unknown as DaemonLaunchdService;
    const service = new DaemonCliService(config, launchd, { stdout: vi.fn() },
      (async () => new Response(JSON.stringify(runtime(22)), { status: 200 })) as typeof fetch);
    await expect(service.ensureStarted(1_000)).resolves.toEqual(expect.objectContaining({ pid: 22 }));
  });
});

const runtime = (pid: number): LocalDaemonStatus => ({ status: "online", pid, daemonVersion: "test", uptimeSeconds: 1,
  activeTaskCount: 0, lastSeenAt: new Date().toISOString(), refreshRequested: false, restartRequested: false, providers: [] });
