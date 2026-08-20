import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import type { ResolvedExecutionProfile } from "../../shared/domain/runtime.js";
import {
  ExecutionCompositionError,
  MAX_PRIMARY_INSTRUCTION_BYTES,
  MAX_SKILL_BYTES
} from "../execution/ExecutionComposition.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { testJobPair, testLoop, type TestJobPair } from "../tests/v12TestConfig.js";
import { LoopExecutionPlanner } from "./LoopExecutionPlanner.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const profile = (id: string): ExecutionProfile => ({
  id,
  name: `Profile ${id}`,
  provider: "codex",
  model: `${id}-model`,
  reasoningEffort: "medium",
  networkAccess: id === "zeta-runtime"
});

const providerNode = (
  id: string,
  executionProfileId: string,
  primaryInstructionId: string,
  validation: "agent" | "human" = "human"
): TestJobPair => {
  const node = testJobPair(id, { validation });
  if (node.job.type !== "human") {
    node.job.executionProfileId = executionProfileId;
    node.job.primaryInstructionId = primaryInstructionId;
    node.job.skillIds = ["project:z-check", "project:a-check"];
  }
  if (node.validation.type === "agent") {
    node.validation.executionProfileId = executionProfileId;
    node.validation.primaryInstructionId = primaryInstructionId;
  }
  return node;
};

const configuration = (): ProjectConfiguration => {
  const root = testLoop("root-loop", providerNode(
    "root-work", "zeta-runtime", "project:root-work"
  ));
  root.state.initial = { zeta: true, alpha: { count: 0 } };
  const repairNode = providerNode(
    "repair-work", "alpha-runtime", "project:repair-validation", "agent"
  );
  repairNode.job = {
    id: repairNode.job.id,
    description: repairNode.job.description,
    validationNodeId: repairNode.job.validationNodeId,
    maxRetries: repairNode.job.maxRetries,
    type: "human",
    task: "Perform the requested repair.",
    nodeStyle: "terra",
    nodeSize: "medium"
  };
  const repair = testLoop("repair-loop", repairNode);
  const unused = testLoop("unused-loop", providerNode(
    "unused-work", "unused-runtime", "project:unused"
  ));
  return {
    version: 12,
    executionProfiles: [profile("zeta-runtime"), profile("unused-runtime"), profile("alpha-runtime")],
    orchestrator: {
      executionProfileId: "zeta-runtime",
      primaryInstructionId: "project:orchestrator",
      skillIds: ["project:route"],
      maxRepairDepth: 2,
      maxRepairAttempts: 3
    },
    graph: { loopEdges: [{
      id: "root-repair",
      source: "root-loop",
      target: "repair-loop",
      kind: "repair",
      capability: "test:loop.transfer",
      description: "Allow the repair Loop."
    }] },
    loops: [unused, repair, root]
  };
};

describe("LoopExecutionPlanner", () => {
  it("snapshots every reachable flow and repair composition before queuing", async () => {
    const workspace = await writeProject(configuration());
    const harness = runtimeHarness();
    const planner = new LoopExecutionPlanner(harness.configurations, harness.runtime);

    const snapshot = await planner.create(workspace, "root-loop");

    expect(snapshot).toMatchObject({
      version: 5,
      rootLoopId: "root-loop",
      project: {
        checkoutRoot: workspace.path,
        headSha: workspace.headSha,
        configHash: workspace.configHash,
        snapshotHash: workspace.snapshotHash
      }
    });
    expect(snapshot.loops.map((loop) => loop.id)).toEqual(["repair-loop", "root-loop"]);
    expect(snapshot.graph.loopEdges.map((edge) => edge.id)).toEqual(["root-repair"]);
    expect(snapshot.graph.loopEdges[0]?.capability).toBe("test:loop.transfer");
    expect(snapshot.loops.find((loop) => loop.id === "repair-loop")?.capabilities)
      .toEqual({ accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] });
    expect(snapshot.executionProfiles.map((entry) => entry.id)).toEqual([
      "alpha-runtime", "zeta-runtime"
    ]);
    expect(snapshot.runtimes.map((entry) => entry.executionProfileId)).toEqual([
      "alpha-runtime", "zeta-runtime"
    ]);
    expect(snapshot.resources.map((resource) => `${resource.kind}:${resource.id}`)).toEqual([
      "primary:project:orchestrator",
      "primary:project:repair-validation",
      "primary:project:root-work",
      "skill:project:a-check",
      "skill:project:route",
      "skill:project:z-check",
      "system:system:execution-contract-v4"
    ]);
    expect(canonicalJson(snapshot.loops.find((loop) => loop.id === "root-loop")!.state.initial))
      .toBe('{"alpha":{"count":0},"zeta":true}');
    expect(harness.requireProfile).toHaveBeenCalledTimes(2);
    expect(harness.preflight).toHaveBeenCalledTimes(2);
    expect(harness.preflight).toHaveBeenCalledWith(expect.objectContaining({
      executionProfileId: "zeta-runtime",
      model: "zeta-runtime-model",
      reasoning: "medium",
      policy: { network: true, readOnlyRoots: ["/read-only"] }
    }));
  });

  it("keeps the snapshot and workspace hashes stable after project files change", async () => {
    const config = configuration();
    const workspace = await writeProject(config);
    const harness = runtimeHarness();
    const planner = new LoopExecutionPlanner(harness.configurations, harness.runtime);
    const first = await planner.create(workspace, "root-loop");
    const second = await planner.create(workspace, "root-loop");

    expect(snapshotComparable(second)).toEqual(snapshotComparable(first));
    expect(second.project.snapshotHash).toBe(workspace.snapshotHash);
    const mutableRoot = config.loops.find((loop) => loop.id === "root-loop")!;
    mutableRoot.description = "Changed after the Root snapshot.";
    mutableRoot.state = { description: "Changed State contract.", initial: { changed: true } };
    config.graph.loopEdges[0]!.target = "unused-loop";
    config.orchestrator.primaryInstructionId = "project:changed-orchestrator";
    await writeConfiguration(workspace.path, config);
    await writeInstruction(workspace.path, "root-work", "Changed after the Root snapshot.");

    expect(first.loops.find((loop) => loop.id === "root-loop")?.description)
      .toBe("Test Loop root-loop.");
    expect(first.resources.find((resource) => resource.id === "project:root-work")?.content)
      .toBe("Perform root Job.");
    expect(first.loops.find((loop) => loop.id === "root-loop")?.state)
      .toEqual({ description: "State for root-loop.", initial: { alpha: { count: 0 }, zeta: true } });
    expect(first.graph.loopEdges[0]?.target).toBe("repair-loop");
    expect(first.orchestrator.primaryInstructionId).toBe("project:orchestrator");
    expect(first.project.snapshotHash).toBe(workspace.snapshotHash);
  });

  it("fails closed for a missing reachable profile or resource", async () => {
    const missingProfile = configuration();
    const rootJob = missingProfile.loops.find((loop) => loop.id === "root-loop")!.workflow.jobNodes[0]!;
    if (rootJob.type === "human") throw new Error("Expected a provider Job Node.");
    rootJob.executionProfileId = "missing-runtime";
    const profileWorkspace = await writeProject(missingProfile);
    const profileHarness = runtimeHarness();
    await expect(new LoopExecutionPlanner(profileHarness.configurations, profileHarness.runtime)
      .create(profileWorkspace, "root-loop"))
      .rejects.toThrow(/unknown execution profile: missing-runtime/);
    expect(profileHarness.requireProfile).not.toHaveBeenCalled();

    const missingResource = configuration();
    const resourceJob = missingResource.loops.find((loop) => loop.id === "root-loop")!.workflow.jobNodes[0]!;
    if (resourceJob.type === "human") throw new Error("Expected a provider Job Node.");
    resourceJob.primaryInstructionId = "project:missing";
    const resourceWorkspace = await writeProject(missingResource);
    const resourceHarness = runtimeHarness();
    await expect(new LoopExecutionPlanner(resourceHarness.configurations, resourceHarness.runtime)
      .create(resourceWorkspace, "root-loop"))
      .rejects.toThrow(/missing primary instruction project:missing/);
    expect(resourceHarness.requireProfile).not.toHaveBeenCalled();
  });

  it("fails before snapshot creation when provider capability preflight fails", async () => {
    const workspace = await writeProject(configuration());
    const harness = runtimeHarness("alpha-runtime");

    await expect(new LoopExecutionPlanner(harness.configurations, harness.runtime)
      .create(workspace, "root-loop"))
      .rejects.toThrow("Execution profile alpha-runtime failed preflight: selected capability is unavailable");
  });

  it("preflights the Orchestrator prompt against the exact prompt byte limit", async () => {
    const config = configuration();
    config.orchestrator.primaryInstructionId = "project:large-orchestrator";
    config.orchestrator.skillIds = ["project:large-a", "project:large-b", "project:large-c"];
    const workspace = await writeProject(config);
    await writeInstruction(workspace.path, "large-orchestrator", "x".repeat(MAX_PRIMARY_INSTRUCTION_BYTES));
    await Promise.all(["large-a", "large-b", "large-c"].map((id) =>
      writeSkill(workspace.path, id, "x".repeat(MAX_SKILL_BYTES))));
    const harness = runtimeHarness();
    const result = new LoopExecutionPlanner(harness.configurations, harness.runtime)
      .create(workspace, "root-loop");

    await expect(result).rejects.toBeInstanceOf(ExecutionCompositionError);
    await expect(result).rejects.toMatchObject({ code: "prompt_too_large" });
  });
});

const runtimeHarness = (failingProfileId?: string) => {
  const requireProfile = vi.fn(async (
    executionProfile: ExecutionProfile,
    readOnlyRoots: readonly string[]
  ): Promise<ResolvedExecutionProfile> => ({
    executionProfileId: executionProfile.id,
    provider: executionProfile.provider,
    model: executionProfile.model,
    reasoning: executionProfile.reasoningEffort,
    policy: { network: executionProfile.networkAccess, readOnlyRoots: [...readOnlyRoots] }
  }));
  const preflight = vi.fn(async (resolved: ResolvedExecutionProfile) => {
    if (resolved.executionProfileId === failingProfileId) throw new Error("selected capability is unavailable");
    return {
      runtime: {
        hostname: "localhost",
        provider: resolved.provider,
        cliVersion: "1.2.3",
        model: resolved.model,
        reasoning: resolved.reasoning,
        policy: resolved.policy,
        capabilityHash: "d".repeat(64)
      }
    };
  });
  return {
    requireProfile,
    preflight,
    configurations: {
      readOnlyRootsForRun: vi.fn(async () => ["/read-only"]),
      require: requireProfile
    } as unknown as RuntimeConfigurationService,
    runtime: { preflight } as unknown as LocalRuntimeService
  };
};

const writeProject = async (config: ProjectConfiguration): Promise<PreparedRootWorkspace> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-planner-"));
  roots.push(root);
  await writeConfiguration(root, config);
  await Promise.all([
    writeInstruction(root, "orchestrator", "Route repairs within the immutable allowlist."),
    writeInstruction(root, "root-work", "Perform root Job."),
    writeInstruction(root, "repair-validation", "Validate the repair."),
    writeSkill(root, "route", "Route only to an allowed repair Loop."),
    writeSkill(root, "a-check", "Run check A."),
    writeSkill(root, "z-check", "Run check Z.")
  ]);
  return {
    path: root,
    branch: "ballet/run/preflight",
    headSha: "a".repeat(40),
    configHash: "b".repeat(64),
    snapshotHash: "c".repeat(64)
  };
};

const writeConfiguration = async (root: string, config: ProjectConfiguration): Promise<void> => {
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await writeFile(path.join(root, ".ballet/project.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
};
const writeInstruction = async (root: string, id: string, body: string): Promise<void> => {
  const directory = path.join(root, ".ballet/instructions");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${id}.md`),
    `---\nid: ${id}\ntitle: ${id}\n---\n${body}`,
    "utf8"
  );
};
const writeSkill = async (root: string, id: string, body: string): Promise<void> => {
  const directory = path.join(root, ".agents/skills", id);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "SKILL.md"),
    `---\nname: ${id}\ndescription: Test skill ${id}.\n---\n${body}`,
    "utf8"
  );
};
const snapshotComparable = (snapshot: Awaited<ReturnType<LoopExecutionPlanner["create"]>>) => ({
  ...snapshot,
  createdAt: undefined
});
