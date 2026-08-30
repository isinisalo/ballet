import { afterEach, describe, expect, it } from "vitest";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { ActionOutcomeCoordinator } from "./ActionOutcomeCoordinator.js";
import { FlowCoordinator } from "./FlowCoordinator.js";
import {
  HASH_A, TEST_AT, TEST_SHA, agentRunInput, environmentSeed, hash,
  openTestDatabase, validationOutcome, type TestDatabase
} from "./PersistenceTestFixtures.js";
import { AgentExecutionStore } from "./AgentExecutionStore.js";

const databases: TestDatabase[] = [];
afterEach(() => databases.splice(0).forEach(({ cleanup }) => cleanup()));

describe("generic orchestration execution tasks and events", () => {
  it("uses one task/event model and applies a provider terminal exactly once", () => {
    const { database, store, spec } = setup();
    store.createTask({ spec, specHash: hash(spec) });
    expect(store.claimTask(spec.taskId, TEST_AT)).toBe(true);
    expect(store.claimTask(spec.taskId, TEST_AT)).toBe(false);
    store.appendEvent(spec.taskId, {
      sequence: 1, source: "codex", kind: "agent", level: "info", phase: "completed",
      message: "Completed", terminal: true, createdAt: TEST_AT
    });
    expect(() => store.appendEvent(spec.taskId, {
      sequence: 1, source: "codex", kind: "agent", level: "info", phase: "completed",
      message: "Duplicate", terminal: true, createdAt: TEST_AT
    })).toThrow(/stale or duplicated/);
    const outcome = validationOutcome({ phase: "precheck", decision: "done", evidence: {} });
    expect(store.finishTask(spec.taskId, "provider-terminal-1", "succeeded", { outcome }, TEST_AT)).toBe(true);
    expect(store.finishTask(spec.taskId, "provider-terminal-1", "succeeded", { outcome }, TEST_AT)).toBe(false);
    expect(() => store.finishTask(spec.taskId, "provider-terminal-2", "succeeded", { outcome }, TEST_AT))
      .toThrow(/different terminal/);
    expect(database.connection.prepare("SELECT COUNT(*) AS count FROM execution_events").get()).toEqual({ count: 1 });
  });

  it("rejects a task whose immutable spec differs from its Agent Run", () => {
    const { store, spec } = setup();
    const mismatched = { ...spec, evidence: { ...spec.evidence, role: "work" as const, phase: "work" as const, outputSchemaId: "work-outcome-v11" as const } };
    expect(() => store.createTask({ spec: mismatched, specHash: hash(mismatched) })).toThrow(/Agent Run/);
  });
});

const setup = () => {
  const database = openTestDatabase();
  databases.push(database);
  const flow = new FlowCoordinator(() => database.connection);
  const outcomes = new ActionOutcomeCoordinator(() => database.connection);
  flow.createEnvironmentRun(environmentSeed({ stateCount: 1 }));
  const action = flow.advance("run-1", 0, TEST_AT);
  const agentInput = agentRunInput("precheck-1", "precheck", 1);
  outcomes.createPrecheck(action.actionExecutionId, action.revision, agentInput);
  const prompt = "Validate the Action";
  const spec = {
    version: 17 as const,
    taskId: "execution-task-1",
    kind: "agent_execution" as const,
    environmentRunId: "run-1",
    actionExecutionId: "action-execution-1",
    agentRunId: "precheck-1",
    evidence: {
      compositionVersion: 15 as const,
      role: "validation" as const,
      phase: "precheck" as const,
      subject: { kind: "action_role" as const, actionId: "action-1", role: "validation" as const },
      resources: [], prompt, promptSha256: sha256(prompt),
      taskEnvelopeVersion: 11 as const, taskEnvelopeSha256: agentInput.taskEnvelopeHash,
      outputSchemaVersion: 11 as const, outputSchemaId: "validation-outcome-v11" as const,
      outputSchemaSha256: HASH_A
    },
    runtime: {
      subject: { kind: "action_role" as const, actionId: "action-1", role: "validation" as const },
      provider: "codex" as const, cliVersion: "1.0.0", model: "gpt",
      reasoningEffort: "high", capabilityHash: HASH_A
    },
    permissions: { workspaceAccess: "read-only" as const, approvalPolicy: "never" as const },
    project: { checkoutRoot: "/tmp/worktree", headSha: TEST_SHA, configHash: HASH_A, snapshotHash: HASH_A },
    createdAt: TEST_AT
  };
  return { database, store: new AgentExecutionStore(() => database.connection), spec };
};
