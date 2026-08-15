import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes, type ProjectLoop } from "../../shared/domain/automation.js";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import type { ResolvedExecutionProfile } from "../../shared/domain/runtime.js";
import {
  composeExecutionPrompt,
  ExecutionCompositionError,
  MAX_EXECUTION_PROMPT_BYTES,
  MAX_PRIMARY_INSTRUCTION_BYTES,
  MAX_SKILL_BYTES
} from "../execution/ExecutionComposition.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import { LEGACY_AGENT_ROOTS_REMEDIATION } from "../execution/LocalSettingsRepository.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import { serializeTaskEnvelopeV1 } from "../integration/TaskEnvelopeV1.js";
import { LoopExecutionPlanner } from "./LoopExecutionPlanner.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const profile: ExecutionProfile = {
  id: "scheduled",
  name: "Scheduled work",
  provider: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
  networkAccess: false
};

const loop: ProjectLoop = {
  id: "scheduled-loop",
  start: "scheduled-start",
  nodes: [{
    id: "scheduled-start",
    type: "scheduled",
    executionProfileId: profile.id,
    primaryInstructionId: "project:scheduled-work",
    skillIds: [],
    description: "Run the scheduled work.",
    nodeStyle: "luna",
    nodeSize: "tiny",
    schedule: { kind: "once", date: "2026-07-20", time: "21:00", timeZone: "UTC" },
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
};

const configuration = (): ProjectConfiguration => ({
  version: 9,
  executionProfiles: [profile],
  loops: [structuredClone(loop)]
});

const writeProject = async (config = configuration()): Promise<PreparedRootWorkspace> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-planner-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
  await writeFile(path.join(root, ".ballet/project.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(root, ".ballet/instructions/scheduled-work.md"),
    "---\nid: scheduled-work\ntitle: Scheduled work\n---\nExecute the scheduled work safely.\n",
    "utf8"
  );
  return {
    path: root,
    branch: "ballet/run/test",
    headSha: "a".repeat(40),
    configHash: "config",
    snapshotHash: "snapshot"
  };
};

describe("LoopExecutionPlanner", () => {
  it("rejects semantic automation errors before resource or runtime resolution", async () => {
    const invalid = configuration();
    const start = invalid.loops[0]!.nodes[0]!;
    if (!("on" in start)) throw new Error("Expected an executable start Step fixture.");
    start.on.approved = "missing-target";
    const workspace = await writeProject(invalid);
    await rm(path.join(workspace.path, ".ballet/instructions/scheduled-work.md"));
    const requireProfile = vi.fn();
    const preflight = vi.fn();
    const planner = new LoopExecutionPlanner(
      { require: requireProfile } as unknown as RuntimeConfigurationService,
      { preflight } as unknown as LocalRuntimeService
    );

    await expect(planner.create(workspace, loop.id)).rejects.toThrow(
      "Project automation is invalid at loops.0.nodes.0.on.approved"
    );
    expect(requireProfile).not.toHaveBeenCalled();
    expect(preflight).not.toHaveBeenCalled();
  });

  it("fails a Human-only Run on legacy machine settings before persistence", async () => {
    const humanLoop: ProjectLoop = {
      id: "human-review",
      start: "review",
      nodes: [{
        id: "review",
        type: "human",
        description: "Review the work.",
        nodeStyle: "luna",
        nodeSize: "tiny",
        on: { approved: "completed", rejected: "blocked" }
      }, ...defaultTerminalNodes()]
    };
    const workspace = await writeProject({ version: 9, executionProfiles: [], loops: [humanLoop] });
    const readOnlyRootsForRun = vi.fn(async () => {
      throw new Error(LEGACY_AGENT_ROOTS_REMEDIATION);
    });
    const planner = new LoopExecutionPlanner(
      { readOnlyRootsForRun } as unknown as RuntimeConfigurationService,
      {} as LocalRuntimeService
    );

    await expect(planner.create(workspace, humanLoop.id)).rejects.toThrow(LEGACY_AGENT_ROOTS_REMEDIATION);
    expect(readOnlyRootsForRun).toHaveBeenCalledOnce();
  });

  it("preflights and snapshots a scheduled Step's immutable composition", async () => {
    const workspace = await writeProject();
    const resolved: ResolvedExecutionProfile = {
      executionProfileId: profile.id,
      provider: profile.provider,
      model: profile.model,
      reasoning: profile.reasoningEffort,
      policy: { network: profile.networkAccess, readOnlyRoots: ["/readonly"] }
    };
    const readOnlyRootsForRun = vi.fn(async () => ["/readonly"]);
    const requireProfile = vi.fn(async () => resolved);
    const preflight = vi.fn(async () => ({
      runtime: {
        hostname: "localhost",
        provider: profile.provider,
        cliVersion: "1",
        model: profile.model,
        reasoning: profile.reasoningEffort,
        policy: resolved.policy,
        capabilityHash: "capability"
      }
    }));
    const planner = new LoopExecutionPlanner(
      { readOnlyRootsForRun, require: requireProfile } as unknown as RuntimeConfigurationService,
      { preflight } as unknown as LocalRuntimeService
    );

    const snapshot = await planner.create(workspace, loop.id, "scheduled input");

    expect(snapshot).toMatchObject({
      version: 1,
      rootLoopId: loop.id,
      project: {
        checkoutRoot: workspace.path,
        headSha: workspace.headSha,
        configHash: workspace.configHash,
        snapshotHash: workspace.snapshotHash
      },
      executionProfiles: [profile],
      runtimes: [{ executionProfileId: profile.id, runtime: expect.objectContaining({ provider: "codex" }) }]
    });
    expect(snapshot.loops).toEqual([{
      ...loop,
      nodes: loop.nodes.filter((node) => node.id !== "failed")
    }]);
    expect(snapshot.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "primary", id: "project:scheduled-work" }),
      expect.objectContaining({ kind: "system", id: "system:execution-contract-v1" })
    ]));
    expect(snapshot.resources.every((resource) => resource.content.length > 0)).toBe(true);
    expect(readOnlyRootsForRun).toHaveBeenCalledOnce();
    expect(requireProfile).toHaveBeenCalledWith(profile, ["/readonly"]);
    expect(preflight).toHaveBeenCalledWith(resolved);
  });
});

describe("LoopExecutionPlanner prompt boundary", () => {
  it("accepts an actual initial prompt at exactly 512 KiB and rejects one additional byte", async () => {
    const boundary = configuration();
    const start = boundary.loops[0]!.nodes[0]!;
    if (start.type !== "scheduled") throw new Error("Expected the scheduled Step fixture.");
    start.skillIds = ["project:alpha", "project:beta", "project:gamma"];
    const workspace = await writeProject(boundary);
    const bodies = ["P", "A", "B", "G"];
    await writeBoundaryResources(workspace, bodies);
    const resolved: ResolvedExecutionProfile = {
      executionProfileId: profile.id,
      provider: profile.provider,
      model: profile.model,
      reasoning: profile.reasoningEffort,
      policy: { network: profile.networkAccess, readOnlyRoots: [] }
    };
    const planner = new LoopExecutionPlanner(
      {
        readOnlyRootsForRun: vi.fn(async () => []),
        require: vi.fn(async () => resolved)
      } as unknown as RuntimeConfigurationService,
      {
        preflight: vi.fn(async () => ({
          runtime: {
            hostname: "localhost",
            provider: profile.provider,
            cliVersion: "1",
            model: profile.model,
            reasoning: profile.reasoningEffort,
            policy: resolved.policy,
            capabilityHash: "capability"
          }
        }))
      } as unknown as LocalRuntimeService
    );
    const envelope = serializeTaskEnvelopeV1({
      version: 1,
      loopId: loop.id,
      stepId: start.id,
      task: start.description,
      runInput: "boundary input",
      recentSteps: []
    });
    const base = await planner.create(workspace, loop.id, "boundary input");
    let remaining = MAX_EXECUTION_PROMPT_BYTES
      - Buffer.byteLength(composeExecutionPrompt(base, loop.id, start.id, envelope).prompt, "utf8");
    const maximums = [
      MAX_PRIMARY_INSTRUCTION_BYTES,
      MAX_SKILL_BYTES,
      MAX_SKILL_BYTES,
      MAX_SKILL_BYTES
    ];
    for (const [index, maximum] of maximums.entries()) {
      const addition = Math.min(remaining, maximum - Buffer.byteLength(bodies[index]!, "utf8"));
      bodies[index] += "x".repeat(addition);
      remaining -= addition;
    }
    expect(remaining).toBe(0);
    await writeBoundaryResources(workspace, bodies);

    const exact = await planner.create(workspace, loop.id, "boundary input");
    expect(Buffer.byteLength(
      composeExecutionPrompt(exact, loop.id, start.id, envelope).prompt,
      "utf8"
    )).toBe(MAX_EXECUTION_PROMPT_BYTES);

    bodies[3] += "x";
    await writeBoundaryResources(workspace, bodies);
    const oversized = planner.create(workspace, loop.id, "boundary input");
    await expect(oversized).rejects.toBeInstanceOf(ExecutionCompositionError);
    await expect(oversized).rejects.toMatchObject({ code: "prompt_too_large" });
  });
});

const writeBoundaryResources = async (
  workspace: PreparedRootWorkspace,
  [primary, alpha, beta, gamma]: string[]
): Promise<void> => {
  if ([primary, alpha, beta, gamma].some((body) => body === undefined)) {
    throw new Error("Boundary resource bodies are incomplete.");
  }
  await writeFile(
    path.join(workspace.path, ".ballet/instructions/scheduled-work.md"),
    `---\nid: scheduled-work\ntitle: Scheduled work\n---\n${primary}`,
    "utf8"
  );
  await Promise.all([alpha, beta, gamma].map(async (body, index) => {
    const id = ["alpha", "beta", "gamma"][index]!;
    const directory = path.join(workspace.path, ".agents/skills", id);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "SKILL.md"),
      `---\nname: ${id}\ndescription: Boundary resource ${id}.\n---\n${body}`,
      "utf8"
    );
  }));
};
