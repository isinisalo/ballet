import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import type { ResolvedExecutionProfile } from "../../shared/domain/runtime.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import { runGit } from "../execution/git/gitProcess.js";
import { resolveProjectContext, type ProjectContext } from "../project/ProjectContext.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { LoopExecutionPlanner } from "./LoopExecutionPlanner.js";
import { LocalRunService } from "./LocalRunService.js";
import type { RootRunStore } from "./RootRunStore.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const profile: ExecutionProfile = {
  id: "test-profile",
  name: "Test profile",
  provider: "codex",
  model: "test-model",
  reasoningEffort: "medium",
  networkAccess: false
};

const configuration: ProjectConfiguration = {
  version: 9,
  executionProfiles: [profile],
  loops: [{
    id: "delivery",
    start: "work",
    nodes: [{
      id: "work",
      type: "agent",
      executionProfileId: profile.id,
      primaryInstructionId: "project:primary",
      skillIds: [],
      description: "Complete the work.",
      nodeStyle: "flat",
      nodeSize: "medium",
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }]
};

describe("LocalRunService atomic start", () => {
  it("rejects a selected instruction mutation after planning and before root creation", async () => {
    const context = await createFixture();
    const createRoot = vi.fn();
    const connection = vi.fn(() => { throw new Error("Root transaction must not start."); });
    const startLoopRun = vi.fn();
    const service = new LocalRunService({
      context,
      connection,
      database: { startLoopRun } as unknown as RuntimeDatabase,
      roots: { create: createRoot } as unknown as RootRunStore,
      executions: {} as ExecutionStore,
      runtime: runtimeStub(),
      configurations: configurationStub(),
      queue: {} as LocalExecutionQueue
    });
    const internals = service as unknown as {
      planner: LoopExecutionPlanner;
      workspaces: LocalWorkspaceManager;
    };
    const resolvedCreate = internals.planner.create.bind(internals.planner);
    const verifyPreparedSnapshot = vi.spyOn(internals.workspaces, "verifyPreparedSnapshot");
    let plannedInstruction: string | undefined;
    vi.spyOn(internals.planner, "create").mockImplementation(async (workspace, loopId, runInput) => {
      const snapshot = await resolvedCreate(workspace, loopId, runInput);
      plannedInstruction = snapshot.resources.find((resource) => resource.id === "project:primary")?.content;
      await writeFile(
        path.join(workspace.path, ".ballet", "instructions", "primary.md"),
        "---\nid: primary\ntitle: Primary\n---\nMutated after planning.\n"
      );
      return snapshot;
    });

    await expect(service.start({ kind: "loop", targetId: "delivery" })).rejects.toThrow(
      "Prepared Run configuration changed during execution snapshot resolution."
    );

    expect(plannedInstruction).toContain("Original selected instruction.");
    expect(verifyPreparedSnapshot).toHaveBeenCalledOnce();
    expect(connection).not.toHaveBeenCalled();
    expect(createRoot).not.toHaveBeenCalled();
    expect(startLoopRun).not.toHaveBeenCalled();
  });
});

const configurationStub = (): RuntimeConfigurationService => {
  const resolved: ResolvedExecutionProfile = {
    executionProfileId: profile.id,
    provider: profile.provider,
    model: profile.model,
    reasoning: profile.reasoningEffort,
    policy: { network: profile.networkAccess, readOnlyRoots: [] }
  };
  return {
    readOnlyRootsForRun: vi.fn(async () => []),
    require: vi.fn(async () => resolved)
  } as unknown as RuntimeConfigurationService;
};

const runtimeStub = (): LocalRuntimeService => ({
  preflight: vi.fn(async (resolved: ResolvedExecutionProfile) => ({
    runtime: {
      hostname: "localhost",
      provider: resolved.provider,
      cliVersion: "1",
      model: resolved.model,
      reasoning: resolved.reasoning,
      policy: resolved.policy,
      capabilityHash: "capability"
    }
  }))
} as unknown as LocalRuntimeService);

const createFixture = async (): Promise<ProjectContext> => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ballet-atomic-start-"));
  temporaryRoots.push(fixtureRoot);
  const root = path.join(fixtureRoot, "checkout");
  await mkdir(path.join(root, ".ballet", "instructions"), { recursive: true });
  await runGit(["init", "-b", "main"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "initial\n");
  await writeFile(path.join(root, ".ballet", "project.json"), `${JSON.stringify(configuration, null, 2)}\n`);
  await writeFile(
    path.join(root, ".ballet", "instructions", "primary.md"),
    "---\nid: primary\ntitle: Primary\n---\nOriginal selected instruction.\n"
  );
  await runGit(["add", "-A"], { cwd: root });
  await runGit([
    "-c", "user.name=Ballet Test", "-c", "user.email=ballet@example.test",
    "commit", "-m", "initial"
  ], { cwd: root });
  return resolveProjectContext({ root });
};
