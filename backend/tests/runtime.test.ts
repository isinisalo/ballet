import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultAgentStepTransitions, defaultTerminalNodes, gotoTransition, terminateTransition, type ProjectAgentStepTransitions, type ProjectAutomationConfig, type StepTransitionTarget } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome } from "../../shared/domain/runtime.js";
import { RuntimeDatabase, isPatchedSqliteVersion } from "../runtime-db.js";
import { MAX_ROOT_TRANSITIONS } from "../runtime/RuntimeDbTypes.js";
import { LoopRunConflictError } from "../runtime/LoopRunErrors.js";

const roots: string[] = [];
const tempDbPath = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-v8-"));
  roots.push(root);
  return path.join(root, "runtime.sqlite");
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const ready: AgentOutcome = {
  outcome: "ready",
  summary: "Done.",
  checks: [{ name: "test", status: "passed" }]
};
const openAiTheme = defaultLoopTheme;
const agentOn = (
  success: StepTransitionTarget,
  options: { repair?: string; human?: string } = {}
): ProjectAgentStepTransitions => ({
  ...defaultAgentStepTransitions(),
  ready: gotoTransition(success),
  approved: gotoTransition(success),
  "changes-requested": options.repair ? {
    action: "retry", target: options.repair,
    policy: { maxAttempts: 3, stallDetection: "same-evidence", onExhausted: terminateTransition("blocked") }
  } : terminateTransition("blocked"),
  needs_input: options.human ? gotoTransition(options.human, "signal") : { action: "wait", resume: "same-step", input: "append-signal" }
});

const startLoop = (
  runtime: RuntimeDatabase,
  automation: ProjectAutomationConfig,
  loopId: string,
  theme = openAiTheme,
  input?: string
) => {
  const rootRunId = randomUUID();
  const timestamp = new Date().toISOString();
  runtime.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, created_at, updated_at
    ) VALUES (?, 'loop', ?, 'manual', 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?)
  `).run(rootRunId, loopId, `/tmp/${rootRunId}`, `ballet/run/${rootRunId}`, "a".repeat(40), timestamp, timestamp);
  return runtime.startLoopRun(automation, loopId, theme, rootRunId, input);
};

const config = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "delivery",
    start: "implement",
    nodes: [{
      id: "implement",
      type: "agent",
      agentId: "developer-agent",
      description: "Implement.",
      nodeStyle: "terra",
      nodeSize: "medium",
      on: agentOn("gate", { human: "gate" })
    }, {
      id: "gate",
      type: "human",
      description: "Approve.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      on: { approved: gotoTransition({ loop: "release" }, "append-signal"), rejected: { action: "retry", target: "implement", input: "append-signal", policy: { maxAttempts: 3, onExhausted: terminateTransition("blocked") } } }
    }, ...defaultTerminalNodes()]
  }, {
    id: "release",
    start: "publish",
    nodes: [{
      id: "publish",
      type: "agent",
      agentId: "release-agent",
      description: "Publish.",
      nodeStyle: "terra",
      nodeSize: "medium",
      on: agentOn("completed")
    }, ...defaultTerminalNodes()]
  }]
});

const runById = (runtime: RuntimeDatabase, runId: string) =>
  runtime.listLoopRuns().find((run) => run.runId === runId);
const latestRun = (runtime: RuntimeDatabase, loopId: string) =>
  runtime.listLoopRuns().find((run) => run.loopId === loopId);

describe("terminal node runtime transitions", () => {
  it.each(["completed", "blocked", "failed"] as const)("resolves a node-id transition to the %s terminal", async (terminal) => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: `terminal-${terminal}`,
        start: "work",
        nodes: [{
          id: "work",
          type: "agent",
          agentId: "developer-agent",
          description: "Work.",
          nodeStyle: "flat",
          nodeSize: "medium",
          on: agentOn(terminal)
        }, ...defaultTerminalNodes()]
      }]
    };
    const started = startLoop(runtime, automation, `terminal-${terminal}`);
    const outcome: AgentOutcome = {
      outcome: terminal === "completed" ? "ready" : terminal,
      summary: `${terminal}.`,
      checks: []
    };
    const completed = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome
    });

    expect(completed.status).toBe(terminal);
    expect(completed.stepRuns).toHaveLength(1);
    expect(completed.stepRuns[0]).toMatchObject({
      result: { kind: "agent", outcome: terminal === "completed" ? "ready" : terminal },
      status: terminal === "completed" ? "completed" : terminal
    });
    runtime.close();
  });

  it("keeps a rejected human decision distinct when it reaches a blocked terminal", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "human-terminal",
        start: "gate",
        nodes: [{
          id: "gate", type: "human", description: "Decide.", nodeStyle: "luna", nodeSize: "tiny",
          on: { approved: gotoTransition("completed", "append-signal"), rejected: gotoTransition("blocked", "append-signal") }
        }, ...defaultTerminalNodes()]
      }]
    };
    const started = startLoop(runtime, automation, "human-terminal");
    const completed = runtime.respondToStepRun(
      automation, openAiTheme, started.runId, started.stepRuns[0]!.stepRunId, "rejected", "Not accepted."
    );

    expect(completed.status).toBe("blocked");
    expect(completed.termination).toMatchObject({
      code: "terminal_reached",
      signal: { kind: "human", decision: "rejected" }
    });
    runtime.close();
  });
});

describe("local runtime database", () => {
  it("recognizes patched SQLite versions", () => {
    expect(isPatchedSqliteVersion("3.51.3")).toBe(true);
    expect(isPatchedSqliteVersion("3.51.2")).toBe(false);
  });

  it("runs agent and human steps, creates a distinct step run for a cycle, and keeps one active run per loop", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const started = startLoop(runtime, config(), "delivery", openAiTheme, "Build release 1");
    expect(started).toMatchObject({
      status: "running",
      input: "Build release 1",
      snapshot: { id: "delivery" },
      themeSnapshot: openAiTheme
    });
    expect(() => startLoop(runtime, config(), "delivery")).toThrow(LoopRunConflictError);

    const first = started.stepRuns[0]!;
    expect(first).toMatchObject({ stepId: "implement", status: "queued" });
    const waiting = runtime.completeAgentStep(config(), openAiTheme, { stepRunId: first.stepRunId, outcome: ready });
    expect(waiting.status).toBe("waiting_for_human");
    const gate = waiting.stepRuns.at(-1)!;
    const cycled = runtime.respondToStepRun(config(), openAiTheme, waiting.runId, gate.stepRunId, "rejected", "Please revise tests");
    expect(cycled.status).toBe("running");
    expect(cycled.input).toContain("Build release 1");
    expect(cycled.input).toContain("Please revise tests");
    expect(cycled.stepRuns.filter((step) => step.stepId === "implement")).toHaveLength(2);
    expect(new Set(cycled.stepRuns.map((step) => step.stepRunId)).size).toBe(cycled.stepRuns.length);
    runtime.close();
  });

  it("starts a linked child run from a human transition and forwards accumulated input", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const parent = startLoop(runtime, config(), "delivery", openAiTheme, "Original request");
    const agentStep = parent.stepRuns[0]!;
    const waiting = runtime.completeAgentStep(config(), openAiTheme, { stepRunId: agentStep.stepRunId, outcome: ready });
    const gate = waiting.stepRuns.at(-1)!;
    const completedParent = runtime.respondToStepRun(config(), openAiTheme, parent.runId, gate.stepRunId, "approved", "Ship it");
    expect(completedParent.status).toBe("completed");
    const child = latestRun(runtime, "release")!;
    expect(child).toMatchObject({
      rootRunId: parent.rootRunId,
      parentRunId: parent.runId,
      parentStepRunId: gate.stepRunId,
      source: "transition",
      status: "running"
    });
    expect(child.input).toContain("Original request");
    expect(child.input).toContain("Ship it");
    expect(child.themeSnapshot).toEqual(openAiTheme);
    runtime.close();
  });

  it("persists immutable theme snapshots across child runs", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const initialTheme = {
      ...openAiTheme,
      node: { ...openAiTheme.node, glowColor: "#112233" }
    };
    const childTheme = {
      ...initialTheme,
      node: { ...initialTheme.node, glowColor: "#445566" }
    };
    const laterTheme = {
      ...childTheme,
      node: { ...childTheme.node, glowColor: "#778899" }
    };
    const automation = config();

    const parent = startLoop(runtime, automation, "delivery", initialTheme, "Original request");
    const storedSnapshot = JSON.parse((runtime.connection().prepare(
      "SELECT snapshot_json FROM loop_runs WHERE run_id = ?"
    ).get(parent.runId) as { snapshot_json: string }).snapshot_json) as Record<string, unknown>;
    expect(Object.keys(storedSnapshot).sort()).toEqual(["automationVersion", "loop", "theme"]);
    expect(storedSnapshot).toEqual({
      automationVersion: 8,
      loop: automation.loops[0],
      theme: initialTheme
    });

    const waiting = runtime.completeAgentStep(automation, initialTheme, {
      stepRunId: parent.stepRuns[0]!.stepRunId,
      outcome: ready
    });
    const completedParent = runtime.respondToStepRun(
      automation,
      childTheme,
      parent.runId,
      waiting.stepRuns.at(-1)!.stepRunId,
      "approved",
      "Ship it"
    );
    const child = latestRun(runtime, "release")!;
    const completedChild = runtime.completeAgentStep(automation, laterTheme, {
      stepRunId: child.stepRuns[0]!.stepRunId,
      outcome: ready
    });

    expect(completedParent).toMatchObject({ status: "completed", themeSnapshot: initialTheme });
    expect(completedChild).toMatchObject({ status: "completed", themeSnapshot: childTheme });
    expect(runById(runtime, parent.runId)?.themeSnapshot).toEqual(initialTheme);
    expect(runById(runtime, child.runId)?.themeSnapshot).toEqual(childTheme);
    runtime.close();
  });
});

describe("local runtime safeguards", () => {
  it("leaves a human gate waiting if its child loop already has an active run", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const parent = startLoop(runtime, config(), "delivery");
    const agentStep = parent.stepRuns[0]!;
    const waiting = runtime.completeAgentStep(config(), openAiTheme, { stepRunId: agentStep.stepRunId, outcome: ready });
    const gate = waiting.stepRuns.at(-1)!;
    startLoop(runtime, config(), "release");
    expect(() => runtime.respondToStepRun(config(), openAiTheme, parent.runId, gate.stepRunId, "approved", "Continue"))
      .toThrow(LoopRunConflictError);
    expect(runById(runtime, parent.runId)).toMatchObject({ status: "waiting_for_human" });
    expect(runById(runtime, parent.runId)!.stepRuns.at(-1)).toMatchObject({ status: "waiting_for_human" });
    runtime.close();
  });

  it("cancels active work and logs but ignores a late agent completion", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const run = startLoop(runtime, config(), "delivery");
    const step = run.stepRuns[0]!;
    expect(runtime.cancelLoopRun(run.runId).status).toBe("cancelled");
    const afterLate = runtime.completeAgentStep(config(), openAiTheme, { stepRunId: step.stepRunId, outcome: ready });
    expect(afterLate.status).toBe("cancelled");
    expect(afterLate.stepRuns).toHaveLength(1);
    runtime.close();
  });

  it("blocks a root run at the technical emergency transition limit", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const cyclic: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "cycle",
        start: "again",
        nodes: [{
          id: "again",
          type: "agent",
          agentId: "developer-agent",
          description: "Again.",
          nodeStyle: "terra",
          nodeSize: "medium",
          on: agentOn("again")
        }, ...defaultTerminalNodes()]
      }]
    };
    let details = startLoop(runtime, cyclic, "cycle");
    runtime.connection().prepare("UPDATE loop_runs SET transition_count = ? WHERE run_id = ?")
      .run(MAX_ROOT_TRANSITIONS, details.runId);
    details = runtime.completeAgentStep(cyclic, openAiTheme, {
      stepRunId: details.stepRuns[0]!.stepRunId,
      outcome: ready
    });
    expect(details.status).toBe("blocked");
    expect(details.transitionCount).toBe(MAX_ROOT_TRANSITIONS);
    expect(details.termination).toMatchObject({
      code: "transition_limit_exceeded",
      limit: MAX_ROOT_TRANSITIONS,
      count: MAX_ROOT_TRANSITIONS + 1
    });
    expect(details.stepRuns).toHaveLength(1);
    runtime.close();
  });

  it("routes ready to the exact next agent step without aliasing it to a human approval", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = twoAgentConfig();
    const started = startLoop(runtime, automation, "outcome-flow");
    const advanced = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome: ready
    });

    expect(advanced.stepRuns[0]).toMatchObject({
      result: { kind: "agent", outcome: "ready" },
      transition: { signal: { kind: "agent", outcome: "ready" }, action: "goto", target: "verify" }
    });
    expect(advanced.stepRuns.at(-1)).toMatchObject({ stepId: "verify", status: "queued" });
    runtime.close();
  });

  it("routes approved independently from ready for a verifier step", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = twoAgentConfig();
    const first = automation.loops[0]!.nodes[0]!;
    if (first.type !== "agent") throw new Error("Expected agent fixture.");
    first.on.approved = gotoTransition("completed");
    const started = startLoop(runtime, automation, "outcome-flow");
    const completed = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome: { outcome: "approved", summary: "Verification passed.", checks: [] }
    });

    expect(completed.status).toBe("completed");
    expect(completed.stepRuns).toHaveLength(1);
    expect(completed.stepRuns[0]).toMatchObject({
      result: { kind: "agent", outcome: "approved" },
      transition: { action: "goto", target: "completed" }
    });
    runtime.close();
  });

  it("routes needs_input to a human decision while preserving both semantic kinds", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = twoAgentConfig();
    const started = startLoop(runtime, automation, "outcome-flow");
    const waiting = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome: { outcome: "needs_input", summary: "Choose the supported path.", checks: [] }
    });

    expect(waiting.status).toBe("waiting_for_human");
    expect(waiting.stepRuns[0]).toMatchObject({
      result: { kind: "agent", outcome: "needs_input" },
      transition: { action: "goto", target: "gate" }
    });
    expect(waiting.stepRuns.at(-1)).toMatchObject({
      stepId: "gate",
      type: "human",
      input: "Choose the supported path."
    });
    const decided = runtime.respondToStepRun(automation, openAiTheme, waiting.runId, waiting.stepRuns.at(-1)!.stepRunId, "rejected", "Use the safer path.");
    expect(decided.stepRuns.find((step) => step.stepId === "gate")).toMatchObject({
      result: { kind: "human", decision: "rejected" }
    });
    runtime.close();
  });

  it("pauses and resumes an agent step when needs_input is configured to wait", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = twoAgentConfig();
    const first = automation.loops[0]!.nodes[0]!;
    if (first.type !== "agent") throw new Error("Expected agent fixture.");
    first.on.needs_input = { action: "wait", resume: "same-step", input: "append-signal" };
    const started = startLoop(runtime, automation, "outcome-flow", openAiTheme, "Build the feature.");
    const waiting = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome: { outcome: "needs_input", summary: "Which storage engine should I use?", checks: [] }
    });

    expect(waiting).toMatchObject({ status: "waiting_for_human", transitionCount: 0 });
    expect(waiting.stepRuns[0]).toMatchObject({
      status: "waiting_for_human",
      result: { kind: "agent", outcome: "needs_input" },
      transition: { action: "wait", resume: "same-step" }
    });
    expect(waiting.stepRuns[0]!.completedAt).toBeUndefined();

    const resumed = runtime.resumeStepRun(
      automation,
      openAiTheme,
      waiting.runId,
      waiting.stepRuns[0]!.stepRunId,
      "Use SQLite."
    );
    expect(resumed).toMatchObject({ status: "running", input: "Build the feature.\n\nUse SQLite.", transitionCount: 1 });
    expect(resumed.stepRuns[0]).toMatchObject({
      status: "completed",
      responseInput: "Use SQLite.",
      result: { kind: "agent", outcome: "needs_input" },
      transition: { action: "wait", resumed: { target: "implement" } }
    });
    expect(resumed.stepRuns.at(-1)).toMatchObject({
      stepId: "implement",
      status: "queued",
      input: "Build the feature.\n\nUse SQLite."
    });
    expect(() => runtime.resumeStepRun(
      automation,
      openAiTheme,
      waiting.runId,
      waiting.stepRuns[0]!.stepRunId,
      "Duplicate response."
    )).toThrow(LoopRunConflictError);
    runtime.close();
  });

  it("pauses and resumes a human decision through the same wait action", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "human-wait",
        start: "operator",
        nodes: [{
          id: "operator", type: "human", description: "Choose.", nodeStyle: "luna", nodeSize: "tiny",
          on: {
            approved: { action: "wait", resume: { target: "continue" }, input: "append-signal" },
            rejected: terminateTransition("blocked")
          }
        }, {
          id: "continue", type: "agent", agentId: "developer", description: "Continue.", nodeStyle: "terra", nodeSize: "medium",
          on: agentOn("completed")
        }, ...defaultTerminalNodes()]
      }]
    };
    const started = startLoop(runtime, automation, "human-wait", openAiTheme, "Original request.");
    const waiting = runtime.respondToStepRun(
      automation,
      openAiTheme,
      started.runId,
      started.stepRuns[0]!.stepRunId,
      "approved",
      "Proceed after confirmation."
    );

    expect(waiting).toMatchObject({ status: "waiting_for_human", input: "Original request.\n\nProceed after confirmation." });
    expect(waiting.stepRuns[0]).toMatchObject({
      type: "human",
      status: "waiting_for_human",
      result: { kind: "human", decision: "approved" },
      transition: { action: "wait", resume: { target: "continue" } },
      responseInput: "Proceed after confirmation."
    });

    const resumed = runtime.resumeStepRun(
      automation,
      openAiTheme,
      waiting.runId,
      waiting.stepRuns[0]!.stepRunId,
      "Confirmation received."
    );
    expect(resumed).toMatchObject({
      status: "running",
      input: "Original request.\n\nProceed after confirmation.\n\nConfirmation received."
    });
    expect(resumed.stepRuns[0]).toMatchObject({
      status: "completed",
      responseInput: "Proceed after confirmation.\n\nConfirmation received.",
      transition: { action: "wait", resumed: { target: "continue" } }
    });
    expect(resumed.stepRuns.at(-1)).toMatchObject({
      stepId: "continue",
      type: "agent",
      status: "queued",
      input: "Original request.\n\nProceed after confirmation.\n\nConfirmation received."
    });
    runtime.close();
  });

  it("never sends blocked or permanent failed outcomes through a configured repair step", async () => {
    for (const status of ["blocked", "failed"] as const) {
      const runtime = new RuntimeDatabase(await tempDbPath());
      const automation = repairConfig();
      const started = startLoop(runtime, automation, "repair-flow");
      const completed = runtime.completeAgentStep(automation, openAiTheme, {
        stepRunId: started.stepRuns[0]!.stepRunId,
        outcome: {
          outcome: status,
          summary: `${status} reason`,
          ...(status === "failed" ? { failure: { classification: "permanent" as const } } : {}),
          checks: []
        }
      });
      expect(completed.status).toBe(status);
      expect(completed.stepRuns).toHaveLength(1);
      expect(completed.termination).toMatchObject({ code: "configured_termination", status });
      runtime.close();
    }
  });

  it("preserves changes-requested as the structured reason when no repair is configured", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = twoAgentConfig();
    const started = startLoop(runtime, automation, "outcome-flow");
    const completed = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome: changesRequested("acceptance", "evidence.txt")
    });

    expect(completed.status).toBe("blocked");
    expect(completed.termination).toMatchObject({
      code: "configured_termination",
      signal: { kind: "agent", outcome: "changes-requested" }
    });
    expect(completed.stepRuns).toHaveLength(1);
    runtime.close();
  });

  it("allows three evidence-changing repair traversals and blocks the fourth", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = repairConfig();
    let details = startLoop(runtime, automation, "repair-flow");
    for (let index = 1; index <= 4; index += 1) {
      details = runtime.completeAgentStep(automation, openAiTheme, {
        stepRunId: details.stepRuns.at(-1)!.stepRunId,
        outcome: changesRequested(`check-${index}`, `artifact-${index}.txt`)
      });
      if (index <= 3) {
        expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "implement", status: "queued" });
        details = runtime.completeAgentStep(automation, openAiTheme, {
          stepRunId: details.stepRuns.at(-1)!.stepRunId,
          outcome: ready
        });
      }
    }

    expect(details.status).toBe("blocked");
    expect(details.stepRuns.filter((step) => step.stepId === "implement")).toHaveLength(3);
    expect(details.termination).toMatchObject({ code: "retry_exhausted", limit: 3, count: 4, target: "implement" });
    runtime.close();
  });

  it("stops a repair loop when the same failed check returns without changed evidence", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = repairConfig();
    let details = startLoop(runtime, automation, "repair-flow");
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: changesRequested("lint", "same.txt")
    });
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: ready
    });
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: changesRequested("lint", "same.txt")
    });

    expect(details.status).toBe("blocked");
    expect(details.termination).toMatchObject({ code: "retry_stalled", target: "implement" });
    runtime.close();
  });

  it("retries one explicitly transient failure and then fails without a third attempt", async () => {
    const databasePath = await tempDbPath();
    let runtime = new RuntimeDatabase(databasePath);
    const automation = twoAgentConfig();
    let details = startLoop(runtime, automation, "outcome-flow");
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns[0]!.stepRunId,
      outcome: { outcome: "failed", summary: "Temporary provider outage.", failure: { classification: "transient", code: "provider_busy" }, checks: [] }
    });
    expect(details.status).toBe("running");
    expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "implement", attempt: 2, retryOfStepRunId: details.stepRuns[0]!.stepRunId });
    runtime.close();
    runtime = new RuntimeDatabase(databasePath);
    details = runById(runtime, details.runId)!;
    expect(details.stepRuns.at(-1)).toMatchObject({ attempt: 2, retryOfStepRunId: details.stepRuns[0]!.stepRunId });
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: { outcome: "failed", summary: "Provider still unavailable.", failure: { classification: "transient", code: "provider_busy" }, checks: [] }
    });

    expect(details.status).toBe("failed");
    expect(details.stepRuns.filter((step) => step.stepId === "implement")).toHaveLength(2);
    expect(details.termination).toMatchObject({ code: "retry_exhausted", status: "failed" });
    runtime.close();
  });

  it("starts a fresh implicit retry budget after a later normal cycle entry", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = twoAgentConfig();
    const verify = automation.loops[0]!.nodes.find((node) => node.id === "verify");
    if (!verify || verify.type === "human" || verify.type === "completed" || verify.type === "blocked" || verify.type === "failed") {
      throw new Error("Expected agent verifier fixture.");
    }
    verify.on.ready = gotoTransition("implement");
    let details = startLoop(runtime, automation, "outcome-flow");
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: { outcome: "failed", summary: "First temporary outage.", failure: { classification: "transient" }, checks: [] }
    });
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: ready
    });
    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: ready
    });
    const normalCycleEntry = details.stepRuns.at(-1)!;
    expect(normalCycleEntry).toMatchObject({ stepId: "implement", attempt: 1 });
    expect(normalCycleEntry.retryOfStepRunId).toBeUndefined();

    details = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: normalCycleEntry.stepRunId,
      outcome: { outcome: "failed", summary: "Second temporary outage.", failure: { classification: "transient" }, checks: [] }
    });
    expect(details.status).toBe("running");
    expect(details.stepRuns.at(-1)).toMatchObject({
      stepId: "implement",
      attempt: 2,
      retryOfStepRunId: normalCycleEntry.stepRunId
    });
    expect(details.stepRuns.filter((step) => step.stepId === "implement")).toHaveLength(4);
    runtime.close();
  });

  it.each([
    ["missing_transition", undefined],
    ["stale_transition", "missing-step"]
  ] as const)("persists a structured %s conclusion for a defensive runtime contract failure", async (code, target) => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const canonical = twoAgentConfig();
    const broken = structuredClone(canonical) as unknown as Record<string, unknown>;
    const first = ((broken.loops as Array<{ nodes: Array<{ on: Record<string, unknown> }> }>)[0]!.nodes[0]!);
    if (target) first.on.ready = { action: "goto", target };
    else delete first.on.ready;
    const automation = broken as unknown as ProjectAutomationConfig;
    const started = startLoop(runtime, automation, "outcome-flow");
    const completed = runtime.completeAgentStep(automation, openAiTheme, { stepRunId: started.stepRuns[0]!.stepRunId, outcome: ready });
    expect(completed.status).toBe("blocked");
    expect(completed.termination).toMatchObject({ code, ...(target ? { target } : {}) });
    runtime.close();
  });

});

const twoAgentConfig = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "outcome-flow",
    start: "implement",
    nodes: [{
      id: "implement", type: "agent", agentId: "developer", description: "Implement.", nodeStyle: "terra", nodeSize: "medium",
      on: agentOn("verify", { human: "gate" })
    }, {
      id: "verify", type: "agent", agentId: "verifier", description: "Verify.", nodeStyle: "luna", nodeSize: "medium",
      on: agentOn("completed", { human: "gate" })
    }, {
      id: "gate", type: "human", description: "Decide.", nodeStyle: "luna", nodeSize: "tiny",
      on: { approved: gotoTransition("completed", "append-signal"), rejected: { action: "retry", target: "implement", input: "append-signal", policy: { maxAttempts: 3, onExhausted: terminateTransition("blocked") } } }
    }, ...defaultTerminalNodes()]
  }]
});

const repairConfig = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "repair-flow",
    start: "verify",
    nodes: [{
      id: "verify", type: "agent", agentId: "verifier", description: "Verify.", nodeStyle: "luna", nodeSize: "medium",
      on: agentOn("completed", { repair: "implement" })
    }, {
      id: "implement", type: "agent", agentId: "developer", description: "Repair.", nodeStyle: "terra", nodeSize: "medium",
      on: agentOn("verify")
    }, ...defaultTerminalNodes()]
  }]
});

const changesRequested = (check: string, file: string): AgentOutcome => ({
  outcome: "changes-requested",
  summary: `${check} failed.`,
  artifacts: { changed_files: [file] },
  checks: [{ name: check, status: "failed", details: "Still failing." }]
});
