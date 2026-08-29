/* eslint-disable max-lines, max-lines-per-function */
import { afterEach, describe, expect, test } from "vitest";
import type { CreateEnvironmentRunInput } from "../../../shared/orchestration/persistence.js";
import type { StoredEnvironmentRun } from "../../../shared/orchestration/persistenceRecords.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { FeedbackStore } from "../persistence/FeedbackStore.js";
import { AgentExecutionStore } from "../persistence/AgentExecutionStore.js";
import {
  actionDefinition, environmentSeed, hash, openTestDatabase, TEST_AT, TEST_SHA, type TestDatabase
} from "../persistence/PersistenceTestFixtures.js";
import { planContinuationSeed } from "./ContinuationSeedPlanner.js";
import { DeterministicExecutionQueue } from "./ExecutionQueueBoundary.js";
import { EnvironmentRuntimeService, type RunEvidenceFinalizationPort } from "./EnvironmentRuntimeService.js";
import { authorizeProviderPath, authorizeProviderReadPath, mapProviderPermissions } from "./ProviderPermissions.js";
import { ScriptedRuntimeProvider, type ProviderTerminal } from "./RuntimeProvider.js";

describe("orchestration validation-led Environment runtime", () => {
  let database: TestDatabase | undefined;
  afterEach(() => database?.cleanup());

  test("precheck done skips Work and finalizes Run Evidence", async () => {
    const harness = createHarness([output(precheck("done"))]);
    await harness.start();
    await harness.drain();
    expect(harness.provider.calls.map(({ spec }) => spec.evidence.role)).toEqual(["validation"]);
    expect(harness.run().status).toBe("completed");
    expect(harness.finalized).toHaveLength(1);
  });

  test("delegate queues exact subordinate Work and postwork done", async () => {
    const harness = createHarness([
      output(precheck("delegate", "Implement exact change")), output(work("completed")), output(postwork("done"))
    ]);
    await harness.start();
    await harness.drain();
    expect(harness.provider.calls.map(({ spec }) => spec.evidence.phase)).toEqual(["precheck", "work", "postwork"]);
    const agents = database!.connection.prepare("SELECT role, phase, parent_agent_run_id FROM agent_runs ORDER BY rowid").all() as Array<Record<string, unknown>>;
    expect(agents[1]!.parent_agent_run_id).toBeTruthy();
    expect(agents[2]!.parent_agent_run_id).toBeTruthy();
    expect(harness.provider.calls[1]!.spec.evidence.prompt).toContain("Implement exact change");
  });

  test("semantic retry creates a second Work with latest Validation prompt", async () => {
    const harness = createHarness([
      output(precheck("delegate", "first")), output(work("completed")), output(postwork("retry", "second")),
      output(work("completed")), output(postwork("done"))
    ]);
    await harness.start(); await harness.drain();
    const workCalls = harness.provider.calls.filter(({ spec }) => spec.evidence.role === "work");
    expect(workCalls).toHaveLength(2);
    expect(workCalls[1]!.spec.evidence.prompt).toContain("second");
  });

  test("Work needs_input waits durably and resumes the same semantic attempt after exact human response", async () => {
    const harness = createHarness([
      output(precheck("delegate", "first")), output(workNeedsInput("Choose a bounded value", "Only A or B")),
      output(work("completed")), output(postwork("done"))
    ]);
    await harness.start(); await harness.drain();
    const waiting = database!.connection.prepare(
      "SELECT agent_run_id, revision, status FROM agent_runs WHERE status = 'waiting_for_input'"
    ).get() as { agent_run_id: string; revision: number; status: string };
    expect(waiting.status).toBe("waiting_for_input");
    expect(database!.connection.prepare("SELECT status FROM execution_tasks WHERE agent_run_id = ?").get(waiting.agent_run_id))
      .toEqual({ status: "waiting_for_input" });
    expect(harness.run()).toMatchObject({ status: "running", activeAgentRunId: waiting.agent_run_id });
    harness.service.answerWorkInput({ environmentRunId: "run-1", expectedAgentRunId: waiting.agent_run_id,
      expectedAgentRevision: waiting.revision, answer: "A", actorId: "human-1" });
    await harness.drain();
    expect(harness.provider.calls.filter(({ spec }) => spec.evidence.role === "work")).toHaveLength(2);
    expect(harness.provider.calls[2]!.spec.evidence.prompt).toContain("Human response (human-1)");
    expect(database!.connection.prepare("SELECT work_attempt FROM action_executions").get()).toEqual({ work_attempt: 1 });
    expect(harness.run().status).toBe("completed");
  });

  test("maxRetries zero converts retry to atomic blocked Feedback", async () => {
    const harness = createHarness([
      output(precheck("delegate", "first")), output(work("completed")), output(postwork("retry", "second"))
    ], environmentSeed({ stateCount: 1, maxRetries: 0 }));
    await harness.start(); await harness.drain();
    expect(harness.run().status).toBe("blocked");
    expect(new FeedbackStore(() => database!.connection).list("run-1")).toHaveLength(1);
  });

  test("maxRetries three permits exactly four Work attempts", async () => {
    const script: ProviderTerminal[] = [output(precheck("delegate", "work-1"))];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      script.push(output(work("completed")), output(postwork("retry", `work-${attempt + 1}`)));
    }
    const harness = createHarness(script, environmentSeed({ stateCount: 1, maxRetries: 3 }));
    await harness.start(); await harness.drain();
    expect(harness.provider.calls.filter(({ spec }) => spec.evidence.role === "work")).toHaveLength(4);
    expect(harness.run().status).toBe("blocked");
  });

  test("Work provider failure blocks without consuming a semantic retry", async () => {
    const harness = createHarness([
      output(precheck("delegate", "work")), { kind: "failure", providerOutcomeKey: "failure-1", errorMessage: "provider exited" },
    ]);
    await harness.start(); await harness.drain();
    expect(harness.provider.calls.map(({ spec }) => spec.evidence.phase)).toEqual(["precheck", "work"]);
    expect(harness.run().status).toBe("blocked");
    expect(database!.connection.prepare("SELECT work_attempt FROM action_executions").get()).toEqual({ work_attempt: 0 });
  });

  test("invalid Validation output fails closed with system Feedback", async () => {
    const harness = createHarness([{ kind: "output", providerOutcomeKey: "invalid-1", raw: "{}" }]);
    await harness.start(); await harness.drain();
    const feedback = new FeedbackStore(() => database!.connection).list("run-1");
    expect(feedback[0]!.source).toBe("system_invalid_output");
    expect(harness.run().status).toBe("blocked");
  });

  test("first Action done selects second priority Action", async () => {
    const harness = createHarness([output(precheck("done")), output(precheck("done"))], twoActionSeed());
    await harness.start(); await harness.drain();
    expect(harness.provider.calls).toHaveLength(2);
    expect(harness.run().status).toBe("completed");
  });

  test("State two starts only after State one completes", async () => {
    const harness = createHarness([output(precheck("done")), output(precheck("done"))], environmentSeed({ stateCount: 2 }));
    await harness.start(); await harness.drain();
    const events = database!.connection.prepare("SELECT kind FROM control_flow_events ORDER BY sequence").all() as Array<{ kind: string }>;
    expect(events.map(({ kind }) => kind)).toEqual(expect.arrayContaining(["state_completed", "state_activated"]));
    expect(events.map(({ kind }) => kind).lastIndexOf("state_activated")).toBeGreaterThan(events.map(({ kind }) => kind).indexOf("state_completed"));
  });

  test("blocked Action gates later Action and State", async () => {
    const harness = createHarness([output(precheck("blocked"))], twoActionSeed(2));
    await harness.start(); await harness.drain();
    expect(harness.provider.calls).toHaveLength(1);
    expect(harness.run().status).toBe("blocked");
  });

  test("all States done produces one immutable Run Evidence", async () => {
    const harness = createHarness([output(precheck("done")), output(precheck("done"))], environmentSeed({ stateCount: 2 }));
    await harness.start(); await harness.drain();
    const rows = database!.connection.prepare("SELECT * FROM run_evidences").all();
    expect(rows).toHaveLength(1);
  });

  test("cancellation during Work prevents postwork dispatch", async () => {
    const harness = createHarness([output(precheck("delegate", "work"))]);
    await harness.start();
    await harness.service.processNext();
    await harness.service.cancel("run-1");
    await harness.service.processNext();
    expect(harness.provider.calls).toHaveLength(1);
    expect(harness.run().status).toBe("cancelled");
  });

  test("shutdown interrupts durable active Runs before the database closes", async () => {
    const harness = createHarness([]);
    await harness.start();
    await harness.service.shutdown();
    expect(harness.run().status).toBe("interrupted");
    expect(database!.connection.prepare("SELECT status FROM execution_tasks").get()).toEqual({ status: "cancelled" });
  });

  test("duplicate provider terminal is an idempotent no-op", async () => {
    const harness = createHarness([output(precheck("done"))]);
    await harness.start();
    const taskId = database!.connection.prepare("SELECT execution_task_id FROM execution_tasks").get() as { execution_task_id: string };
    await harness.service.processNext();
    harness.queue.enqueue(taskId.execution_task_id);
    await harness.service.processNext();
    expect(harness.provider.calls).toHaveLength(1);
  });

  test("restart reconcile queues exactly one durable pending Agent Run", async () => {
    const first = createHarness([output(precheck("done"))]);
    await first.start();
    const replacementQueue = new DeterministicExecutionQueue();
    const replacement = new EnvironmentRuntimeService(
      () => database!.connection, replacementQueue, first.provider, first.finalizer,
      sequenceIds("restart"), () => TEST_AT
    );
    expect(await replacement.reconcile()).toBe(1);
    expect(await replacement.reconcile()).toBe(0);
    await replacement.processNext();
    expect(first.run().status).toBe("completed");
  });

  test("restart applies a provider terminal persisted before its domain transition", async () => {
    const first = createHarness([]);
    await first.start();
    const row = database!.connection.prepare("SELECT execution_task_id FROM execution_tasks").get() as { execution_task_id: string };
    const execution = new AgentExecutionStore(() => database!.connection);
    expect(execution.claimTask(row.execution_task_id, TEST_AT)).toBe(true);
    execution.finishTask(row.execution_task_id, "persisted-terminal", "succeeded", { outcome: precheck("done") }, TEST_AT);
    const replacement = new EnvironmentRuntimeService(
      () => database!.connection, new DeterministicExecutionQueue(), first.provider, first.finalizer,
      sequenceIds("terminal-restart"), () => TEST_AT
    );
    expect(await replacement.reconcile()).toBe(1);
    await replacement.processNext();
    expect(first.provider.calls).toHaveLength(0);
    expect(first.run().status).toBe("completed");
  });

  test("restart retries failed finalization before Run Evidence worktree cleanup", async () => {
    let fails = true;
    const finalizer: RunEvidenceFinalizationPort = {
      finalize: async (run, at) => {
        if (fails) throw new Error("simulated crash after finalization claim");
        return { runEvidenceId: "evidence-recovered", environmentRunId: run.environmentRunId,
          branch: run.branch, worktreePath: run.worktreePath, baseCommit: run.baseCommit,
          resultCommit: "b".repeat(40), changedFiles: [], artifactRefs: [], resourceHashes: {},
          definitionHashes: {}, validationSummary: { status: "passed" }, createdAt: at };
      }
    };
    const first = createHarness([output(precheck("done"))], environmentSeed({ stateCount: 1 }), finalizer);
    await first.start();
    await expect(first.drain()).rejects.toThrow(/simulated crash/);
    expect(first.run()).toMatchObject({ status: "running", finalizationStatus: "failed" });
    fails = false;
    const replacement = new EnvironmentRuntimeService(
      () => database!.connection, new DeterministicExecutionQueue(), first.provider, finalizer,
      sequenceIds("finalization-restart"), () => TEST_AT
    );
    expect(await replacement.reconcile()).toBe(1);
    expect(first.run().status).toBe("completed");
    expect(database!.connection.prepare("SELECT COUNT(*) AS count FROM run_evidences").get()).toEqual({ count: 1 });
  });

  test("read-only provider permission denies write and has no writable root", () => {
    const spec = mapProviderPermissions({ provider: "codex", role: "validation", toolPolicy: "read_only",
      networkAccess: false, worktreePath: "/tmp/worktree" });
    const audit: unknown[] = [];
    expect(spec.writableRoots).toEqual([]);
    expect(authorizeProviderReadPath(spec, "/tmp/worktree/README.md")).toBe(true);
    expect(authorizeProviderReadPath(spec, "/tmp/outside-secret")).toBe(false);
    expect(authorizeProviderPath(spec, "/tmp/worktree/file", (event) => audit.push(event))).toBe(false);
    expect(audit).toHaveLength(1);
  });

  test("Work permission allows only managed worktree paths", () => {
    const spec = mapProviderPermissions({ provider: "copilot", role: "work", toolPolicy: "workspace_write",
      networkAccess: true, worktreePath: "/tmp/worktree" });
    expect(authorizeProviderPath(spec, "/tmp/worktree/file", () => undefined)).toBe(true);
    expect(authorizeProviderPath(spec, "/tmp/elsewhere", () => undefined)).toBe(false);
    expect(spec.networkAccess).toBe(true);
    expect(spec.approvalPolicy).toBe("never");
  });

  test("continuation imports safe done Action and resets impact target", async () => {
    const parentHarness = createHarness([output(precheck("done")), output(precheck("done"))], twoActionSeed());
    await parentHarness.start(); await parentHarness.drain();
    const parent = parentHarness.run();
    const store = new EnvironmentRunStore(() => database!.connection);
    const planned = twoActionSeed(1, "continuation-1", "c".repeat(40));
    const seed = planContinuationSeed({
      parent, parentActions: store.actions(store.states(parent.environmentRunId)[0]!.stateExecutionId), planned,
      targetActionId: "action-2", impactActionIds: ["action-2"], refinementProposalId: "proposal-1",
      refinementApprovalId: "approval-1", refinementCommitSha: "c".repeat(40)
    });
    expect(seed.states[0]!.actions[0]!.importedDoneEvidence).toBeTruthy();
    expect(seed.states[0]!.actions[1]!.importedDoneEvidence).toBeUndefined();
  });

  test("changed shared Skill hash prevents unsafe done import", async () => {
    const seed = twoActionSeed();
    addSharedSkill(seed, "old");
    const parentHarness = createHarness([output(precheck("done")), output(precheck("done"))], seed);
    await parentHarness.start(); await parentHarness.drain();
    const parent = parentHarness.run();
    const planned = twoActionSeed(1, "continuation-1", "c".repeat(40));
    addSharedSkill(planned, "new");
    const store = new EnvironmentRunStore(() => database!.connection);
    const result = planContinuationSeed({
      parent, parentActions: store.actions(store.states(parent.environmentRunId)[0]!.stateExecutionId), planned,
      targetActionId: "action-2", impactActionIds: ["action-2"], refinementProposalId: "proposal-1",
      refinementApprovalId: "approval-1", refinementCommitSha: "c".repeat(40)
    });
    expect(result.states[0]!.actions[0]!.importedDoneEvidence).toBeUndefined();
  });

  function createHarness(
    script: ProviderTerminal[], seed = environmentSeed({ stateCount: 1 }), suppliedFinalizer?: RunEvidenceFinalizationPort
  ) {
    database = openTestDatabase();
    const queue = new DeterministicExecutionQueue();
    const provider = new ScriptedRuntimeProvider(script);
    const finalized: StoredEnvironmentRun[] = [];
    const finalizer: RunEvidenceFinalizationPort = {
      finalize: async (run, at) => {
        finalized.push(run);
        return {
          runEvidenceId: `evidence-${run.environmentRunId}`, environmentRunId: run.environmentRunId,
          branch: run.branch, worktreePath: run.worktreePath, baseCommit: run.baseCommit,
          resultCommit: "b".repeat(40), changedFiles: [], artifactRefs: [], resourceHashes: {},
          definitionHashes: {}, validationSummary: { status: "passed" }, createdAt: at
        };
      }
    };
    const activeFinalizer = suppliedFinalizer ?? finalizer;
    const service = new EnvironmentRuntimeService(
      () => database!.connection, queue, provider, activeFinalizer, sequenceIds("runtime"), () => TEST_AT
    );
    return {
      service, queue, provider, finalizer: activeFinalizer, finalized,
      start: () => service.start(seed),
      drain: async () => { while (await service.processNext()) { /* deterministic queue */ } },
      run: () => new EnvironmentRunStore(() => database!.connection).require(seed.environmentRunId)
    };
  }
});

let outcomeSequence = 0;
const output = (value: unknown): ProviderTerminal => ({
  kind: "output", providerOutcomeKey: `outcome-${++outcomeSequence}`, raw: JSON.stringify(value)
});
const testCheck = { name: "fixture", status: "passed" as const, evidenceRefs: ["test:fixture"] };
const precheck = (decision: "done" | "delegate" | "blocked", prompt = "work") => ({
  version: 11, role: "validation", summary: "precheck", checks: [testCheck],
  result: decision === "done" ? { phase: "precheck", decision, evidence: {} }
    : decision === "delegate" ? { phase: "precheck", decision, workPrompt: prompt, evidence: {} }
      : { phase: "precheck", decision, reason: "blocked", correctiveActions: ["correct"], evidence: {} }
});
const postwork = (decision: "done" | "retry" | "blocked", prompt = "retry") => ({
  version: 11, role: "validation", summary: "postwork", checks: [testCheck],
  result: decision === "done" ? { phase: "postwork", decision, evidence: {} }
    : decision === "retry" ? { phase: "postwork", decision, workPrompt: prompt, feedback: "fix", expectedCorrection: "pass", evidence: {} }
      : { phase: "postwork", decision, reason: "blocked", correctiveActions: ["correct"], evidence: {} }
});
const work = (state: "completed") => ({
  version: 11, role: "work", state, summary: "work", checks: [testCheck], artifacts: {}
});
const workNeedsInput = (question: string, context: string) => ({
  version: 11, role: "work", state: "needs_input", summary: "input required", checks: [testCheck],
  artifacts: {}, question, context
});
const sequenceIds = (prefix: string) => {
  let sequence = 0;
  return (kind: string) => `${prefix}-${kind}-${++sequence}`;
};

const twoActionSeed = (stateCount = 1, runId = "run-1", baseCommit = TEST_SHA): CreateEnvironmentRunInput => {
  const seed = environmentSeed({ stateCount, environmentRunId: runId, baseCommit });
  const first = seed.states[0]!;
  const second = actionDefinition(stateCount === 1 ? "action-2" : "action-extra", 2, 1);
  first.definition = { ...first.definition, actions: [first.definition.actions[0]!, second] };
  first.definitionHash = hash(first.definition);
  first.actions.push({ actionExecutionId: `${runId}:action:${second.id}`, definition: second, definitionHash: hash(second) });
  seed.executionSnapshot = {
    ...seed.executionSnapshot,
    projectHeadSha: baseCommit,
    environment: { ...seed.executionSnapshot.environment, states: seed.states.map(({ definition }) => definition) }
  };
  seed.executionSnapshotHash = hash(seed.executionSnapshot);
  return seed;
};

const addSharedSkill = (seed: CreateEnvironmentRunInput, content: string): void => {
  const skillId = "shared-skill";
  for (const state of seed.states) for (const actionSeed of state.actions) {
    actionSeed.definition = {
      ...actionSeed.definition,
      validation: { ...actionSeed.definition.validation, skillResources: [skillId] },
      work: { ...actionSeed.definition.work, skillResources: [skillId] }
    };
    actionSeed.definitionHash = hash(actionSeed.definition);
    const index = state.definition.actions.findIndex(({ id }) => id === actionSeed.definition.id);
    state.definition.actions[index] = actionSeed.definition;
    state.definitionHash = hash(state.definition);
  }
  seed.executionSnapshot = {
    ...seed.executionSnapshot,
    environment: { ...seed.executionSnapshot.environment, states: seed.states.map(({ definition }) => definition) },
    resources: [...seed.executionSnapshot.resources, {
      kind: "skill", id: skillId, relativePath: ".agents/skills/shared/SKILL.md", content,
      sourceSha256: sha256(content)
    }]
  };
  seed.executionSnapshotHash = hash(seed.executionSnapshot);
};
