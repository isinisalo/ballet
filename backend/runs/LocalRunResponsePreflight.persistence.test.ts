import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultTerminalNodes,
  type ProjectAgentStep,
  type ProjectLoop
} from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import type {
  ExecutionResourceSnapshot,
  RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import {
  composeExecutionPrompt,
  MAX_EXECUTION_PROMPT_BYTES,
  MAX_PRIMARY_INSTRUCTION_BYTES,
  MAX_SKILL_BYTES,
  systemExecutionResourceSnapshot
} from "../execution/ExecutionComposition.js";
import { ExecutionCompositionError } from "../execution/ExecutionCompositionError.js";
import { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import { serializeTaskEnvelopeV1 } from "../integration/TaskEnvelopeV1.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { LocalRunService } from "./LocalRunService.js";
import { RootRunStore } from "./RootRunStore.js";

const temporaryRoots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalRunService response prompt preflight", () => {
  it("rolls a needs_input resume back when its exact prospective prompt exceeds 512 KiB", async () => {
    const work = agentStep("work");
    const loop: ProjectLoop = {
      id: "resume-loop",
      start: work.id,
      nodes: [work, ...defaultTerminalNodes()]
    };
    const fixture = await createFixture(exactBoundarySnapshot(loop, work));
    const root = fixture.createRoot();
    const started = fixture.database.startLoopRun(root.rootRunId);
    const stepRunId = started.stepRuns[0]!.stepRunId;
    fixture.database.completeExecutionStep({
      stepRunId,
      outcome: {
        state: "needs_input",
        question: "Which database should be used?",
        context: "The same Step must continue after the answer.",
        summary: "Database choice is required.",
        checks: []
      }
    });
    fixture.roots.setStatus(root.rootRunId, "waiting_for_human");
    const before = persistedWaitingState(fixture.database, root.rootRunId);

    await expect(fixture.service.respond(root.rootRunId, stepRunId, {
      kind: "resume",
      input: "SQLite"
    })).rejects.toMatchObject({
      name: "ExecutionCompositionError",
      code: "prompt_too_large"
    });

    expect(persistedWaitingState(fixture.database, root.rootRunId)).toEqual(before);
    expect(fixture.database.getStepRun(stepRunId)).toMatchObject({
      status: "needs_input",
      responseInput: undefined,
      outcome: { state: "needs_input" }
    });
    expect(fixture.executions.listByRoot(root.rootRunId)).toEqual([]);
    expect(fixture.wake).not.toHaveBeenCalled();
  });

  it("rolls a Human response and its transition back when the next exact prompt exceeds 512 KiB", async () => {
    const work = agentStep("work");
    const loop: ProjectLoop = {
      id: "human-loop",
      start: "review",
      nodes: [{
        id: "review",
        type: "human",
        description: "Review the work.",
        nodeStyle: "luna",
        nodeSize: "tiny",
        on: { approved: work.id, rejected: "blocked" }
      }, work, ...defaultTerminalNodes()]
    };
    const fixture = await createFixture(exactBoundarySnapshot(loop, work));
    const root = fixture.createRoot();
    const started = fixture.database.startLoopRun(root.rootRunId);
    const stepRunId = started.stepRuns[0]!.stepRunId;
    fixture.roots.setStatus(root.rootRunId, "waiting_for_human");
    const before = persistedWaitingState(fixture.database, root.rootRunId);

    await expect(fixture.service.respond(root.rootRunId, stepRunId, {
      kind: "human",
      result: "approved",
      input: "Approved"
    })).rejects.toBeInstanceOf(ExecutionCompositionError);

    expect(persistedWaitingState(fixture.database, root.rootRunId)).toEqual(before);
    expect(fixture.database.listRootLoopRuns(root.rootRunId)[0]).toMatchObject({
      status: "waiting_for_human",
      transitionCount: 0,
      stepRuns: [{
        stepRunId,
        status: "waiting_for_human",
        responseInput: undefined,
        result: undefined
      }]
    });
    expect(fixture.executions.listByRoot(root.rootRunId)).toEqual([]);
    expect(fixture.wake).not.toHaveBeenCalled();
  });
});

const profile: ExecutionProfile = {
  id: "codex-test-high",
  name: "Codex test · High",
  provider: "codex",
  model: "gpt-5.6-luna",
  reasoningEffort: "high",
  networkAccess: false
};

const agentStep = (id: string): ProjectAgentStep => ({
  id,
  type: "agent",
  executionProfileId: profile.id,
  primaryInstructionId: "project:primary",
  skillIds: ["project:alpha", "project:beta", "project:gamma"],
  description: `Execute ${id}.`,
  nodeStyle: "flat",
  nodeSize: "medium",
  on: { approved: "completed", rejected: "blocked" }
});

const exactBoundarySnapshot = (loop: ProjectLoop, step: ProjectAgentStep): RootExecutionSnapshot => {
  const projectResources: ExecutionResourceSnapshot[] = [{
    kind: "primary",
    origin: "project",
    id: "project:primary",
    relativePath: ".ballet/instructions/primary.md",
    sourceSha256: sha256("P"),
    content: "P"
  }, ...["alpha", "beta", "gamma"].map((id): ExecutionResourceSnapshot => ({
    kind: "skill",
    origin: "project",
    id: `project:${id}`,
    relativePath: `.agents/skills/${id}/SKILL.md`,
    sourceSha256: sha256(id),
    content: id[0]!.toUpperCase()
  }))];
  const snapshot = snapshotWithResources(loop, projectResources);
  const envelope = serializeTaskEnvelopeV1({
    version: 1,
    loopId: loop.id,
    stepId: step.id,
    task: step.description,
    runInput: "",
    recentSteps: []
  });
  const base = composeExecutionPrompt(snapshot, loop.id, step.id, envelope);
  let remaining = MAX_EXECUTION_PROMPT_BYTES - Buffer.byteLength(base.prompt, "utf8");
  const filled = projectResources.map((resource) => {
    const maximum = resource.kind === "primary" ? MAX_PRIMARY_INSTRUCTION_BYTES : MAX_SKILL_BYTES;
    const addition = Math.min(remaining, maximum - Buffer.byteLength(resource.content, "utf8"));
    remaining -= addition;
    const content = `${resource.content}${"x".repeat(addition)}`;
    return { ...resource, content, sourceSha256: sha256(content) };
  });
  if (remaining !== 0) throw new Error("Test resources cannot fill the exact prompt boundary.");
  const exact = snapshotWithResources(loop, filled);
  const evidence = composeExecutionPrompt(exact, loop.id, step.id, envelope);
  if (Buffer.byteLength(evidence.prompt, "utf8") !== MAX_EXECUTION_PROMPT_BYTES) {
    throw new Error("Test snapshot did not reach the exact prompt boundary.");
  }
  return exact;
};

const snapshotWithResources = (
  loop: ProjectLoop,
  resources: ExecutionResourceSnapshot[]
): RootExecutionSnapshot => ({
  version: 1,
  rootLoopId: loop.id,
  project: {
    checkoutRoot: "/tmp/project",
    headSha: "a".repeat(40),
    configHash: "config",
    snapshotHash: "snapshot"
  },
  loops: [loop],
  theme: defaultLoopTheme,
  executionProfiles: [profile],
  runtimes: [{
    executionProfileId: profile.id,
    runtime: {
      hostname: "localhost",
      provider: profile.provider,
      cliVersion: "1",
      model: profile.model,
      reasoning: profile.reasoningEffort,
      policy: { network: profile.networkAccess, readOnlyRoots: [] },
      capabilityHash: "capability"
    }
  }],
  resources: [systemExecutionResourceSnapshot(), ...resources],
  createdAt: "2026-07-19T00:00:00.000Z"
});

const createFixture = async (snapshot: RootExecutionSnapshot) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-response-preflight-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "worktrees"));
  const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
  databases.push(database);
  const connection = () => database.connection();
  const roots = new RootRunStore(connection);
  const executions = new ExecutionStore(connection);
  const wake = vi.fn();
  const service = new LocalRunService({
    context: { root, worktreesRoot: path.join(root, "worktrees") } as ProjectContext,
    connection,
    database,
    roots,
    executions,
    runtime: {} as LocalRuntimeService,
    configurations: {} as RuntimeConfigurationService,
    queue: { wake, interrupt: vi.fn() } as unknown as LocalExecutionQueue
  });
  return {
    database,
    roots,
    executions,
    service,
    wake,
    createRoot: () => roots.create({
      rootRunId: randomUUID(),
      kind: "loop",
      targetId: snapshot.rootLoopId,
      source: "manual",
      worktreePath: path.join(root, "worktrees", randomUUID()),
      branch: `ballet/run/${randomUUID()}`,
      headSha: snapshot.project.headSha,
      configHash: snapshot.project.configHash,
      snapshotHash: snapshot.project.snapshotHash,
      executionSnapshot: snapshot,
      createdAt: new Date().toISOString()
    })
  };
};

const persistedWaitingState = (database: RuntimeDatabase, rootRunId: string) => ({
  root: database.connection().prepare("SELECT * FROM root_runs WHERE root_run_id = ?").get(rootRunId),
  loops: database.connection().prepare("SELECT * FROM loop_runs WHERE root_run_id = ? ORDER BY rowid").all(rootRunId),
  steps: database.connection().prepare(`
    SELECT * FROM step_runs WHERE run_id IN (
      SELECT run_id FROM loop_runs WHERE root_run_id = ?
    ) ORDER BY rowid
  `).all(rootRunId)
});

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
