import { afterEach, describe, expect, it } from "vitest";
import type { LocalDaemonHeartbeat, LocalProviderStatus } from "../../../shared/domain/runtime.js";
import type { ExecutionSpecV15 } from "../../../shared/orchestration/execution.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { ActionOutcomeCoordinator } from "./ActionOutcomeCoordinator.js";
import { AgentExecutionStore } from "./AgentExecutionStore.js";
import { FlowCoordinator } from "./FlowCoordinator.js";
import { LocalDaemonStore } from "./LocalDaemonStore.js";
import { HASH_A, TEST_AT, TEST_SHA, agentRunInput, environmentSeed, hash,
  openTestDatabase, type TestDatabase } from "./PersistenceTestFixtures.js";

const databases: TestDatabase[] = [];
afterEach(() => databases.splice(0).forEach(({ cleanup }) => cleanup()));

describe("checkout-local daemon persistence", () => {
  it("stores one local provider binding without device identity", () => {
    const { daemon } = setup(); daemon.heartbeat(heartbeat());
    const binding = daemon.putBinding("profile", {
      provider: "codex", model: "gpt", reasoningEffort: "high",
      policy: { network: false, readOnlyRoots: [] }
    });
    expect(binding).toEqual(expect.objectContaining({ version: 2, agentId: "profile", provider: "codex" }));
    expect(binding).not.toHaveProperty("deviceId"); expect(binding).not.toHaveProperty("runtimeBackendId");
  });

  it("atomically upserts and removes one Action execution binding", () => {
    const { daemon } = setup(); daemon.heartbeat(heartbeat());
    const first = daemon.putActionBinding("action-1", {
      provider: "codex", policy: { network: false, readOnlyRoots: ["/tmp/reference"] },
      validation: { model: "gpt", reasoningEffort: "high" },
      work: { model: "gpt", reasoningEffort: "high" }
    });
    expect(first).toEqual(expect.objectContaining({ version: 2, actionId: "action-1", provider: "codex" }));
    daemon.putActionBinding("action-1", {
      provider: "copilot", policy: { network: true, readOnlyRoots: [] },
      validation: { model: "claude", reasoningEffort: "high" },
      work: { model: "claude", reasoningEffort: "high" }
    });
    expect(daemon.actionBinding("action-1")).toEqual(expect.objectContaining({
      provider: "copilot", policy: { network: true, readOnlyRoots: [] },
      validation: { model: "claude", reasoningEffort: "high" }, work: { model: "claude", reasoningEffort: "high" }
    }));
    daemon.removeActionBindings(["action-1"]);
    expect(daemon.actionBinding("action-1")).toBeUndefined();
  });

  it("rejects unsupported Action-role model, reasoning, and policy selections", () => {
    const { daemon } = setup(); const reports = heartbeat();
    reports.providers[0] = { ...reports.providers[0]!, capabilities: { ...reports.providers[0]!.capabilities,
      policy: { workspaceWrite: true, networkControl: false, readOnlyRoots: false } } };
    daemon.heartbeat(reports);
    const put = (model: string, reasoningEffort: string, network = false, roots: string[] = []) =>
      daemon.putActionBinding("action-1", {
        provider: "codex", policy: { network, readOnlyRoots: roots },
        validation: { model, reasoningEffort }, work: { model: "gpt", reasoningEffort: "high" }
      });
    expect(() => put("missing", "high")).toThrow(/unavailable/);
    expect(() => put("gpt", "missing")).toThrow(/Reasoning effort/);
    expect(() => put("gpt", "high", true)).toThrow(/network policy/);
    expect(() => put("gpt", "high", false, ["/tmp/reference"])).toThrow(/read-only roots/);
    reports.providers[0] = { ...reports.providers[0]!, capabilities: { ...reports.providers[0]!.capabilities,
      policy: { workspaceWrite: false, networkControl: true, readOnlyRoots: true } } };
    daemon.heartbeat(reports);
    expect(() => put("gpt", "high")).toThrow(/workspace-write/);
  });

  it("claims once, fences stale callbacks, and applies one daemon terminal", () => {
    const { daemon, execution } = setup();
    expect(execution.claimTask("execution-task-1", TEST_AT)).toBe(true);
    const claim = daemon.claim("codex"); expect(claim).toEqual(expect.objectContaining({ taskId: "execution-task-1", fencing: 1 }));
    expect(daemon.claim("codex")).toBeUndefined();
    expect(daemon.appendEvents(claim!.taskId, claim!.fencing, [{
      sequence: 1, source: "codex", kind: "agent", level: "info", phase: "completed",
      message: "done", terminal: true, createdAt: TEST_AT
    }])).toBe(1);
    expect(() => daemon.appendEvents(claim!.taskId, 2, [{
      sequence: 2, source: "codex", kind: "agent", level: "info", phase: "completed",
      message: "stale", terminal: true, createdAt: TEST_AT
    }])).toThrow(/stale or expired/);
    expect(daemon.complete(claim!.taskId, 1, "codex:terminal", "{\"done\":true}")).toBe(true);
    expect(daemon.complete(claim!.taskId, 1, "codex:terminal", "{\"done\":true}")).toBe(false);
    expect(() => daemon.fail(claim!.taskId, 1, "codex:other", "late")).toThrow(/different daemon terminal/);
  });

  it("fails closed after lease expiry and never reclaims an active provider side effect", () => {
    let now = new Date(TEST_AT); const { daemon, execution } = setup(() => now);
    execution.claimTask("execution-task-1", TEST_AT); const claim = daemon.claim("codex")!;
    now = new Date(new Date(claim.leaseUntil).getTime() + 1);
    expect(daemon.leaseExpired(claim.taskId)).toBe(true);
    expect(daemon.renew(claim.taskId, claim.fencing)).toEqual({ accepted: false, cancelRequested: false });
    expect(daemon.claim("codex")).toBeUndefined();
    expect(() => daemon.complete(claim.taskId, claim.fencing, "late", "late" )).toThrow(/stale or expired/);
  });

  it("rejects restart from persisted claimed work rather than heartbeat lag", () => {
    const { daemon, execution } = setup(); daemon.heartbeat(heartbeat());
    execution.claimTask("execution-task-1", TEST_AT); daemon.claim("codex");
    expect(() => daemon.request("restart")).toThrow(/cannot restart/);
  });

  it("rolls back a heartbeat when one provider report is invalid", () => {
    const { daemon, database } = setup(); const invalid = heartbeat();
    invalid.providers[1] = { ...invalid.providers[1]!, health: "ready", capabilities: { ...invalid.providers[1]!.capabilities,
      models: [{ id: "", label: "bad", reasoningOptions: [] }] } };
    expect(() => daemon.heartbeat(invalid)).toThrow();
    expect(database.connection.prepare("SELECT COUNT(*) AS count FROM local_daemon_state").get()).toEqual({ count: 0 });
  });
});

const setup = (now = () => new Date(TEST_AT)) => {
  const database = openTestDatabase(); databases.push(database);
  const flow = new FlowCoordinator(() => database.connection);
  const outcomes = new ActionOutcomeCoordinator(() => database.connection);
  flow.createEnvironmentRun(environmentSeed({ stateCount: 1 }));
  const action = flow.advance("run-1", 0, TEST_AT); const agent = agentRunInput("precheck-1", "precheck", 1);
  outcomes.createPrecheck(action.actionExecutionId, action.revision, agent);
  const execution = new AgentExecutionStore(() => database.connection);
  const task = spec(agent.taskEnvelopeHash); execution.createTask({ spec: task, specHash: hash(task) });
  return { database, execution, daemon: new LocalDaemonStore(() => database.connection, now) };
};

const spec = (envelopeHash: string): ExecutionSpecV15 => {
  const prompt = "Validate the Action";
  return {
    version: 15, taskId: "execution-task-1", kind: "agent_execution", environmentRunId: "run-1",
    actionExecutionId: "action-execution-1", agentRunId: "precheck-1",
    evidence: { compositionVersion: 13, role: "validation", phase: "precheck",
      subject: { kind: "action_role", actionId: "action-1", role: "validation" }, resources: [], prompt, promptSha256: sha256(prompt),
      taskEnvelopeVersion: 11, taskEnvelopeSha256: envelopeHash, outputSchemaVersion: 11,
      outputSchemaId: "validation-outcome-v11", outputSchemaSha256: HASH_A },
    runtime: { subject: { kind: "action_role", actionId: "action-1", role: "validation" }, provider: "codex", cliVersion: "1.0.0", model: "gpt",
      reasoningEffort: "high", capabilityHash: HASH_A },
    permissions: { workspaceAccess: "read-only", networkAccess: false, readOnlyRoots: [], approvalPolicy: "never" },
    project: { checkoutRoot: "/tmp/worktree", headSha: TEST_SHA, configHash: HASH_A, snapshotHash: HASH_A },
    createdAt: TEST_AT
  };
};
const provider = (runtime: "codex" | "copilot"): LocalProviderStatus => ({
  provider: runtime, cliVersion: "1.0.0", authStatus: "ready", health: "ready", busy: false, updatedAt: TEST_AT,
  capabilities: { models: [{ id: runtime === "codex" ? "gpt" : "claude", label: "Model", reasoningOptions: ["high"] }],
    supportsResume: true, supportsStructuredOutput: true,
    policy: { workspaceWrite: true, networkControl: true, readOnlyRoots: true }, refreshedAt: TEST_AT }
});
const heartbeat = (): LocalDaemonHeartbeat => ({ pid: 123, daemonVersion: "1.0.0", uptimeSeconds: 1,
  activeTaskCount: 0, providers: [provider("codex"), provider("copilot")] });
