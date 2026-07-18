import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultAgentStepTransitions, defaultTerminalNodes, type ProjectAgentStepTransitions, type ProjectAutomationConfig, type StepTransitionTarget } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome } from "../../shared/domain/runtime.js";
import { RuntimeDatabase, isPatchedSqliteVersion } from "../runtime-db.js";
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
  ready: success,
  approved: success,
  "changes-requested": options.repair ? { repair: options.repair } : { terminate: "blocked" },
  needs_input: options.human ? { human: options.human } : { wait: true }
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
      on: { approved: { loop: "release" }, rejected: "implement" }
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

const engineeringChainConfig = (): ProjectAutomationConfig => {
  const terminals = () => defaultTerminalNodes();
  return {
    version: 8,
    loops: [{
      id: "blueprint-design",
      start: "roadmap",
      nodes: [
        { id: "roadmap", type: "agent", agentId: "roadmap-agent", description: "Roadmap.", nodeStyle: "sol", nodeSize: "large", on: agentOn("data-model", { human: "blueprint-gate" }) },
        { id: "data-model", type: "agent", agentId: "architecture-agent", description: "Data model.", nodeStyle: "sol", nodeSize: "large", on: agentOn("ui-design", { human: "blueprint-gate" }) },
        { id: "ui-design", type: "agent", agentId: "ui-design-agent", description: "UI design.", nodeStyle: "sol", nodeSize: "large", on: agentOn("ui-mocks", { human: "blueprint-gate" }) },
        { id: "ui-mocks", type: "agent", agentId: "ui-design-agent", description: "UI mocks.", nodeStyle: "sol", nodeSize: "large", on: agentOn("c4-models", { human: "blueprint-gate" }) },
        { id: "c4-models", type: "agent", agentId: "architecture-agent", description: "C4.", nodeStyle: "sol", nodeSize: "large", on: agentOn("blueprint-gate", { human: "blueprint-gate" }) },
        { id: "blueprint-gate", type: "human", description: "Approve blueprint.", nodeStyle: "luna", nodeSize: "tiny", on: { approved: { loop: "milestone-planning" }, rejected: "roadmap" } },
        ...terminals()
      ]
    }, {
      id: "milestone-planning",
      start: "plan-milestone-issues",
      nodes: [
        { id: "plan-milestone-issues", type: "agent", agentId: "milestone-issues-agent", description: "Plan milestone.", nodeStyle: "luna", nodeSize: "medium", on: agentOn("implementation-plan", { human: "milestone-gate" }) },
        { id: "implementation-plan", type: "agent", agentId: "implementation-plan-agent", description: "Implementation plan.", nodeStyle: "luna", nodeSize: "medium", on: agentOn("test-plan", { human: "milestone-gate" }) },
        { id: "test-plan", type: "agent", agentId: "test-plan-agent", description: "Test plan.", nodeStyle: "luna", nodeSize: "medium", on: agentOn("milestone-gate", { human: "milestone-gate" }) },
        { id: "milestone-gate", type: "human", description: "Approve milestone.", nodeStyle: "luna", nodeSize: "tiny", on: { approved: { loop: "milestone-delivery" }, rejected: "plan-milestone-issues" } },
        ...terminals()
      ]
    }, {
      id: "milestone-delivery",
      start: "implement-milestone",
      nodes: [
        { id: "implement-milestone", type: "agent", agentId: "implementation-agent", description: "Implement milestone.", nodeStyle: "terra", nodeSize: "medium", on: agentOn("run-acceptance-tests", { human: "implementation-gate" }) },
        { id: "run-acceptance-tests", type: "agent", agentId: "acceptance-test-agent", description: "Run acceptance.", nodeStyle: "terra", nodeSize: "medium", on: agentOn("implementation-gate", { repair: "implement-milestone", human: "implementation-gate" }) },
        { id: "implementation-gate", type: "human", description: "Approve implementation.", nodeStyle: "luna", nodeSize: "tiny", on: { approved: { loop: "release-validation" }, rejected: "implement-milestone" } },
        ...terminals()
      ]
    }, {
      id: "release-validation",
      start: "make-git-release",
      nodes: [
        { id: "make-git-release", type: "agent", agentId: "release-agent", description: "Make release.", nodeStyle: "terra", nodeSize: "medium", on: agentOn("deploy-release", { human: "release-gate" }) },
        { id: "deploy-release", type: "agent", agentId: "release-agent", description: "Deploy release.", nodeStyle: "terra", nodeSize: "medium", on: agentOn("verify-release", { human: "release-gate" }) },
        { id: "verify-release", type: "agent", agentId: "release-agent", description: "Verify release.", nodeStyle: "terra", nodeSize: "medium", on: agentOn("release-gate", { human: "release-gate" }) },
        { id: "release-gate", type: "human", description: "Approve release.", nodeStyle: "luna", nodeSize: "tiny", on: { approved: "completed", rejected: "verify-release" } },
        ...terminals()
      ]
    }]
  };
};

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
          on: { approved: "completed", rejected: "blocked" }
        }, ...defaultTerminalNodes()]
      }]
    };
    const started = startLoop(runtime, automation, "human-terminal");
    const completed = runtime.respondToStepRun(
      automation, openAiTheme, started.runId, started.stepRuns[0]!.stepRunId, "rejected", "Not accepted."
    );

    expect(completed.status).toBe("blocked");
    expect(completed.termination).toMatchObject({
      code: "human_rejected",
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
      source: "human",
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
    expect(Object.keys(storedSnapshot).sort()).toEqual(["loop", "theme"]);
    expect(storedSnapshot).toEqual({
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

  it("runs the complete four-Loop chain under one root and keeps release-gate rejection in verification", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = engineeringChainConfig();
    const handoff = [
      "milestone_id: milestone-001",
      "github_issue: isinisalo/ballet#123",
      "github_issue: isinisalo/ballet#124"
    ].join("\n");
    let blueprint = startLoop(runtime, automation, "blueprint-design", openAiTheme, "Build the next increment.");

    for (let index = 0; index < 5; index += 1) {
      blueprint = runtime.completeAgentStep(automation, openAiTheme, {
        stepRunId: blueprint.stepRuns.at(-1)!.stepRunId,
        outcome: ready
      });
    }
    const blueprintGate = blueprint.stepRuns.at(-1)!;
    expect(blueprintGate.stepId).toBe("blueprint-gate");
    runtime.respondToStepRun(automation, openAiTheme, blueprint.runId, blueprintGate.stepRunId, "approved", handoff);

    let milestone = latestRun(runtime, "milestone-planning")!;
    for (let index = 0; index < 3; index += 1) {
      milestone = runtime.completeAgentStep(automation, openAiTheme, {
        stepRunId: milestone.stepRuns.at(-1)!.stepRunId,
        outcome: ready
      });
    }
    runtime.respondToStepRun(automation, openAiTheme, milestone.runId, milestone.stepRuns.at(-1)!.stepRunId, "approved", "Milestone scope approved.");

    let delivery = latestRun(runtime, "milestone-delivery")!;
    for (let index = 0; index < 2; index += 1) {
      delivery = runtime.completeAgentStep(automation, openAiTheme, {
        stepRunId: delivery.stepRuns.at(-1)!.stepRunId,
        outcome: ready
      });
    }
    runtime.respondToStepRun(automation, openAiTheme, delivery.runId, delivery.stepRuns.at(-1)!.stepRunId, "approved", "Implementation approved.");

    let release = latestRun(runtime, "release-validation")!;
    for (let index = 0; index < 3; index += 1) {
      release = runtime.completeAgentStep(automation, openAiTheme, {
        stepRunId: release.stepRuns.at(-1)!.stepRunId,
        outcome: ready
      });
    }
    expect(release.stepRuns.at(-1)).toMatchObject({ stepId: "release-gate", status: "waiting_for_human" });
    release = runtime.respondToStepRun(automation, openAiTheme, release.runId, release.stepRuns.at(-1)!.stepRunId, "rejected", "Collect stronger production evidence.");
    expect(release.stepRuns.at(-1)).toMatchObject({ stepId: "verify-release", status: "queued" });
    release = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: release.stepRuns.at(-1)!.stepRunId,
      outcome: ready
    });
    release = runtime.respondToStepRun(automation, openAiTheme, release.runId, release.stepRuns.at(-1)!.stepRunId, "approved", "Release evidence accepted.");

    expect(release.status).toBe("completed");
    expect(release.stepRuns.filter((step) => step.stepId === "make-git-release")).toHaveLength(1);
    expect(new Set(runtime.listRootLoopRuns(blueprint.rootRunId).map((run) => run.rootRunId))).toEqual(new Set([blueprint.rootRunId]));
    expect(runtime.listRootLoopRuns(blueprint.rootRunId).map((run) => run.loopId)).toEqual([
      "blueprint-design",
      "milestone-planning",
      "milestone-delivery",
      "release-validation"
    ]);
    expect(runtime.listRootLoopRuns(blueprint.rootRunId).every((run) => run.status === "completed")).toBe(true);
    runtime.close();
  });

  it("rejects a gated cross-Loop transition without a milestone handoff", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = engineeringChainConfig();
    let blueprint = startLoop(runtime, automation, "blueprint-design");
    for (let index = 0; index < 5; index += 1) {
      blueprint = runtime.completeAgentStep(automation, openAiTheme, {
        stepRunId: blueprint.stepRuns.at(-1)!.stepRunId,
        outcome: ready
      });
    }

    expect(() => runtime.respondToStepRun(
      automation,
      openAiTheme,
      blueprint.runId,
      blueprint.stepRuns.at(-1)!.stepRunId,
      "approved",
      "Continue without selecting a milestone."
    )).toThrow("milestone_id");
    expect(runById(runtime, blueprint.runId)).toMatchObject({ status: "waiting_for_human" });
    expect(latestRun(runtime, "milestone-planning")).toBeUndefined();
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

  it("blocks a root run after the 20-transition safety limit", async () => {
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
    for (let index = 0; index < 21 && details.status === "running"; index += 1) {
      const step = details.stepRuns.at(-1)!;
      details = runtime.completeAgentStep(cyclic, openAiTheme, { stepRunId: step.stepRunId, outcome: ready });
    }
    expect(details.status).toBe("blocked");
    expect(details.transitionCount).toBe(20);
    expect(details.termination).toMatchObject({ code: "transition_limit_exceeded", limit: 20, count: 21 });
    expect(details.stepRuns).toHaveLength(21);
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
      transition: { signal: { kind: "agent", outcome: "ready" }, action: "transition", target: "verify" }
    });
    expect(advanced.stepRuns.at(-1)).toMatchObject({ stepId: "verify", status: "queued" });
    runtime.close();
  });

  it("routes approved independently from ready for a verifier step", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const automation = twoAgentConfig();
    const first = automation.loops[0]!.nodes[0]!;
    if (first.type !== "agent") throw new Error("Expected agent fixture.");
    first.on.approved = "completed";
    const started = startLoop(runtime, automation, "outcome-flow");
    const completed = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome: { outcome: "approved", summary: "Verification passed.", checks: [] }
    });

    expect(completed.status).toBe("completed");
    expect(completed.stepRuns).toHaveLength(1);
    expect(completed.stepRuns[0]).toMatchObject({
      result: { kind: "agent", outcome: "approved" },
      transition: { action: "transition", target: "completed" }
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
      transition: { action: "human", target: "gate" }
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
    first.on.needs_input = { wait: true };
    const started = startLoop(runtime, automation, "outcome-flow", openAiTheme, "Build the feature.");
    const waiting = runtime.completeAgentStep(automation, openAiTheme, {
      stepRunId: started.stepRuns[0]!.stepRunId,
      outcome: { outcome: "needs_input", summary: "Which storage engine should I use?", checks: [] }
    });

    expect(waiting).toMatchObject({ status: "waiting_for_human", transitionCount: 0 });
    expect(waiting.stepRuns[0]).toMatchObject({
      status: "waiting_for_human",
      result: { kind: "agent", outcome: "needs_input" },
      transition: { action: "wait", reason: "needs_input" }
    });
    expect(waiting.stepRuns[0]!.completedAt).toBeUndefined();

    const resumed = runtime.resumeAgentStepRun(
      waiting.runId,
      waiting.stepRuns[0]!.stepRunId,
      "Use SQLite."
    );
    expect(resumed).toMatchObject({ status: "running", input: "Build the feature.\n\nUse SQLite.", transitionCount: 1 });
    expect(resumed.stepRuns[0]).toMatchObject({
      status: "completed",
      responseInput: "Use SQLite.",
      result: { kind: "agent", outcome: "needs_input" },
      transition: { action: "resume", target: "implement" }
    });
    expect(resumed.stepRuns.at(-1)).toMatchObject({
      stepId: "implement",
      status: "queued",
      input: "Build the feature.\n\nUse SQLite."
    });
    expect(() => runtime.resumeAgentStepRun(
      waiting.runId,
      waiting.stepRuns[0]!.stepRunId,
      "Duplicate response."
    )).toThrow(LoopRunConflictError);
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
      expect(completed.termination).toMatchObject({
        code: status === "blocked" ? "agent_blocked" : "agent_failed",
        message: `${status} reason`
      });
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
      code: "changes_requested",
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
    expect(details.termination).toMatchObject({ code: "repair_limit_exceeded", limit: 3, count: 4, target: "implement" });
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
    expect(details.termination).toMatchObject({ code: "stalled_repair", target: "implement" });
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
    expect(details.termination).toMatchObject({ code: "agent_failed", message: "Provider still unavailable." });
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
    if (target) first.on.ready = target;
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
      on: { approved: "completed", rejected: "implement" }
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
