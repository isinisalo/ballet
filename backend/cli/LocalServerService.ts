import {
  findFreeLoopbackPort,
  isLoopbackPortAvailable,
  loadLocalSettings,
  loadOrCreateServiceState,
  loadServiceState,
  saveServiceState,
  updateProviderCommands,
  type LocalSettings,
  type ServiceState
} from "./CheckoutState.js";
import type { LaunchdService, LaunchdStatus } from "./LaunchdService.js";
import type { ProjectContext } from "../project/ProjectContext.js";

export interface LocalHealth {
  ok: true;
  instanceId: string;
  checkoutRoot: string;
  port: number;
  version: string;
  startedAt: string;
}

export interface LocalServerStatus {
  configured: boolean;
  state?: ServiceState;
  launchd: LaunchdStatus;
  health?: LocalHealth;
}

export interface LocalServerServiceOptions {
  project: ProjectContext;
  launchd: LaunchdService;
  fetch?: typeof fetch;
  startupTimeoutMs?: number;
}

export class LocalServerService {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: LocalServerServiceOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async ensureStarted(commands: { codexCommand?: string; copilotCommand?: string } = {}): Promise<ServiceState> {
    let state = await loadOrCreateServiceState(this.options.project);
    const { settings, commandOverridesChanged } = await this.prepareSettings(commands);
    if (await this.reuseOrStopExisting(state, commandOverridesChanged)) return state;
    state = await this.ensureAvailablePort(state);
    return this.installWithConflictRecovery(state, settings);
  }

  private async prepareSettings(commands: {
    codexCommand?: string;
    copilotCommand?: string;
  }): Promise<{ settings: LocalSettings; commandOverridesChanged: boolean }> {
    const existing = await loadLocalSettings(this.options.project);
    const changed = (commands.codexCommand !== undefined && commands.codexCommand !== existing.codexCommand)
      || (commands.copilotCommand !== undefined && commands.copilotCommand !== existing.copilotCommand);
    if (!changed) return { settings: existing, commandOverridesChanged: false };
    return {
      settings: await updateProviderCommands(this.options.project, commands),
      commandOverridesChanged: true
    };
  }

  private async reuseOrStopExisting(state: ServiceState, commandsChanged: boolean): Promise<boolean> {
    let health = await this.probe(state);
    if (health && this.matches(health, state)) {
      if (!commandsChanged) return true;
      await this.stopGracefully();
      return false;
    }
    const launchd = await this.options.launchd.status(state);
    if (launchd.running) health = await this.waitUntilReady(state, 2_000).catch(() => undefined);
    if (health && this.matches(health, state)) {
      if (!commandsChanged) return true;
      await this.stopGracefully();
      return false;
    }
    if (launchd.loaded) await this.options.launchd.stop(state);
    return false;
  }

  private async ensureAvailablePort(state: ServiceState): Promise<ServiceState> {
    if (await isLoopbackPortAvailable(state.port)) return state;
    const replacement = { ...state, port: await findDifferentLoopbackPort(state.port) };
    await saveServiceState(this.options.project, replacement);
    return replacement;
  }

  private async installWithConflictRecovery(state: ServiceState, settings: LocalSettings): Promise<ServiceState> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.options.launchd.installAndStart(state, settings);
        await this.waitUntilReady(state, this.options.startupTimeoutMs ?? 20_000);
        return state;
      } catch (error) {
        const portHealth = await this.probe(state);
        const portWasClaimed = Boolean(portHealth && !this.matches(portHealth, state))
          || !(await isLoopbackPortAvailable(state.port));
        if (!portWasClaimed || attempt === 2) throw this.startupError(error);
        await this.options.launchd.stop(state);
        state = { ...state, port: await findDifferentLoopbackPort(state.port) };
        await saveServiceState(this.options.project, state);
      }
    }
    throw new Error("Ballet exhausted its local startup attempts.");
  }

  async restart(commands: { codexCommand?: string; copilotCommand?: string } = {}, timeoutMs = 90_000): Promise<ServiceState> {
    await this.stopGracefully(timeoutMs);
    return this.ensureStarted(commands);
  }

  async stopGracefully(timeoutMs = 90_000): Promise<boolean> {
    const state = await loadServiceState(this.options.project);
    if (!state) return false;
    const health = await this.probe(state);
    if (health && this.matches(health, state)) {
      const response = await this.fetchImpl(this.url(state, "/api/local/shutdown"), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, 5_000)))
      });
      if (response.status !== 202) {
        throw new Error(`Ballet shutdown request failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
      }
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (!await this.probe(state, Math.min(1_000, Math.max(1, deadline - Date.now())))) break;
        await delay(200);
      }
      if (await this.probe(state, 500)) {
        throw new Error("Ballet shutdown timed out; the checkout service was left loaded.");
      }
    }
    await this.options.launchd.stop(state);
    return true;
  }

  async status(): Promise<LocalServerStatus> {
    const state = await loadServiceState(this.options.project);
    if (!state) return { configured: false, launchd: { loaded: false, running: false } };
    return {
      configured: true,
      state,
      launchd: await this.options.launchd.status(state),
      health: await this.probe(state)
    };
  }

  async probe(state: ServiceState, timeoutMs = 2_000): Promise<LocalHealth | undefined> {
    try {
      const response = await this.fetchImpl(this.url(state, "/api/health"), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(Math.max(1, timeoutMs))
      });
      if (!response.ok) return undefined;
      const value = await response.json() as Partial<LocalHealth>;
      if (value.ok !== true
        || typeof value.instanceId !== "string"
        || typeof value.checkoutRoot !== "string"
        || typeof value.port !== "number"
        || typeof value.version !== "string"
        || typeof value.startedAt !== "string") return undefined;
      return value as LocalHealth;
    } catch {
      return undefined;
    }
  }

  private async waitUntilReady(state: ServiceState, timeoutMs: number): Promise<LocalHealth> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const health = await this.probe(state, Math.min(1_000, Math.max(1, deadline - Date.now())));
      if (health && this.matches(health, state)) return health;
      if (health) throw new Error(`Port ${state.port} is serving a different Ballet checkout.`);
      await delay(200);
    }
    throw new Error(`Ballet did not become ready at ${this.url(state).origin}.`);
  }

  private startupError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    const logs = `${this.options.project.stateRoot}/logs`;
    return new Error(`${message} Check ${logs}/ballet.log and ${logs}/launchd.err.log.`, { cause: error });
  }

  private matches(health: LocalHealth, state: ServiceState): boolean {
    return health.instanceId === state.instanceId
      && health.checkoutRoot === state.checkoutRoot
      && health.port === state.port;
  }

  private url(state: ServiceState, pathname = "/"): URL {
    return new URL(pathname, `http://127.0.0.1:${state.port}`);
  }
}

const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const findDifferentLoopbackPort = async (previousPort: number): Promise<number> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = await findFreeLoopbackPort();
    if (candidate !== previousPort) return candidate;
  }
  throw new Error(`Ballet could not allocate a replacement for loopback port ${previousPort}.`);
};
