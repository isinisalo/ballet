import { describe, expect, it } from "vitest";
import type { ExecutionTask, LoopRunDetails, StepRun } from "../../shared/domain/runtime.js";
import { currentPosition } from "./RunReadProjection.js";

const stepRun = (overrides: Partial<StepRun>): StepRun => ({
  stepRunId: "step-run",
  runId: "loop-run",
  loopId: "delivery",
  stepId: "gate",
  type: "human",
  status: "waiting_for_human",
  attempt: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const loopRun = (stepRuns: StepRun[], status: LoopRunDetails["status"] = "waiting_for_human"): LoopRunDetails => ({
  runId: "loop-run",
  loopId: "delivery",
  rootRunId: "root-run",
  source: "manual",
  status,
  snapshot: {} as LoopRunDetails["snapshot"],
  themeSnapshot: {} as LoopRunDetails["themeSnapshot"],
  transitionCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  stepRuns
});

const executionTask = (id = "agent-task"): ExecutionTask => ({
  id,
  kind: "loop_step",
  rootRunId: "root-run",
  status: "succeeded",
  spec: {
    version: 2,
    taskId: id,
    kind: "loop_step",
    rootRunId: "root-run",
    loopRunId: "loop-run",
    stepRunId: "agent-step-run",
    evidence: {
      compositionVersion: 1,
      loopId: "delivery",
      stepId: "agent",
      executionProfile: {
        id: "primary",
        name: "Primary",
        provider: "codex",
        model: "gpt-5",
        reasoningEffort: "high",
        networkAccess: false
      },
      resources: [],
      prompt: "prompt",
      promptSha256: "prompt-hash",
      outputSchemaVersion: 1,
      outputSchemaSha256: "schema-hash"
    },
    runtime: {} as ExecutionTask["spec"]["runtime"],
    project: {} as ExecutionTask["spec"]["project"],
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

describe("currentPosition", () => {
  it("does not attribute the previous Agent task to a current Human Step", () => {
    const previousAgent = stepRun({
      stepRunId: "agent-step-run",
      stepId: "agent",
      type: "agent",
      executionTaskId: "agent-task",
      status: "completed",
      result: "approved"
    });
    const currentHuman = stepRun({ stepRunId: "human-step-run", stepId: "human" });

    expect(currentPosition([loopRun([previousAgent, currentHuman])], [executionTask()])).toEqual({
      loopRunId: "loop-run",
      loopId: "delivery",
      stepRunId: "human-step-run",
      stepId: "human",
      taskId: undefined,
      executionProfileId: undefined,
      taskStatus: undefined
    });
  });

  it("keeps a needs_input Agent Step as the current position", () => {
    const task = executionTask();
    const waitingAgent = stepRun({
      stepRunId: "agent-step-run",
      stepId: "agent",
      type: "agent",
      executionTaskId: task.id,
      status: "needs_input"
    });

    expect(currentPosition([loopRun([waitingAgent])], [task])).toMatchObject({
      stepRunId: "agent-step-run",
      stepId: "agent",
      taskId: "agent-task",
      executionProfileId: "primary"
    });
  });

  it("uses the latest task only when projecting a terminal Run", () => {
    const task = executionTask();
    const completedAgent = stepRun({
      stepRunId: "agent-step-run",
      stepId: "agent",
      type: "agent",
      executionTaskId: task.id,
      status: "completed",
      result: "approved"
    });

    expect(currentPosition([loopRun([completedAgent], "completed")], [task])).toMatchObject({
      loopRunId: "loop-run",
      taskId: "agent-task",
      executionProfileId: "primary"
    });
  });
});
