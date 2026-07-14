import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
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
  version: 7,
  loops: [{
    id: "delivery",
    start: "implement",
    steps: [{
      id: "implement",
      type: "agent",
      agentId: "developer-agent",
      description: "Implement.",
      nodeStyle: "terra",
      on: { approved: "gate", rejected: { end: "failed" } }
    }, {
      id: "gate",
      type: "human",
      description: "Approve.",
      nodeStyle: "luna",
      on: { approved: { loop: "release" }, rejected: "implement" }
    }]
  }, {
    id: "release",
    start: "publish",
    steps: [{
      id: "publish",
      type: "agent",
      agentId: "release-agent",
      description: "Publish.",
      nodeStyle: "terra",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
});

const runById = (runtime: RuntimeDatabase, runId: string) =>
  runtime.listLoopRuns().find((run) => run.runId === runId);
const latestRun = (runtime: RuntimeDatabase, loopId: string) =>
  runtime.listLoopRuns().find((run) => run.loopId === loopId);

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

  it("persists immutable theme snapshots for completed parent and cross-Loop child runs", async () => {
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
    expect(storedSnapshot).toEqual({ loop: automation.loops[0], theme: initialTheme });

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

  it("blocks a root run after the 20-transition safety limit", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const cyclic: ProjectAutomationConfig = {
      version: 7,
      loops: [{
        id: "cycle",
        start: "again",
        steps: [{
          id: "again",
          type: "agent",
          agentId: "developer-agent",
          description: "Again.",
          nodeStyle: "terra",
          on: { approved: "again", rejected: { end: "failed" } }
        }]
      }]
    };
    let details = startLoop(runtime, cyclic, "cycle");
    for (let index = 0; index < 21 && details.status === "running"; index += 1) {
      const step = details.stepRuns.at(-1)!;
      details = runtime.completeAgentStep(cyclic, openAiTheme, { stepRunId: step.stepRunId, outcome: ready });
    }
    expect(details.status).toBe("blocked");
    expect(details.transitionCount).toBe(20);
    expect(details.stepRuns).toHaveLength(21);
    runtime.close();
  });

});
