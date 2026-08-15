import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultTerminalNodes,
  type ProjectAutomationConfig,
  type ProjectExecutableStep
} from "../../shared/domain/automation.js";
import { defaultLoopTheme, type LoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  ExecutionRuntimeSnapshot,
  LoopRunDetails,
  RootExecutionSnapshot,
  StepOutcome,
  StepRunResult
} from "../../shared/domain/runtime.js";
import { renderStepTaskEnvelope } from "../integration/LoopStepPrompt.js";
import { RuntimeDatabase, isPatchedSqliteVersion } from "../runtime-db.js";
import { LoopRunConflictError, LoopRunIntegrityError } from "../runtime/LoopRunErrors.js";
import { LoopRunStore } from "../runtime/LoopRunStore.js";

const roots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const runtimeSnapshot: ExecutionRuntimeSnapshot = {
  hostname: "localhost",
  provider: "codex",
  cliVersion: "1.0.0",
  model: "test-model",
  reasoning: "medium",
  policy: { network: false, readOnlyRoots: [] },
  capabilityHash: "capabilities"
};

const completed = (
  result: StepRunResult,
  summary = result === "approved" ? "Approved." : "Changes are required."
): StepOutcome => ({
  state: "completed",
  result,
  summary,
  checks: result === "approved"
    ? [{ name: "verification", status: "passed" }]
    : [{ name: "review", status: "failed", details: "Address the review feedback." }]
});

const runtimeDatabase = async (): Promise<RuntimeDatabase> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-states-"));
  roots.push(root);
  const database = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
  databases.push(database);
  return database;
};

const insertRoot = (
  runtime: RuntimeDatabase,
  automation: ProjectAutomationConfig,
  loopId: string,
  theme: LoopTheme = defaultLoopTheme
): string => {
  const rootRunId = randomUUID();
  const timestamp = new Date().toISOString();
  const executionSnapshot: RootExecutionSnapshot = {
    version: 1,
    rootLoopId: loopId,
    project: {
      checkoutRoot: `/tmp/${rootRunId}`,
      headSha: "a".repeat(40),
      configHash: "config",
      snapshotHash: "snapshot"
    },
    loops: structuredClone(automation.loops),
    theme: structuredClone(theme),
    executionProfiles: [{
      id: "test-profile",
      name: "Test profile",
      provider: "codex",
      model: "test-model",
      reasoningEffort: "medium",
      networkAccess: false
    }],
    runtimes: [{ executionProfileId: "test-profile", runtime: runtimeSnapshot }],
    resources: [],
    createdAt: timestamp
  };
  runtime.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, execution_snapshot_json, created_at, updated_at
    ) VALUES (?, 'loop', ?, 'manual', 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?, ?)
  `).run(rootRunId, loopId, `/tmp/${rootRunId}`, `ballet/run/${rootRunId}`,
    "a".repeat(40), JSON.stringify(executionSnapshot), timestamp, timestamp);
  return rootRunId;
};

const startLoop = (
  runtime: RuntimeDatabase,
  automation: ProjectAutomationConfig,
  loopId: string,
  input?: string
): LoopRunDetails => runtime.startLoopRun(
  insertRoot(runtime, automation, loopId),
  input
);

const agentStep = (
  id: string,
  on: ProjectExecutableStep["on"]
): ProjectExecutableStep => ({
  id,
  type: "agent",
  executionProfileId: "test-profile",
  primaryInstructionId: "project:test",
  skillIds: [],
  description: `Execute ${id}.`,
  nodeStyle: "flat",
  nodeSize: "medium",
  on
});

const humanStep = (
  id: string,
  on: ProjectExecutableStep["on"]
): ProjectExecutableStep => ({
  id,
  type: "human",
  description: `Decide ${id}.`,
  nodeStyle: "luna",
  nodeSize: "tiny",
  on
});

const singleStepConfig = (
  step: ProjectExecutableStep,
  loopId = "main-loop"
): ProjectAutomationConfig => ({
  version: 9,
  loops: [{ id: loopId, start: step.id, nodes: [step, ...defaultTerminalNodes()] }]
});

const needsInputOutcome = (question: string, context: string, summary: string): StepOutcome => ({
  state: "needs_input",
  question,
  context,
  summary,
  checks: []
});

const currentTaskEnvelope = (runtime: RuntimeDatabase, run: LoopRunDetails) => {
  const snapshotRow = runtime.connection().prepare(`
    SELECT execution_snapshot_json FROM root_runs WHERE root_run_id = ?
  `).get(run.rootRunId) as { execution_snapshot_json: string };
  const snapshot = JSON.parse(snapshotRow.execution_snapshot_json) as RootExecutionSnapshot;
  const current = run.stepRuns.at(-1);
  if (!current) throw new Error("A current Step Run is required.");
  return JSON.parse(renderStepTaskEnvelope(snapshot, [run], run, current)) as {
    runInput: string;
    resume: { question: string; context: string; response: string };
  };
};

describe("Loop runtime technical states and outcomes", () => {
  it("recognizes patched SQLite versions", () => {
    expect(isPatchedSqliteVersion("3.51.3")).toBe(true);
    expect(isPatchedSqliteVersion("3.51.2")).toBe(false);
  });

  it("projects each Loop Run's Loop and theme from its immutable Root snapshot", async () => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(humanStep("gate", {
      approved: "completed",
      rejected: "blocked"
    }), "snapshot-projection");
    const theme: LoopTheme = {
      ...structuredClone(defaultLoopTheme),
      node: { ...defaultLoopTheme.node, labelColor: "#123456" }
    };
    const rootRunId = insertRoot(runtime, automation, "snapshot-projection", theme);

    const run = runtime.startLoopRun(rootRunId);

    expect(run.snapshot).toEqual(automation.loops[0]);
    expect(run.themeSnapshot).toEqual(theme);
    const columns = runtime.connection().pragma("table_info(loop_runs)") as Array<{ name: string }>;
    expect(columns.map(({ name }) => name)).not.toEqual(expect.arrayContaining([
      "snapshot_json",
      "theme_snapshot_json"
    ]));
    expect(() => runtime.connection().prepare(`
      UPDATE root_runs SET execution_snapshot_json = execution_snapshot_json WHERE root_run_id = ?
    `).run(rootRunId)).toThrow("root run execution snapshot is immutable");
  });

  it.each([
    ["completed", "approved"],
    ["blocked", "rejected"],
    ["failed", "rejected"]
  ] as const)("follows a completed %s-targeting result to the %s terminal", async (terminal, result) => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(agentStep("work", {
      approved: terminal,
      rejected: terminal
    }), `terminal-${terminal}`);
    const run = startLoop(runtime, automation, `terminal-${terminal}`);

    const details = runtime.completeExecutionStep({
      stepRunId: run.stepRuns[0]!.stepRunId,
      outcome: completed(result)
    });

    expect(details.status).toBe(terminal);
    expect(details.transitionCount).toBe(1);
    expect(details.stepRuns).toEqual([expect.objectContaining({
      status: "completed",
      result,
      outcome: expect.objectContaining({ state: "completed", result })
    })]);
  });

  it.each(["approved", "rejected"] as const)(
    "uses only the completed %s transition and preserves reviewer evidence",
    async (result) => {
      const runtime = await runtimeDatabase();
      const automation: ProjectAutomationConfig = {
        version: 9,
        loops: [{
          id: "decision",
          start: "review",
          nodes: [
            agentStep("review", { approved: "accepted", rejected: "revise" }),
            agentStep("accepted", { approved: "completed", rejected: "failed" }),
            agentStep("revise", { approved: "completed", rejected: "failed" }),
            ...defaultTerminalNodes()
          ]
        }]
      };
      const run = startLoop(runtime, automation, "decision");
      const report = completed(result, result === "rejected" ? "Please revise the boundary." : "Boundary accepted.");

      const details = runtime.completeExecutionStep({
        stepRunId: run.stepRuns[0]!.stepRunId,
        outcome: report
      });

      expect(details.status).toBe("running");
      expect(details.transitionCount).toBe(1);
      expect(details.stepRuns).toHaveLength(2);
      expect(details.stepRuns[0]).toMatchObject({ status: "completed", result, outcome: report });
      expect(details.stepRuns[1]).toMatchObject({
        stepId: result === "approved" ? "accepted" : "revise",
        status: "queued"
      });
    }
  );

  it("reads the persisted StepRun result and rejects inconsistent outcome evidence before transitioning", async () => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(agentStep("work", {
      approved: "completed",
      rejected: "blocked"
    }), "persisted-result");
    const run = startLoop(runtime, automation, "persisted-result");
    const original = LoopRunStore.prototype.completeStepRun;
    vi.spyOn(LoopRunStore.prototype, "completeStepRun").mockImplementation(function (
      this: LoopRunStore,
      stepRun,
      result,
      options
    ) {
      original.call(this, stepRun, result, options);
      runtime.connection().prepare(`
        UPDATE step_runs SET result = 'rejected' WHERE step_run_id = ?
      `).run(stepRun.stepRunId);
      const persisted = this.getStepRun(stepRun.stepRunId);
      if (!persisted) throw new Error("Expected persisted Step Run readback.");
      return persisted;
    });

    expect(() => runtime.completeExecutionStep({
      stepRunId: run.stepRuns[0]!.stepRunId,
      outcome: completed("approved")
    })).toThrow(LoopRunIntegrityError);
    expect(runtime.listRootLoopRuns(run.rootRunId)[0]).toMatchObject({
      status: "running",
      transitionCount: 0,
      stepRuns: [expect.objectContaining({ status: "queued", result: undefined })]
    });
  });

  it.each(["blocked", "failed"] as const)(
    "%s terminalizes the Step and Run without executing either transition",
    async (state) => {
      const runtime = await runtimeDatabase();
      const automation: ProjectAutomationConfig = {
        version: 9,
        loops: [{
          id: `technical-${state}`,
          start: "work",
          nodes: [
            agentStep("work", { approved: "approved-next", rejected: "rejected-next" }),
            agentStep("approved-next", { approved: "completed", rejected: "failed" }),
            agentStep("rejected-next", { approved: "completed", rejected: "failed" }),
            ...defaultTerminalNodes()
          ]
        }]
      };
      const run = startLoop(runtime, automation, `technical-${state}`);
      const outcome: StepOutcome = {
        state,
        summary: state === "blocked" ? "Waiting for an external dependency." : "Provider execution failed.",
        checks: [{ name: "runtime", status: "failed", details: "No transition is safe." }]
      };

      const details = runtime.completeExecutionStep({
        stepRunId: run.stepRuns[0]!.stepRunId,
        outcome
      });

      expect(details.status).toBe(state);
      expect(details.transitionCount).toBe(0);
      expect(details.stepRuns).toHaveLength(1);
      expect(details.stepRuns[0]).toMatchObject({ status: state, outcome });
      expect(details.stepRuns[0]!.result).toBeUndefined();
      expect(details.stepRuns[0]!.completedAt).toEqual(expect.any(String));
    }
  );

  it("maps execution errors to failed without taking the rejected transition", async () => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(agentStep("work", {
      approved: "completed",
      rejected: "blocked"
    }), "execution-error");
    const run = startLoop(runtime, automation, "execution-error");

    const details = runtime.completeExecutionStep({
      stepRunId: run.stepRuns[0]!.stepRunId,
      error: "Provider process timed out."
    });

    expect(details).toMatchObject({ status: "failed", transitionCount: 0 });
    expect(details.stepRuns).toEqual([expect.objectContaining({
      status: "failed",
      error: "Provider process timed out.",
      outcome: { state: "failed", summary: "Provider process timed out.", checks: [] }
    })]);
    expect(details.stepRuns[0]!.result).toBeUndefined();
  });

  it("pairs each needs_input question with only its current resume answer across two rounds", async () => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(agentStep("clarify", {
      approved: "completed",
      rejected: "failed"
    }), "clarification");
    const started = startLoop(runtime, automation, "clarification", "Original request");
    const stepRunId = started.stepRuns[0]!.stepRunId;
    const firstTaskId = randomUUID();
    runtime.bindStepExecution(stepRunId, firstTaskId, runtimeSnapshot);
    expect(runtime.markStepRunRunning(stepRunId).attempt).toBe(1);
    const firstNeedsInput = needsInputOutcome(
      "Which deployment region should be used?",
      "The request permits either north or south.",
      "A deployment region is required."
    );

    const paused = runtime.completeExecutionStep({
      stepRunId,
      executionTaskId: firstTaskId,
      outcome: firstNeedsInput
    });

    expect(paused).toMatchObject({ status: "waiting_for_human", transitionCount: 0 });
    expect(paused.stepRuns).toEqual([expect.objectContaining({
      stepRunId,
      status: "needs_input",
      input: "Original request",
      outcome: firstNeedsInput,
      attempt: 1
    })]);

    const resumed = runtime.resumeStepRun(paused.runId, stepRunId, "Use the north region.");

    expect(resumed).toMatchObject({
      status: "running",
      transitionCount: 0,
      stepRuns: [expect.objectContaining({
        stepRunId,
        status: "queued",
        input: "Original request\n\nUse the north region.",
        responseInput: "Use the north region.",
        executionTaskId: undefined,
        outcome: firstNeedsInput,
        attempt: 1
      })]
    });
    const firstEnvelope = currentTaskEnvelope(runtime, resumed);
    expect(firstEnvelope).toEqual(expect.objectContaining({
      runInput: "Original request\n\nUse the north region.",
      resume: {
        question: "Which deployment region should be used?",
        context: "The request permits either north or south.",
        response: "Use the north region."
      }
    }));

    const secondTaskId = randomUUID();
    runtime.bindStepExecution(stepRunId, secondTaskId, runtimeSnapshot);
    expect(() => runtime.bindStepExecution(stepRunId, randomUUID(), runtimeSnapshot))
      .toThrow(`Step run ${stepRunId} already has an execution task.`);
    const afterStaleCompletion = runtime.completeExecutionStep({
      stepRunId,
      executionTaskId: firstTaskId,
      outcome: firstNeedsInput
    });
    expect(afterStaleCompletion.stepRuns[0]).toMatchObject({
      stepRunId,
      status: "queued",
      executionTaskId: secondTaskId,
      attempt: 1
    });
    expect(runtime.markStepRunRunning(stepRunId)).toMatchObject({ stepRunId, attempt: 2 });
    const secondNeedsInput = needsInputOutcome(
      "Which database should be used?",
      "The selected region supports SQLite and Postgres.",
      "A database choice is required."
    );
    const pausedAgain = runtime.completeExecutionStep({
      stepRunId,
      executionTaskId: secondTaskId,
      outcome: secondNeedsInput
    });
    expect(pausedAgain).toMatchObject({ status: "waiting_for_human", transitionCount: 0 });
    expect(pausedAgain.stepRuns).toEqual([expect.objectContaining({
      stepRunId,
      status: "needs_input",
      outcome: secondNeedsInput,
      responseInput: undefined,
      attempt: 2
    })]);

    const resumedAgain = runtime.resumeStepRun(pausedAgain.runId, stepRunId, "Use PostgreSQL.");
    expect(resumedAgain).toMatchObject({ status: "running", transitionCount: 0 });
    expect(resumedAgain.stepRuns).toEqual([expect.objectContaining({
      stepRunId,
      status: "queued",
      input: "Original request\n\nUse the north region.\n\nUse PostgreSQL.",
      responseInput: "Use PostgreSQL.",
      outcome: secondNeedsInput,
      attempt: 2
    })]);
    const secondEnvelope = currentTaskEnvelope(runtime, resumedAgain);
    expect(secondEnvelope).toEqual(expect.objectContaining({
      runInput: "Original request\n\nUse the north region.\n\nUse PostgreSQL.",
      resume: {
        question: "Which database should be used?",
        context: "The selected region supports SQLite and Postgres.",
        response: "Use PostgreSQL."
      }
    }));

    const finalTaskId = randomUUID();
    runtime.bindStepExecution(stepRunId, finalTaskId, runtimeSnapshot);
    expect(runtime.markStepRunRunning(stepRunId)).toMatchObject({ stepRunId, attempt: 3 });
    expect(runtime.completeExecutionStep({
      stepRunId,
      executionTaskId: finalTaskId,
      outcome: completed("approved")
    })).toMatchObject({
      status: "completed",
      transitionCount: 1,
      stepRuns: [expect.objectContaining({
        stepRunId, status: "completed", result: "approved", responseInput: "Use PostgreSQL.", attempt: 3
      })]
    });
  });
});

describe("generic Loop control flow", () => {
  it.each(["approved", "rejected"] as const)(
    "follows a human %s decision",
    async (result) => {
      const runtime = await runtimeDatabase();
      const automation = singleStepConfig(humanStep("gate", {
        approved: "completed",
        rejected: "blocked"
      }), "human-decision");
      const run = startLoop(runtime, automation, "human-decision", "Original context");

      const details = runtime.respondToStepRun(
        run.runId,
        run.stepRuns[0]!.stepRunId,
        result,
        `${result} response`
      );

      expect(details.status).toBe(result === "approved" ? "completed" : "blocked");
      expect(details.transitionCount).toBe(1);
      expect(details.input).toContain(`${result} response`);
      expect(details.stepRuns[0]).toMatchObject({
        status: "completed",
        result,
        responseInput: `${result} response`
      });
    }
  );

  it.each([
    ["agent", "approved"],
    ["agent", "rejected"],
    ["human", "approved"],
    ["human", "rejected"]
  ] as const)("allows a %s Step's %s transition to target another Loop", async (type, result) => {
    const runtime = await runtimeDatabase();
    const source = type === "agent"
      ? agentStep("route", {
          approved: { loop: "approved-loop" },
          rejected: { loop: "rejected-loop" }
        })
      : humanStep("route", {
          approved: { loop: "approved-loop" },
          rejected: { loop: "rejected-loop" }
        });
    const target = (id: string) => ({
      id,
      start: "finish",
      nodes: [agentStep("finish", { approved: "completed", rejected: "failed" }), ...defaultTerminalNodes()]
    });
    const automation: ProjectAutomationConfig = {
      version: 9,
      loops: [{ id: "source-loop", start: source.id, nodes: [source, ...defaultTerminalNodes()] },
        target("approved-loop"), target("rejected-loop")]
    };
    const run = startLoop(runtime, automation, "source-loop", "Root context");

    if (type === "agent") {
      runtime.completeExecutionStep({
        stepRunId: run.stepRuns[0]!.stepRunId,
        outcome: completed(result)
      });
    } else {
      runtime.respondToStepRun(run.runId,
        run.stepRuns[0]!.stepRunId, result, "Human context");
    }

    const rootRuns = runtime.listRootLoopRuns(run.rootRunId);
    const parent = rootRuns.find((candidate) => candidate.runId === run.runId)!;
    const child = rootRuns.find((candidate) => candidate.loopId === `${result}-loop`)!;
    expect(parent.status).toBe("completed");
    expect(parent.transitionCount).toBe(1);
    expect(child).toMatchObject({
      rootRunId: run.rootRunId,
      parentRunId: run.runId,
      parentStepRunId: run.stepRuns[0]!.stepRunId,
      source: "transition",
      status: "running"
    });
    expect(child.input).toContain("Root context");
    if (type === "human") expect(child.input).toContain("Human context");
  });

  it("supports an arbitrary cycle and exits through a configured result", async () => {
    const runtime = await runtimeDatabase();
    const automation: ProjectAutomationConfig = {
      version: 9,
      loops: [{
        id: "cycle",
        start: "first",
        nodes: [
          agentStep("first", { approved: "second", rejected: "completed" }),
          agentStep("second", { approved: "first", rejected: "failed" }),
          ...defaultTerminalNodes()
        ]
      }]
    };
    let details = startLoop(runtime, automation, "cycle");
    details = runtime.completeExecutionStep({
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: completed("approved")
    });
    details = runtime.completeExecutionStep({
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: completed("approved")
    });
    details = runtime.completeExecutionStep({
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: completed("rejected")
    });

    expect(details.status).toBe("completed");
    expect(details.transitionCount).toBe(3);
    expect(details.stepRuns.map((step) => step.stepId)).toEqual(["first", "second", "first"]);
    expect(new Set(details.stepRuns.map((step) => step.stepRunId)).size).toBe(3);
  });

  it("keeps one active Run per Loop", async () => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(agentStep("work", {
      approved: "completed",
      rejected: "failed"
    }), "active-loop");
    startLoop(runtime, automation, "active-loop");
    expect(() => startLoop(runtime, automation, "active-loop")).toThrow(LoopRunConflictError);
  });

  it("blocks an agent transition when the target Loop is already active", async () => {
    const runtime = await runtimeDatabase();
    const automation: ProjectAutomationConfig = {
      version: 9,
      loops: [{
        id: "source", start: "route",
        nodes: [agentStep("route", { approved: { loop: "target" }, rejected: "failed" }), ...defaultTerminalNodes()]
      }, {
        id: "target", start: "wait",
        nodes: [humanStep("wait", { approved: "completed", rejected: "failed" }), ...defaultTerminalNodes()]
      }]
    };
    startLoop(runtime, automation, "target");
    const source = startLoop(runtime, automation, "source");

    const blocked = runtime.completeExecutionStep({
      stepRunId: source.stepRuns[0]!.stepRunId,
      outcome: completed("approved")
    });

    expect(blocked).toMatchObject({ status: "blocked", transitionCount: 0 });
    expect(blocked.stepRuns[0]).toMatchObject({
      status: "blocked",
      outcome: { state: "blocked", summary: "Loop target already has an active run.", checks: [] }
    });
    expect(blocked.stepRuns[0]!.result).toBeUndefined();
    expect(runtime.listRootLoopRuns(source.rootRunId)).toHaveLength(1);
  });

  it("blocks after the root transition safety limit", async () => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(agentStep("again", {
      approved: "again",
      rejected: "failed"
    }), "bounded-cycle");
    let details = startLoop(runtime, automation, "bounded-cycle");
    for (let index = 0; index < 21 && details.status === "running"; index += 1) {
      details = runtime.completeExecutionStep({
        stepRunId: details.stepRuns.at(-1)!.stepRunId,
        outcome: completed("approved")
      });
    }

    expect(details.status).toBe("blocked");
    expect(details.transitionCount).toBe(20);
    expect(details.stepRuns).toHaveLength(21);
    expect(details.stepRuns.at(-1)).toMatchObject({
      status: "blocked",
      outcome: { state: "blocked", summary: "Root transition limit of 20 reached.", checks: [] }
    });
    expect(details.stepRuns.at(-1)!.result).toBeUndefined();
  });

  it("cancels needs_input and ignores a late completion", async () => {
    const runtime = await runtimeDatabase();
    const automation = singleStepConfig(agentStep("work", {
      approved: "completed",
      rejected: "failed"
    }), "cancel-wait");
    const run = startLoop(runtime, automation, "cancel-wait");
    const stepRunId = run.stepRuns[0]!.stepRunId;
    runtime.completeExecutionStep({
      stepRunId,
      outcome: {
        state: "needs_input",
        question: "Continue?",
        context: "The operation is paused.",
        summary: "Input required.",
        checks: []
      }
    });

    const cancelled = runtime.cancelLoopRun(run.runId);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.stepRuns[0]!.status).toBe("cancelled");
    const late = runtime.completeExecutionStep({
      stepRunId,
      outcome: completed("approved")
    });
    expect(late.status).toBe("cancelled");
    expect(late.stepRuns).toHaveLength(1);
  });
});
