import Database from "better-sqlite3";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalServerService } from "./LocalServerService.js";
import type { LaunchdService } from "./LaunchdService.js";
import type { ProjectContext } from "../project/ProjectContext.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalServerService database preflight", () => {
  it("reports an incompatible checkout database before launchd startup and leaves it unchanged", async () => {
    const project = await projectWithSchema(3);
    let installCalls = 0;
    const launchd = {
      status: async () => ({ loaded: false, running: false }),
      stop: async () => undefined,
      installAndStart: async () => { installCalls += 1; }
    } as unknown as LaunchdService;
    const service = new LocalServerService({ project, launchd, startupTimeoutMs: 10 });

    await expect(service.ensureStarted()).rejects.toThrow(
      "Unsupported Ballet state schema 3; expected 6."
    );
    expect(installCalls).toBe(0);
    expect(await readFile(project.databasePath)).toEqual(expect.any(Buffer));

    const persisted = new Database(project.databasePath, { readonly: true });
    expect(persisted.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("3");
    persisted.close();
  });
});

const projectWithSchema = async (version: number): Promise<ProjectContext> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-db-preflight-"));
  temporaryRoots.push(root);
  const gitDir = path.join(root, ".git");
  const stateRoot = path.join(gitDir, "ballet");
  await mkdir(stateRoot, { recursive: true });
  const databasePath = path.join(stateRoot, "state.sqlite");
  const database = new Database(databasePath);
  database.exec(`
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO metadata (key, value) VALUES ('schema_version', '${version}');
  `);
  database.close();
  return {
    root,
    gitDir,
    stateRoot,
    databasePath,
    settingsPath: path.join(stateRoot, "settings.json"),
    worktreesRoot: path.join(stateRoot, "worktrees"),
    logsPath: path.join(stateRoot, "logs", "ballet.log"),
    headSha: "a".repeat(40),
    instanceId: "00000000-0000-4000-8000-000000000001",
    serviceLabel: "ai.ballet.database-preflight"
  };
};
