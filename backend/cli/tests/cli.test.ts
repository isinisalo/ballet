import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { deriveProjectId, runBalletCli } from "../BalletCli.js";
import type { SecretStore } from "../Keychain.js";
import { renderPlist, type LaunchdService } from "../LaunchdService.js";
import { RotatingTextLog, superviseLaunchdProcess } from "../LaunchdLogSupervisor.js";
import { renderServerPlist, type LocalServerConfiguration, type LocalServerService } from "../LocalServerService.js";
import { PairingClient, type PairingDeviceFacts, type PairingSession } from "../PairingClient.js";
import type { VerifiedReleaseUpdater } from "../VerifiedReleaseUpdater.js";
import { DaemonConfigStore } from "../../daemon/config/DaemonConfigStore.js";

const execFileAsync = promisify(execFile);
const controlToken = "local-control-token-that-is-long-enough";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

class MemorySecrets implements SecretStore {
  readonly values = new Map<string, string>();
  async set(account: string, secret: string) { this.values.set(account, secret); }
  async get(account: string) { return this.values.get(account) ?? ""; }
  async delete(account: string) { this.values.delete(account); }
}

const gitProject = async (repositoryUrl = "https://github.com/acme/studio.git") => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-project-"));
  roots.push(root);
  await execFileAsync("git", ["init", "-b", "main"], { cwd: root });
  await execFileAsync("git", ["remote", "add", "origin", repositoryUrl], { cwd: root });
  return root;
};

describe("Ballet CLI", () => {
  it("pairs once, stores the daemon token only in the secret store, and writes non-secret config", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-"));
    roots.push(home);
    const config = new DaemonConfigStore(home);
    const projectRoot = await gitProject();
    const secrets = new MemorySecrets();
    const output: string[] = [];
    const opened: string[] = [];
    let createdFacts: PairingDeviceFacts | undefined;
    const session: PairingSession = {
      pairingId: "pairing-1",
      deviceCode: "d".repeat(40),
      userCode: "ABC-123",
      verificationUri: "https://ballet.example.test/pair/1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      intervalSeconds: 1
    };
    const pairing = {
      create: async (facts: PairingDeviceFacts) => { createdFacts = facts; return session; },
      pollUntilApproved: async () => ({ deviceId: "10000000-0000-4000-8000-000000000001", daemonToken: "server-minted-daemon-token-that-is-long-enough" })
    } as unknown as PairingClient;

    const code = await runBalletCli([
      "setup", "--server", "https://ballet.example.test", "--name", "Studio Mac", "--no-start"
    ], {
      config,
      secrets,
      pairing: () => pairing,
      launchd: () => ({ installAndStart: async () => { throw new Error("must not start"); } }) as unknown as LaunchdService,
      localServer: { ensureStarted: async () => { throw new Error("must not start a local server"); } } as unknown as LocalServerService,
      updater: { update: async () => "updated" } as VerifiedReleaseUpdater,
      output: { stdout: (message) => output.push(message), stderr: (message) => output.push(message) },
      openUrl: async (url) => { opened.push(url); },
      version: "1.2.3",
      cwd: () => projectRoot,
      localControlToken: controlToken
    });

    expect(code).toBe(0);
    expect(createdFacts).toMatchObject({ displayName: "Studio Mac", daemonVersion: "1.2.3", platform: "darwin" });
    expect(opened).toEqual([session.verificationUri]);
    const saved = await config.load();
    expect(saved.deviceId).toBe("10000000-0000-4000-8000-000000000001");
    expect(saved.backends.map((backend) => backend.provider)).toEqual(["codex", "copilot"]);
    expect(secrets.values.size).toBe(1);
    expect(await readFile(config.path, "utf8")).not.toContain("server-minted-daemon-token-that-is-long-enough");
  });

  it("uses an existing device code, local defaults, and a stable project id for --repo setup", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-device-code-"));
    roots.push(home);
    const config = new DaemonConfigStore(home);
    const secrets = new MemorySecrets();
    const repositoryUrl = "https://github.com/acme/studio.git";
    const projectRoot = await gitProject(repositoryUrl);
    const deviceCode = "d".repeat(40);
    let pairingServer = "";
    let polledCode = "";
    let createCalled = false;
    let localServerConfig: LocalServerConfiguration | undefined;
    const pairing = {
      create: async () => { createCalled = true; throw new Error("must not create a pairing session"); },
      pollDeviceCode: async (code: string) => {
        polledCode = code;
        return { deviceId: "10000000-0000-4000-8000-000000000011", daemonToken: "server-minted-daemon-token-that-is-long-enough" };
      }
    } as unknown as PairingClient;
    const code = await runBalletCli([
      "setup", "--repo", repositoryUrl, "--device-code", deviceCode, "--no-start"
    ], {
      config,
      secrets,
      pairing: (serverUrl) => { pairingServer = serverUrl; return pairing; },
      launchd: () => ({ installAndStart: async () => undefined }) as unknown as LaunchdService,
      localServer: { ensureStarted: async (value: LocalServerConfiguration) => { localServerConfig = value; } } as LocalServerService,
      updater: { update: async () => "updated" } as VerifiedReleaseUpdater,
      output: { stdout: () => undefined, stderr: () => undefined },
      openUrl: async () => { throw new Error("must not open a new pairing session"); },
      version: "1.2.3",
      cwd: () => projectRoot,
      localControlToken: controlToken
    });

    const projectId = deriveProjectId(repositoryUrl);
    const resolvedProjectRoot = await realpath(projectRoot);
    expect(code).toBe(0);
    expect(pairingServer).toBe("http://127.0.0.1:4317");
    expect(polledCode).toBe(deviceCode);
    expect(createCalled).toBe(false);
    expect(localServerConfig).toEqual({
      serverUrl: "http://127.0.0.1:4317",
      projectId,
      repositoryUrl,
      repositoryPath: resolvedProjectRoot,
      localControlToken: controlToken
    });
    expect(deriveProjectId(repositoryUrl)).toBe(deriveProjectId(repositoryUrl));
    expect(await config.load()).toMatchObject({
      serverUrl: "http://127.0.0.1:4317",
      appUrl: "http://127.0.0.1:4317",
      projectId,
      repositoryUrl
    });
  });
});

describe("Ballet CLI local lifecycle", () => {
  it("fails closed when --device-code has no value", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-missing-device-code-"));
    roots.push(home);
    const output: string[] = [];

    const code = await runBalletCli(["setup", "--device-code", "--no-start"], {
      config: new DaemonConfigStore(home),
      secrets: new MemorySecrets(),
      pairing: () => { throw new Error("pairing must not start"); },
      launchd: () => ({ installAndStart: async () => undefined }) as unknown as LaunchdService,
      localServer: { ensureStarted: async () => { throw new Error("must not start a local server"); } } as unknown as LocalServerService,
      updater: { update: async () => "updated" } as VerifiedReleaseUpdater,
      output: { stdout: () => undefined, stderr: (message) => output.push(message) },
      openUrl: async () => undefined,
      version: "1.2.3",
      localControlToken: controlToken
    });

    expect(code).toBe(1);
    expect(output).toEqual(["--device-code requires the device code returned by an existing pairing session."]);
  });

  it("starts the current GitHub project with the bare ballet command", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-open-"));
    roots.push(home);
    const config = new DaemonConfigStore(home);
    const repositoryPath = await gitProject();
    const projectId = deriveProjectId("https://github.com/acme/studio.git");
    await config.save({
      version: 1,
      serverUrl: "http://127.0.0.1:4317",
      appUrl: "http://127.0.0.1:4317",
      deviceId: "10000000-0000-4000-8000-000000000021",
      daemonId: "10000000-0000-4000-8000-000000000022",
      displayName: "Studio Mac",
      daemonVersion: "1.2.3",
      backends: [
        { id: "10000000-0000-4000-8000-000000000023", provider: "codex", command: "codex" },
        { id: "10000000-0000-4000-8000-000000000024", provider: "copilot", command: "copilot" }
      ],
      projectId,
      repositoryUrl: "https://github.com/acme/studio.git",
      repositoryPath
    });
    let ensured: LocalServerConfiguration | undefined;
    let opened = "";

    const code = await runBalletCli([], {
      config,
      secrets: new MemorySecrets(),
      pairing: () => { throw new Error("pairing must not start"); },
      launchd: () => ({ installAndStart: async () => undefined }) as unknown as LaunchdService,
      localServer: {
        activeProject: async () => undefined,
        ensureStarted: async (value: LocalServerConfiguration) => { ensured = value; }
      } as unknown as LocalServerService,
      updater: {} as VerifiedReleaseUpdater,
      output: { stdout: () => undefined, stderr: () => undefined },
      openUrl: async (url) => { opened = url; },
      version: "1.2.3",
      cwd: () => repositoryPath,
      localControlToken: controlToken
    });

    expect(code).toBe(0);
    const resolvedRepositoryPath = await realpath(repositoryPath);
    expect(ensured).toEqual({
      serverUrl: "http://127.0.0.1:4317",
      projectId,
      repositoryUrl: "https://github.com/acme/studio.git",
      repositoryPath: resolvedRepositoryPath,
      localControlToken: controlToken
    });
    expect(opened).toBe("http://127.0.0.1:4317");
  });

  it("opens Runtimes for pairing when the current project has not been paired", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-unpaired-"));
    roots.push(home);
    const repositoryPath = await gitProject();
    let opened = "";
    let ensured = false;

    const code = await runBalletCli([], {
      config: new DaemonConfigStore(home),
      secrets: new MemorySecrets(),
      pairing: () => { throw new Error("pairing must not start in the CLI"); },
      launchd: () => ({ installAndStart: async () => { throw new Error("unpaired daemon must not start"); } }) as unknown as LaunchdService,
      localServer: {
        activeProject: async () => undefined,
        ensureStarted: async () => { ensured = true; }
      } as unknown as LocalServerService,
      updater: {} as VerifiedReleaseUpdater,
      output: { stdout: () => undefined, stderr: () => undefined },
      openUrl: async (url) => { opened = url; },
      version: "1.2.3",
      cwd: () => repositoryPath,
      localControlToken: controlToken
    });

    expect(code).toBe(0);
    expect(ensured).toBe(true);
    expect(opened).toBe("http://127.0.0.1:4317/runtimes?connect=1");
  });

  it("only opens the browser when the same project is already running", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-running-same-"));
    roots.push(home);
    const repositoryPath = await gitProject();
    const projectId = deriveProjectId("https://github.com/acme/studio.git");
    let opened = "";

    const code = await runBalletCli([], {
      config: new DaemonConfigStore(home),
      secrets: new MemorySecrets(),
      pairing: () => { throw new Error("pairing must not start"); },
      launchd: () => ({ installAndStart: async () => { throw new Error("daemon must not restart"); } }) as unknown as LaunchdService,
      localServer: {
        activeProject: async () => ({ projectId }),
        ensureStarted: async () => { throw new Error("server must not restart"); }
      } as unknown as LocalServerService,
      updater: {} as VerifiedReleaseUpdater,
      output: { stdout: () => undefined, stderr: () => undefined },
      openUrl: async (url) => { opened = url; },
      version: "1.2.3",
      cwd: () => repositoryPath,
      localControlToken: controlToken
    });

    expect(code).toBe(0);
    expect(opened).toBe("http://127.0.0.1:4317");
  });

  it("requires ballet stop before switching the running project", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ballet-cli-running-other-"));
    roots.push(home);
    const repositoryPath = await gitProject();
    const errors: string[] = [];

    const code = await runBalletCli([], {
      config: new DaemonConfigStore(home),
      secrets: new MemorySecrets(),
      pairing: () => { throw new Error("pairing must not start"); },
      launchd: () => ({ installAndStart: async () => { throw new Error("daemon must not restart"); } }) as unknown as LaunchdService,
      localServer: {
        activeProject: async () => ({ projectId: "another-project" }),
        ensureStarted: async () => { throw new Error("server must not restart"); }
      } as unknown as LocalServerService,
      updater: {} as VerifiedReleaseUpdater,
      output: { stdout: () => undefined, stderr: (message) => errors.push(message) },
      openUrl: async () => { throw new Error("browser must not open"); },
      version: "1.2.3",
      cwd: () => repositoryPath,
      localControlToken: controlToken
    });

    expect(code).toBe(1);
    expect(errors).toEqual(["Ballet is already running for project another-project. Run `ballet stop` before switching projects."]);
  });

  it("cancels active work before stopping the daemon and local server", async () => {
    const calls: string[] = [];
    const code = await runBalletCli(["stop"], {
      config: new DaemonConfigStore(await gitProject()),
      secrets: new MemorySecrets(),
      pairing: () => { throw new Error("pairing must not start"); },
      launchd: () => ({ stop: async () => { calls.push("daemon-stop"); } }) as unknown as LaunchdService,
      localServer: {
        activeProject: async () => ({ projectId: "project-1" }),
        cancelAllRuns: async () => { calls.push("cancel"); return { activeRuns: 0, pendingFinalizations: 0, idle: true }; },
        stop: async () => { calls.push("server-stop"); }
      } as unknown as LocalServerService,
      updater: {} as VerifiedReleaseUpdater,
      output: { stdout: (message) => calls.push(message), stderr: () => undefined },
      openUrl: async () => undefined,
      version: "1.2.3",
      localControlToken: controlToken
    });

    expect(code).toBe(0);
    expect(calls).toEqual(["cancel", "daemon-stop", "server-stop", "Ballet stopped."]);
  });

  it("leaves services running when cancellation does not settle before timeout", async () => {
    const stopped: string[] = [];
    const errors: string[] = [];
    const code = await runBalletCli(["stop"], {
      config: new DaemonConfigStore(await gitProject()),
      secrets: new MemorySecrets(),
      pairing: () => { throw new Error("pairing must not start"); },
      launchd: () => ({ stop: async () => { stopped.push("daemon"); } }) as unknown as LaunchdService,
      localServer: {
        activeProject: async () => ({ projectId: "project-1" }),
        cancelAllRuns: async () => ({ activeRuns: 1, pendingFinalizations: 0, idle: false }),
        stop: async () => { stopped.push("server"); }
      } as unknown as LocalServerService,
      updater: {} as VerifiedReleaseUpdater,
      output: { stdout: () => undefined, stderr: (message) => errors.push(message) },
      openUrl: async () => undefined,
      version: "1.2.3",
      localControlToken: controlToken,
      stopTimeoutMs: 0
    });

    expect(code).toBe(1);
    expect(stopped).toEqual([]);
    expect(errors[0]).toContain("services were left running");
  });
});

describe("PairingClient", () => {
  it("uses the server-minted one-time token flow without sending a client token", async () => {
    const bodies: Record<string, unknown>[] = [];
    const responses = [
      Response.json({
        pairingId: "pairing-1",
        deviceCode: "d".repeat(40),
        userCode: "ABC-123",
        verificationUri: "https://ballet.example.test/pair/1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        intervalSeconds: 1
      }),
      Response.json({ status: "claimed", deviceId: "device-1", daemonToken: "server-minted-token-that-is-long-enough" })
    ];
    const fetchImpl: typeof fetch = async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return responses.shift()!;
    };
    const facts: PairingDeviceFacts = {
      hostname: "studio.local",
      displayName: "Studio Mac",
      platform: "darwin",
      architecture: "arm64",
      daemonVersion: "1.2.3",
      daemonId: "10000000-0000-4000-8000-000000000009"
    };
    const client = new PairingClient("https://ballet.example.test", fetchImpl);
    const session = await client.create(facts);
    const claim = await client.pollUntilApproved(session, facts);

    expect(claim).toEqual({ deviceId: "device-1", daemonToken: "server-minted-token-that-is-long-enough" });
    expect(bodies[0]).toEqual({ displayName: "Studio Mac" });
    expect(bodies[0]).not.toHaveProperty("daemonToken");
    expect(bodies[1]).toMatchObject({ deviceCode: "d".repeat(40), daemonId: facts.daemonId });
  });
});

describe("launchd logging", () => {
  it("routes daemon stdout and stderr through the rotating supervisor", () => {
    const plist = renderPlist({
      balletHome: "/Users/test/.ballet",
      logDirectory: "/Users/test/Library/Logs/Ballet",
      programArguments: ["/usr/local/bin/ballet", "daemon-internal-run"]
    });

    expect(plist).toContain("<key>BALLET_LOG_DIR</key><string>/Users/test/Library/Logs/Ballet</string>");
    expect(plist).toContain("<string>launchd-log-supervisor-internal-run</string>");
    expect(plist).toContain("<string>daemon</string>");
    expect(plist).toContain("<key>StandardOutPath</key><string>/dev/null</string>");
    expect(plist).toContain("<key>StandardErrorPath</key><string>/dev/null</string>");
  });

  it("renders the project-bound local web server service on port 4317", () => {
    const plist = renderServerPlist({
      balletHome: "/Users/test/.ballet",
      logDirectory: "/Users/test/Library/Logs/Ballet",
      programArguments: ["/usr/local/bin/ballet", "server-internal-run"]
    }, {
      serverUrl: "http://127.0.0.1:4317",
      projectId: "project-1",
      repositoryUrl: "https://github.com/acme/studio.git",
      repositoryPath: "/Users/test/git/studio",
      localControlToken: controlToken
    });

    expect(plist).toContain("<key>PORT</key><string>4317</string>");
    expect(plist).toContain("<key>BALLET_PROJECT_ID</key><string>project-1</string>");
    expect(plist).toContain("<key>WorkingDirectory</key><string>/Users/test/git/studio</string>");
    expect(plist).toContain(`<key>BALLET_LOCAL_CONTROL_TOKEN</key><string>${controlToken}</string>`);
    expect(plist).toContain("<string>launchd-log-supervisor-internal-run</string>");
    expect(plist).toContain("<string>server</string>");
    expect(plist).toContain("<key>StandardOutPath</key><string>/dev/null</string>");
    expect(plist).toContain("<key>StandardErrorPath</key><string>/dev/null</string>");
  });

  it("rotates captured output with bounded generations", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-launchd-rotation-"));
    roots.push(root);
    const target = path.join(root, "server.log");
    const log = new RotatingTextLog({ path: target, maxBytes: 10, backups: 2 });

    await log.write("first!\n");
    await log.write("second\n");
    await log.write("third!\n");

    expect(await readFile(target, "utf8")).toBe("third!\n");
    expect(await readFile(`${target}.1`, "utf8")).toBe("second\n");
    expect(await readFile(`${target}.2`, "utf8")).toBe("first!\n");
  });

  it("captures child stdout and stderr without launchd-owned log descriptors", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-launchd-supervisor-"));
    roots.push(root);
    const entrypoint = path.join(root, "child.mjs");
    const stdoutPath = path.join(root, "stdout.log");
    const stderrPath = path.join(root, "stderr.log");
    await writeFile(entrypoint, 'process.stdout.write("ready\\n"); process.stderr.write("diagnostic\\n");\n');

    const exitCode = await superviseLaunchdProcess({
      entrypoint,
      childArguments: [],
      stdoutPath,
      stderrPath
    });

    expect(exitCode).toBe(0);
    expect(await readFile(stdoutPath, "utf8")).toBe("ready\n");
    expect(await readFile(stderrPath, "utf8")).toBe("diagnostic\n");
  });
});
