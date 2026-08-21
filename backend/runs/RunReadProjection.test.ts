import { describe, expect, it } from "vitest";
import { jobNodeOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionTask, LoopRunDetails, NodeRun, JobRun } from "../../shared/domain/runtime.js";
import type { RootRunRepairProjection } from "../../shared/domain/runs.js";
import { testLoop } from "../tests/v13TestConfig.js";
import { currentPosition } from "./RunReadProjection.js";
import type { StoredRootRun } from "./RootRunStore.js";

const timestamp = "2026-01-01T00:00:00.000Z";

const noRepair: RootRunRepairProjection = {
  requests: [], routes: [], continuations: [], results: [], activeContinuationChain: []
};

const root = (overrides: Partial<StoredRootRun> = {}): StoredRootRun => ({
  rootRunId: "root-run", kind: "loop", targetId: "main-loop", source: "manual", status: "running",
  stateRevision: 0, worktreePath: "/workspace", branch: "run/root-run", headSha: "a".repeat(40),
  configHash: "b".repeat(64), snapshotHash: "c".repeat(64), transitionCount: 0,
  activeLoopRunId: "loop-run", activeNodeRunId: "node-run",
  executionSnapshot: {
    version: 6, rootKind: "loop", rootLoopId: "main-loop",
    project: {
      checkoutRoot: "/workspace", headSha: "a".repeat(40), configHash: "b".repeat(64),
      snapshotHash: "c".repeat(64)
    },
    orchestrator: { mode: "runbook", maxTransitions: 256 },
    issueTracker: {
      kind: "tk",
      testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration",
      workDirectory: ".tickets/work"
    },
    graph: {
      id: "test-graph", name: "Test Graph", startLoopId: "main-loop",
      transitions: [], repairEdges: []
    }, loops: [testLoop()],
    theme: defaultLoopTheme, executionProfiles: [], runtimes: [], resources: [], createdAt: timestamp
  },
  createdAt: timestamp, updatedAt: timestamp, ...overrides
});

const jobRun = (overrides: Partial<JobRun> = {}): JobRun => ({
  jobRunId: "job-run", rootRunId: "root-run", loopRunId: "loop-run",
  loopId: "main-loop", jobNodeId: "job", jobAttempt: 1, status: "running",
  stateRevisionBefore: 0, createdAt: timestamp, updatedAt: timestamp, ...overrides
});

const node = (overrides: Partial<NodeRun> = {}): NodeRun => ({
  nodeRunId: "node-run", rootRunId: "root-run", loopRunId: "loop-run",
  jobRunId: "job-run", role: "job", loopId: "main-loop",
  jobNodeId: "job", workflowNodeId: "job", nodeDefinitionId: "main-loop:job:job", status: "queued",
  attempt: 1, stateRevisionBefore: 0, createdAt: timestamp, updatedAt: timestamp, ...overrides
});

const loopRun = (
  jobRuns: JobRun[],
  nodeRuns: NodeRun[],
  status: LoopRunDetails["status"] = "running"
): LoopRunDetails => ({
  loopRunId: "loop-run", loopId: "main-loop", rootRunId: "root-run", source: "manual", status,
  snapshot: testLoop(), themeSnapshot: defaultLoopTheme, entryStateRevision: 0, nestingDepth: 0,
  createdAt: timestamp, updatedAt: timestamp, jobRuns, nodeRuns
});

const executionTask = (nodeRunId = "agent-node-run"): ExecutionTask => ({
  id: "agent-task", kind: "node_execution", rootRunId: "root-run", status: "succeeded",
  spec: {
    version: 8, taskId: "agent-task", kind: "node_execution", rootRunId: "root-run",
    loopRunId: "loop-run", jobRunId: "job-run", nodeRunId,
    evidence: {
      compositionVersion: 7, loopId: "main-loop", jobNodeId: "job", workflowNodeId: "job", nodeRole: "job",
      nodeDefinitionId: "main-loop:job:job",
      executionProfile: {
        id: "primary", name: "Primary", provider: "codex", model: "gpt-5",
        reasoningEffort: "high", networkAccess: false
      },
      resources: [], prompt: "prompt", promptSha256: "a".repeat(64),
      taskEnvelopeVersion: 6, taskEnvelopeSha256: "b".repeat(64), outputSchemaVersion: 6,
      outputSchemaId: "job-node-outcome-v6", outputSchema: jobNodeOutcomeJsonSchema,
      outputSchemaSha256: "c".repeat(64)
    },
    runtime: {
      hostname: "localhost", provider: "codex", cliVersion: "1", model: "gpt-5", reasoning: "high",
      policy: { network: false, readOnlyRoots: [] }, capabilityHash: "c".repeat(64)
    },
    project: {
      checkoutRoot: "/workspace", headSha: "d".repeat(40), configHash: "e".repeat(64), snapshotHash: "f".repeat(64)
    },
    createdAt: timestamp
  },
  createdAt: timestamp, updatedAt: timestamp
});

describe("currentPosition", () => {
  it("does not attribute a previous provider task to a current Human Node Run", () => {
    const previous = node({
      nodeRunId: "agent-node-run", executionTaskId: "agent-task", status: "completed",
      stateRevisionAfter: 0, completedAt: timestamp
    });
    const current = node({ nodeRunId: "human-node-run", role: "validation", workflowNodeId: "job-validation", nodeDefinitionId: "main-loop:job-validation:validation" });

    expect(currentPosition(
      root({ activeNodeRunId: "human-node-run" }),
      [loopRun([jobRun()], [previous, current])], [executionTask()], noRepair
    )).toMatchObject({
      loopRunId: "loop-run", loopId: "main-loop", jobRunId: "job-run",
      jobNodeId: "job", nodeRunId: "human-node-run", nodeRole: "validation",
      taskId: undefined, executionProfileId: undefined, taskStatus: undefined
    });
  });

  it("keeps a waiting provider Node Run as the current position", () => {
    const task = executionTask();
    const waiting = node({ nodeRunId: "agent-node-run", executionTaskId: task.id, status: "waiting_for_input" });

    expect(currentPosition(
      root({ activeNodeRunId: "agent-node-run", status: "waiting_for_input" }),
      [loopRun([jobRun({ status: "waiting_for_input" })], [waiting])], [task], noRepair
    )).toMatchObject({
      nodeRunId: "agent-node-run", jobNodeId: "job", taskId: "agent-task", executionProfileId: "primary"
    });
  });

  it("keeps the requester Validation identity while a Repair Request is pending", () => {
    const validation = node({
      nodeRunId: "validation-node-run", role: "validation",
      workflowNodeId: "job-validation", nodeDefinitionId: "main-loop:job-validation:validation", status: "completed",
      outcome: {
        role: "validation", state: "completed", decision: "FAIL", summary: "Repair required.",
        evidence: {}, checks: [], feedback: "Fix it.", expectedCorrection: "Correct it.",
        escalation: { reason: "Specialist required.", requestedCapability: "repair", evidenceRefs: [] }
      },
      stateRevisionAfter: 0, completedAt: timestamp
    });

    const request = {
      repairRequestId: "repair-request", rootRunId: "root-run", requesterLoopRunId: "loop-run",
      requesterJobRunId: "job-run", requesterValidationNodeRunId: "validation-node-run",
      attempt: 1, validationSummary: "Repair required.",
      requestedCapability: "repair", reason: "Specialist required.", stateRevisionAtRequest: 0,
      status: "pending" as const, returnLoopId: "main-loop", returnJobNodeId: "job",
      returnValidationNodeDefinitionId: "main-loop:job-validation:validation", nestingDepth: 0,
      createdAt: timestamp, updatedAt: timestamp
    };
    expect(currentPosition(
      root({ activeNodeRunId: undefined, status: "waiting_for_input" }),
      [loopRun([jobRun({ status: "waiting_for_input", activeNodeRunId: undefined })], [validation], "waiting_for_input")],
      [], { ...noRepair, requests: [request], pendingRepair: request }
    )).toMatchObject({
      jobRunId: "job-run", nodeRunId: "validation-node-run", nodeRole: "validation"
    });
  });
});
