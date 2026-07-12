import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { runBalletCli } from "../BalletCli.js";
import {
  loadLocalSettings,
  loadOrCreateServiceState,
  loadServiceState,
  updateProviderCommands,
  type LocalSettings,
  type ServiceState
} from "../CheckoutState.js";
import { renderPlist, type LaunchdService } from "../LaunchdService.js";
import { LocalServerService } from "../LocalServerService.js";
import { resolveProjectContext, type ProjectContext } from "../../project/ProjectContext.js";
import type { VerifiedReleaseUpdater } from "../VerifiedReleaseUpdater.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Ballet checkout CLI", () => {
  it("starts only the current checkout and forwards local provider overrides", async () => {
    const root = await gitProject();
    const output: string[] = [];
    const opened: string[] = [];
    let commands: unknown;
    let serverProject: ProjectContext | undefined;

    const code = await runBalletCli([
      "--codex-command", "/opt/tools/codex", "--copilot-command=copilot"
    ], services(root, {
      server: (project) => {
        serverProject = project;
        return {
          ensureStarted: async (value: unknown) => {
            commands = value;
            return serviceState(project, 4401);
          }
        } as unknown as LocalServerService;
      },
      output: { stdout: (message) => output.push(message), stderr: (message) => output.push(message) },
      openUrl: async (url) => { opened.push(url); }
    }));

    expect(code).toBe(0);
    expect(serverProject?.root).toBe(await realRoot(root));
    expect(commands).toEqual({ codexCommand: "/opt/tools/codex", copilotCommand: "copilot" });
    expect(opened).toEqual(["http://127.0.0.1:4401"]);
    expect(output[0]).toContain(await realRoot(root));
  });

  it("supports no-open and rejects invocation from a checkout subdirectory", async () => {
    const root = await gitProject();
    const opened: string[] = [];
    const noOpen = await runBalletCli(["--no-open"], services(root, {
      server: (project) => ({ ensureStarted: async () => serviceState(project, 4402) }) as unknown as LocalServerService,
      openUrl: async (url) => { opened.push(url); }
    }));
    const errors: string[] = [];
    const nested = path.join(root, "nested");
    await mkdir(nested);
    const nestedCode = await runBalletCli([], services(nested, {
      output: { stdout: () => undefined, stderr: (message) => errors.push(message) }
    }));

    expect(noOpen).toBe(0);
    expect(opened).toEqual([]);
    expect(nestedCode).toBe(1);
    expect(errors[0]).toContain("Git checkout root");
  });

  it("scopes stop, restart, status, and update to the checkout service", async () => {
    const root = await gitProject();
    const calls: string[] = [];
    const output: string[] = [];
    const serverFactory = (project: ProjectContext) => ({
      stopGracefully: async (timeout: number) => { calls.push(`stop:${timeout}`); return true; },
      restart: async (_commands: unknown, timeout: number) => { calls.push(`restart:${timeout}`); return serviceState(project, 4403); },
      status: async () => ({
        configured: true,
        state: serviceState(project, 4403),
        launchd: { loaded: true, running: true, pid: 42 },
        health: { ok: true, instanceId: project.instanceId, checkoutRoot: project.root, port: 4403, version: "1.2.3", startedAt: "2026-01-01T00:00:00.000Z" }
      })
    }) as unknown as LocalServerService;
    const overrides = {
      server: serverFactory,
      updater: { update: async () => { calls.push("update"); return "updated"; } } as VerifiedReleaseUpdater,
      output: { stdout: (message: string) => output.push(message), stderr: (message: string) => output.push(message) },
      stopTimeoutMs: 1234
    };

    expect(await runBalletCli(["stop"], services(root, overrides))).toBe(0);
    expect(await runBalletCli(["restart"], services(root, overrides))).toBe(0);
    expect(await runBalletCli(["status"], services(root, overrides))).toBe(0);
    expect(await runBalletCli(["update"], services(root, overrides))).toBe(0);

    expect(calls).toEqual(["stop:1234", "restart:1234", "update", "restart:1234"]);
    expect(output.join("\n")).toContain("\"serviceLabel\": \"ai.ballet.");
  });

  it("exposes only the simplified public command surface", async () => {
    const output: string[] = [];
    const code = await runBalletCli(["--help"], services(process.cwd(), {
      output: { stdout: (message) => output.push(message), stderr: (message) => output.push(message) }
    }));
    expect(code).toBe(0);
    expect(output[0]).toContain("ballet restart");
    expect(output[0]).not.toContain("setup");
    expect(output[0]).not.toContain("daemon");
    expect(output[0]).not.toContain("pair");
  });

  it("includes launchd bootstrap diagnostics in checkout logs", async () => {
    const root = await gitProject();
    const project = await resolveProjectContext({ root });
    const logsDirectory = path.join(project.stateRoot, "logs");
    await mkdir(logsDirectory, { recursive: true });
    await writeFile(path.join(logsDirectory, "launchd.err.log"), "old\nbootstrap failed\nretrying\n");
    const output: string[] = [];

    const code = await runBalletCli(["logs", "--lines", "2"], services(root, {
      output: { stdout: (message) => output.push(message), stderr: (message) => output.push(message) }
    }));

    expect(code).toBe(0);
    expect(output[0]).toContain("==> launchd.err.log <==");
    expect(output[0]).toContain("bootstrap failed\nretrying");
    expect(output[0]).not.toContain("old");
  });
});

describe("checkout-local state and launchd contract", () => {
  it("stores service and settings state under .git/ballet while preserving core fields", async () => {
    const root = await gitProject();
    const project = await resolveProjectContext({ root });
    const state = await loadOrCreateServiceState(project);
    await updateProviderCommands(project, { codexCommand: "/opt/codex" });
    const existing = JSON.parse(await readFile(project.settingsPath, "utf8")) as Record<string, unknown>;
    existing.agentReadOnlyRoots = { builder: ["/tmp/reference"] };
    await writeFile(project.settingsPath, `${JSON.stringify(existing)}\n`);
    await updateProviderCommands(project, { copilotCommand: "copilot" });

    expect(state.checkoutRoot).toBe(project.root);
    expect(state.instanceId).toBe(project.instanceId);
    expect(project.stateRoot).toBe(path.join(project.gitDir, "ballet"));
    await expect(loadLocalSettings(project)).resolves.toMatchObject({
      codexCommand: "/opt/codex",
      copilotCommand: "copilot",
      agentReadOnlyRoots: { builder: ["/tmp/reference"] }
    });
  });

  it("renders one unique checkout service that invokes the server directly", async () => {
    const root = await gitProject();
    const project = await resolveProjectContext({ root });
    const state = { ...await loadOrCreateServiceState(project), port: 4488 };
    const plist = renderPlist({
      project,
      programArguments: ["/usr/local/bin/ballet", "server-internal-run"],
      webDistPath: "/usr/local/share/ballet/dist"
    }, state, { version: 1, codexCommand: "/opt/codex", copilotCommand: "copilot" });

    expect(plist).toContain(`<key>Label</key><string>${project.serviceLabel}</string>`);
    expect(plist).toContain(`<key>WorkingDirectory</key><string>${project.root}</string>`);
    expect(plist).toContain("<string>server-internal-run</string>");
    expect(plist).toContain(`<string>${project.stateRoot}</string>`);
    expect(plist).toContain("<string>4488</string>");
    expect(plist).toContain("<string>/opt/codex</string>");
    expect(plist).toContain("<key>SuccessfulExit</key><false/>");
    expect(plist).toContain(`${project.stateRoot}/logs/launchd.out.log`);
    expect(plist).toContain(`${project.stateRoot}/logs/launchd.err.log`);
    expect(plist).not.toContain("supervisor");
    expect(plist).not.toContain("daemon");
    expect(plist).not.toContain("BALLET_HOME");
    expect(plist).not.toContain("BALLET_PROJECT_ROOT");
  });
});

describe("checkout service startup", () => {
  it("restarts a running service when a provider command override changes", async () => {
    const root = await gitProject();
    const project = await resolveProjectContext({ root });
    const initialState = await loadOrCreateServiceState(project);
    await updateProviderCommands(project, { codexCommand: "/opt/codex-old" });
    let activeState = initialState;
    let running = true;
    let shutdownRequests = 0;
    let stopCalls = 0;
    const installedSettings: LocalSettings[] = [];
    const launchd = {
      status: async () => ({ loaded: running, running }),
      stop: async () => { stopCalls += 1; running = false; },
      installAndStart: async (state: ServiceState, settings: LocalSettings) => {
        activeState = state;
        installedSettings.push(settings);
        running = true;
      }
    } as unknown as LaunchdService;
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        shutdownRequests += 1;
        running = false;
        return new Response(null, { status: 202 });
      }
      if (!running) throw new TypeError("service unavailable");
      return healthResponse(project, activeState);
    }) as typeof fetch;
    const service = new LocalServerService({ project, launchd, fetch: fetchImpl, startupTimeoutMs: 100 });

    const state = await service.ensureStarted({ codexCommand: "/opt/codex-new" });

    expect(state).toEqual(initialState);
    expect(shutdownRequests).toBe(1);
    expect(stopCalls).toBe(1);
    expect(installedSettings).toHaveLength(1);
    expect(installedSettings[0]?.codexCommand).toBe("/opt/codex-new");
    await expect(loadLocalSettings(project)).resolves.toMatchObject({ codexCommand: "/opt/codex-new" });
  });

  it("selects and persists a new port when another process wins the startup race", async () => {
    const root = await gitProject();
    const project = await resolveProjectContext({ root });
    const initialState = await loadOrCreateServiceState(project);
    let activeState = initialState;
    const installedPorts: number[] = [];
    let stopCalls = 0;
    const launchd = {
      status: async () => ({ loaded: false, running: false }),
      stop: async () => { stopCalls += 1; },
      installAndStart: async (state: ServiceState) => {
        activeState = state;
        installedPorts.push(state.port);
      }
    } as unknown as LaunchdService;
    const fetchImpl = (async () => {
      if (installedPorts.length === 0) throw new TypeError("service unavailable");
      if (installedPorts.length === 1) {
        return new Response(JSON.stringify({
          ok: true,
          instanceId: "another-instance",
          checkoutRoot: "/another/checkout",
          port: initialState.port,
          version: "1.2.3",
          startedAt: "2026-01-01T00:00:00.000Z"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return healthResponse(project, activeState);
    }) as typeof fetch;
    const service = new LocalServerService({ project, launchd, fetch: fetchImpl, startupTimeoutMs: 100 });

    const state = await service.ensureStarted();

    expect(installedPorts).toHaveLength(2);
    expect(installedPorts[0]).toBe(initialState.port);
    expect(installedPorts[1]).not.toBe(initialState.port);
    expect(stopCalls).toBe(1);
    expect(state.port).toBe(installedPorts[1]);
    await expect(loadServiceState(project)).resolves.toMatchObject({ port: state.port });
  });
});

const services = (cwd: string, overrides: Partial<Parameters<typeof runBalletCli>[1]> = {}): Parameters<typeof runBalletCli>[1] => ({
  server: overrides.server ?? (() => { throw new Error("server should not be used"); }),
  updater: overrides.updater ?? {} as VerifiedReleaseUpdater,
  output: overrides.output ?? { stdout: () => undefined, stderr: () => undefined },
  openUrl: overrides.openUrl ?? (async () => undefined),
  version: overrides.version ?? "1.2.3",
  cwd: () => cwd,
  stopTimeoutMs: overrides.stopTimeoutMs
});

const serviceState = (project: ProjectContext, port: number): ServiceState => ({
  version: 1,
  instanceId: project.instanceId,
  checkoutRoot: project.root,
  serviceLabel: project.serviceLabel,
  port,
  createdAt: "2026-01-01T00:00:00.000Z"
});

const healthResponse = (project: ProjectContext, state: ServiceState): Response => new Response(JSON.stringify({
  ok: true,
  instanceId: project.instanceId,
  checkoutRoot: project.root,
  port: state.port,
  version: "1.2.3",
  startedAt: "2026-01-01T00:00:00.000Z"
}), { status: 200, headers: { "Content-Type": "application/json" } });

const gitProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-project-"));
  roots.push(root);
  await execFileAsync("git", ["init", "-b", "main"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "ballet@example.test"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Ballet Test"], { cwd: root });
  await execFileAsync("git", ["commit", "--allow-empty", "-m", "Initial"], { cwd: root });
  return root;
};

const realRoot = (root: string): Promise<string> => realpath(root);
