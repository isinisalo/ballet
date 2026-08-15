import { mkdtemp, rm } from "node:fs/promises";
import type Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { JsonValue } from "../../shared/domain/automation.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { LocalDatabase } from "../storage/LocalDatabase.js";
import { testExecutionProfile, testLoop, testOrchestrator } from "../tests/v10TestConfig.js";
import { ControlFlowStore } from "./ControlFlowStore.js";
import { LoopRunStore } from "./LoopRunStore.js";
import { LoopStateStore } from "./LoopStateStore.js";
import { RepairStore } from "./RepairStore.js";

export const runtimeTestTimestamp = "2026-01-01T00:00:00.000Z";

interface RuntimeStores {
  roots: RootRunStore;
  loops: LoopRunStore;
  states: LoopStateStore;
  repairs: RepairStore;
  control: ControlFlowStore;
}

export interface RuntimeStoreTestFixture extends RuntimeStores {
  directory: string;
  filename: string;
  loop: ReturnType<typeof testLoop>;
  snapshot: RootExecutionSnapshot;
  connection(): Database.Database;
  release(): void;
  reopen(): RuntimeStores;
  close(): Promise<void>;
}

export const createRuntimeStoreFixture = async (initial: JsonValue = {}): Promise<RuntimeStoreTestFixture> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ballet-runtime-store-"));
  const filename = path.join(directory, "state.sqlite");
  let database = new LocalDatabase(filename);
  let databaseOpen = true;
  let connection = () => database.connection();
  const loop = { ...testLoop(), state: { description: "Test state.", initial } };
  const snapshot: RootExecutionSnapshot = {
    version: 3,
    rootLoopId: loop.id,
    project: {
      checkoutRoot: "/workspace", headSha: "a".repeat(40),
      configHash: "b".repeat(64), snapshotHash: "c".repeat(64)
    },
    orchestrator: testOrchestrator(),
    loops: [loop],
    loopEdges: [{ id: "self-repair", source: loop.id, target: loop.id, kind: "repair", description: "Self repair." }],
    terminals: ["completed", "blocked", "failed"],
    theme: defaultLoopTheme,
    executionProfiles: [testExecutionProfile],
    runtimes: [],
    resources: [],
    createdAt: runtimeTestTimestamp
  };
  const roots = new RootRunStore(connection);
  roots.create({
    rootRunId: "root-run", kind: "loop", targetId: loop.id, source: "manual",
    worktreePath: "/workspace/.git/ballet/worktrees/root-run", branch: "ballet/run/root-run",
    headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64),
    executionSnapshot: snapshot, createdAt: runtimeTestTimestamp
  });

  const stores = () => ({
    roots: new RootRunStore(connection),
    loops: new LoopRunStore(connection),
    states: new LoopStateStore(connection),
    repairs: new RepairStore(connection),
    control: new ControlFlowStore(connection)
  });
  return {
    directory,
    filename,
    loop,
    snapshot,
    connection,
    ...stores(),
    release: () => {
      if (databaseOpen) database.close();
      databaseOpen = false;
    },
    reopen: () => {
      if (databaseOpen) database.close();
      database = new LocalDatabase(filename);
      databaseOpen = true;
      connection = () => database.connection();
      return stores();
    },
    close: async () => {
      if (databaseOpen) database.close();
      await rm(directory, { recursive: true, force: true });
    }
  };
};
