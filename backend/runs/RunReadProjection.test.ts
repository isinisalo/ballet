import { describe, expect, it } from "vitest";
import { workNodeOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionTask, LoopRunDetails, NodeRun, WorkLoopNodeRun } from "../../shared/domain/runtime.js";
import { testLoop } from "../tests/v10TestConfig.js";
import { currentPosition } from "./RunReadProjection.js";

const timestamp = "2026-01-01T00:00:00.000Z";

const composite = (overrides: Partial<WorkLoopNodeRun> = {}): WorkLoopNodeRun => ({
  workLoopNodeRunId: "work-loop-node-run", rootRunId: "root-run", loopRunId: "loop-run",
  loopId: "main-loop", workLoopNodeId: "work", attempt: 1, status: "running",
  stateRevisionBefore: 0, createdAt: timestamp, updatedAt: timestamp, ...overrides
});

const node = (overrides: Partial<NodeRun> = {}): NodeRun => ({
  nodeRunId: "node-run", rootRunId: "root-run", loopRunId: "loop-run",
  workLoopNodeRunId: "work-loop-node-run", role: "work", loopId: "main-loop",
  workLoopNodeId: "work", nodeDefinitionId: "main-loop:work:work", status: "queued",
  attempt: 1, stateRevisionBefore: 0, createdAt: timestamp, updatedAt: timestamp, ...overrides
});

const loopRun = (
  workLoopNodeRuns: WorkLoopNodeRun[],
  nodeRuns: NodeRun[],
  status: LoopRunDetails["status"] = "running"
): LoopRunDetails => ({
  loopRunId: "loop-run", loopId: "main-loop", rootRunId: "root-run", source: "manual", status,
  snapshot: testLoop(), themeSnapshot: defaultLoopTheme, entryStateRevision: 0, nestingDepth: 0,
  createdAt: timestamp, updatedAt: timestamp, workLoopNodeRuns, nodeRuns
});

const executionTask = (nodeRunId = "agent-node-run"): ExecutionTask => ({
  id: "agent-task", kind: "node_execution", rootRunId: "root-run", status: "succeeded",
  spec: {
    version: 4, taskId: "agent-task", kind: "node_execution", rootRunId: "root-run",
    loopRunId: "loop-run", workLoopNodeRunId: "work-loop-node-run", nodeRunId,
    evidence: {
      compositionVersion: 3, loopId: "main-loop", workLoopNodeId: "work", nodeRole: "work",
      nodeDefinitionId: "main-loop:work:work",
      executionProfile: {
        id: "primary", name: "Primary", provider: "codex", model: "gpt-5",
        reasoningEffort: "high", networkAccess: false
      },
      resources: [], prompt: "prompt", promptSha256: "a".repeat(64),
      taskEnvelopeVersion: 2, taskEnvelopeSha256: "b".repeat(64), outputSchemaVersion: 3,
      outputSchemaId: "work-node-outcome-v3", outputSchema: workNodeOutcomeJsonSchema,
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
    const current = node({ nodeRunId: "human-node-run", role: "validation", nodeDefinitionId: "main-loop:work:validation" });

    expect(currentPosition([loopRun([composite()], [previous, current])], [executionTask()])).toEqual({
      loopRunId: "loop-run", loopId: "main-loop", workLoopNodeRunId: "work-loop-node-run",
      workLoopNodeId: "work", nodeRunId: "human-node-run", nodeRole: "validation",
      taskId: undefined, executionProfileId: undefined, taskStatus: undefined
    });
  });

  it("keeps a waiting provider Node Run as the current position", () => {
    const task = executionTask();
    const waiting = node({ nodeRunId: "agent-node-run", executionTaskId: task.id, status: "waiting_for_input" });

    expect(currentPosition([loopRun([composite({ status: "waiting_for_input" })], [waiting])], [task])).toMatchObject({
      nodeRunId: "agent-node-run", workLoopNodeId: "work", taskId: "agent-task", executionProfileId: "primary"
    });
  });

  it("keeps the requester Validation identity while a Repair Request is pending", () => {
    const validation = node({
      nodeRunId: "validation-node-run", role: "validation",
      nodeDefinitionId: "main-loop:work:validation", status: "completed",
      outcome: {
        role: "validation", state: "completed", decision: "FAIL", summary: "Repair required.",
        evidence: {}, checks: [], repair: {
          mode: "ORCHESTRATOR_REPAIR", reason: "Specialist required.",
          requestedCapability: "repair", evidenceRefs: []
        }
      },
      stateRevisionAfter: 0, completedAt: timestamp
    });

    expect(currentPosition([
      loopRun([composite({ status: "waiting_for_input", activeNodeRunId: undefined })], [validation], "waiting_for_input")
    ], [])).toMatchObject({
      workLoopNodeRunId: "work-loop-node-run", nodeRunId: "validation-node-run", nodeRole: "validation"
    });
  });
});
