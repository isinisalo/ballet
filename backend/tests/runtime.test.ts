import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { builtInLoopThemes, resolveLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome } from "../../shared/domain/runtime.js";
import { RuntimeDatabase, isPatchedSqliteVersion } from "../runtime-db.js";
import { LoopRunConflictError } from "../runtime/LoopRunErrors.js";
import { parseAgentOutcomeText } from "../runtime-policy.js";

const roots: string[] = [];
const tempDbPath = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-v5-"));
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
const rejected: AgentOutcome = {
  outcome: "changes-requested",
  summary: "Needs changes.",
  checks: []
};
const openAiTheme = resolveLoopTheme(builtInLoopThemes, "open-ai");

const config = (): ProjectAutomationConfig => ({
  version: 5,
  loops: [{
    id: "delivery",
    theme: "open-ai",
    start: "implement",
    steps: [{
      id: "implement",
      type: "agent",
      agentId: "developer-agent",
      description: "Implement.",
      nodeSize: "medium",
      on: { approved: "gate", rejected: { end: "failed" } }
    }, {
      id: "gate",
      type: "human",
      description: "Approve.",
      nodeSize: "small",
      on: { approved: { loop: "release" }, rejected: "implement" }
    }]
  }, {
    id: "release",
    theme: "open-ai",
    start: "publish",
    steps: [{
      id: "publish",
      type: "agent",
      agentId: "release-agent",
      description: "Publish.",
      nodeSize: "medium",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
});

describe("runtime database v5", () => {
  it("accepts patched SQLite versions and resets legacy runtime tables", async () => {
    expect(isPatchedSqliteVersion("3.51.3")).toBe(true);
    expect(isPatchedSqliteVersion("3.51.2")).toBe(false);
    const dbPath = await tempDbPath();
    const legacy = new Database(dbPath);
    legacy.exec("CREATE TABLE loop_instances (id TEXT PRIMARY KEY); INSERT INTO loop_instances VALUES ('old');");
    legacy.close();
    const runtime = new RuntimeDatabase(dbPath);
    const tables = (runtime.connection().prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name);
    expect(tables).toEqual(expect.arrayContaining(["loop_runs", "step_runs"]));
    expect(tables).not.toContain("step_run_logs");
    expect(tables).not.toContain("loop_instances");
    expect(runtime.connection().prepare(
      "SELECT value FROM control_plane_metadata WHERE key = 'schema_version'"
    ).get()).toEqual({ value: "7" });
    runtime.close();
  });

  it("records event intake without starting or advancing any loop", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const event = runtime.intakeEvent({ projectId: "project", eventType: "delivery.requested", payload: {} });
    expect(event.event.status).toBe("unassigned");
    expect(runtime.listLoopRuns()).toEqual([]);
    runtime.close();
  });

  it("isolates loop and event rows by active project in the global database", async () => {
    const dbPath = await tempDbPath();
    const first = new RuntimeDatabase(dbPath, "project-a");
    const second = new RuntimeDatabase(dbPath, "project-b");
    first.startLoopRun(config(), "delivery", openAiTheme);
    second.startLoopRun(config(), "delivery", openAiTheme);
    first.intakeEvent({ projectId: "project-a", eventType: "first", payload: {} });
    second.intakeEvent({ projectId: "project-b", eventType: "second", payload: {} });
    expect(first.listLoopRuns()).toHaveLength(1);
    expect(second.listLoopRuns()).toHaveLength(1);
    expect(first.listEventRecords().map((event) => event.eventType)).toEqual(["first"]);
    expect(second.listEventRecords().map((event) => event.eventType)).toEqual(["second"]);
    expect(() => first.intakeEvent({ projectId: "project-b", eventType: "wrong", payload: {} })).toThrow("not the active project");
    first.close();
    second.close();
  });

  it("runs agent and human steps, creates a distinct step run for a cycle, and keeps one active run per loop", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const started = runtime.startLoopRun(config(), "delivery", openAiTheme, "Build release 1");
    expect(started).toMatchObject({
      status: "running",
      input: "Build release 1",
      snapshot: { id: "delivery" },
      themeSnapshot: openAiTheme
    });
    expect(() => runtime.startLoopRun(config(), "delivery", openAiTheme)).toThrow(LoopRunConflictError);

    const first = started.stepRuns[0]!;
    expect(first).toMatchObject({ stepId: "implement", status: "queued" });
    const waiting = runtime.completeAgentStep(config(), builtInLoopThemes, { stepRunId: first.stepRunId, outcome: ready });
    expect(waiting.status).toBe("waiting_for_human");
    const gate = waiting.stepRuns.at(-1)!;
    const cycled = runtime.respondToStepRun(config(), builtInLoopThemes, waiting.runId, gate.stepRunId, "rejected", "Please revise tests");
    expect(cycled.status).toBe("running");
    expect(cycled.input).toContain("Build release 1");
    expect(cycled.input).toContain("Please revise tests");
    expect(cycled.stepRuns.filter((step) => step.stepId === "implement")).toHaveLength(2);
    expect(new Set(cycled.stepRuns.map((step) => step.stepRunId)).size).toBe(cycled.stepRuns.length);
    runtime.close();
  });

  it("starts a linked child run from a human transition and forwards accumulated input", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const parent = runtime.startLoopRun(config(), "delivery", openAiTheme, "Original request");
    const agentStep = parent.stepRuns[0]!;
    const waiting = runtime.completeAgentStep(config(), builtInLoopThemes, { stepRunId: agentStep.stepRunId, outcome: ready });
    const gate = waiting.stepRuns.at(-1)!;
    const completedParent = runtime.respondToStepRun(config(), builtInLoopThemes, parent.runId, gate.stepRunId, "approved", "Ship it");
    expect(completedParent.status).toBe("completed");
    const child = runtime.latestLoopRun("release")!;
    expect(child).toMatchObject({
      rootRunId: parent.runId,
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
      label: "Initial project theme",
      node: { ...openAiTheme.node, glowColor: "#112233" }
    };
    const childTheme = {
      ...initialTheme,
      label: "Child project theme",
      node: { ...initialTheme.node, glowColor: "#445566" }
    };
    const laterTheme = {
      ...childTheme,
      label: "Later project theme",
      node: { ...childTheme.node, glowColor: "#778899" }
    };
    const automation = config();

    const parent = runtime.startLoopRun(automation, "delivery", initialTheme, "Original request");
    const storedSnapshot = JSON.parse((runtime.connection().prepare(
      "SELECT snapshot_json FROM loop_runs WHERE run_id = ?"
    ).get(parent.runId) as { snapshot_json: string }).snapshot_json) as Record<string, unknown>;
    expect(Object.keys(storedSnapshot).sort()).toEqual(["loop", "theme"]);
    expect(storedSnapshot).toEqual({ loop: automation.loops[0], theme: initialTheme });

    const waiting = runtime.completeAgentStep(automation, [initialTheme], {
      stepRunId: parent.stepRuns[0]!.stepRunId,
      outcome: ready
    });
    const completedParent = runtime.respondToStepRun(
      automation,
      [childTheme],
      parent.runId,
      waiting.stepRuns.at(-1)!.stepRunId,
      "approved",
      "Ship it"
    );
    const child = runtime.latestLoopRun("release")!;
    const completedChild = runtime.completeAgentStep(automation, [laterTheme], {
      stepRunId: child.stepRuns[0]!.stepRunId,
      outcome: ready
    });

    expect(completedParent).toMatchObject({ status: "completed", themeSnapshot: initialTheme });
    expect(completedChild).toMatchObject({ status: "completed", themeSnapshot: childTheme });
    expect(runtime.getLoopRun(parent.runId)?.themeSnapshot).toEqual(initialTheme);
    expect(runtime.getLoopRun(child.runId)?.themeSnapshot).toEqual(childTheme);
    runtime.close();
  });

  it("leaves a human gate waiting if its child loop already has an active run", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const parent = runtime.startLoopRun(config(), "delivery", openAiTheme);
    const agentStep = parent.stepRuns[0]!;
    const waiting = runtime.completeAgentStep(config(), builtInLoopThemes, { stepRunId: agentStep.stepRunId, outcome: ready });
    const gate = waiting.stepRuns.at(-1)!;
    runtime.startLoopRun(config(), "release", openAiTheme);
    expect(() => runtime.respondToStepRun(config(), builtInLoopThemes, parent.runId, gate.stepRunId, "approved", "Continue"))
      .toThrow(LoopRunConflictError);
    expect(runtime.getLoopRun(parent.runId)).toMatchObject({ status: "waiting_for_human" });
    expect(runtime.getLoopRun(parent.runId)!.stepRuns.at(-1)).toMatchObject({ status: "waiting_for_human" });
    runtime.close();
  });

  it("leaves a human gate waiting when its child Loop theme is unavailable", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const parent = runtime.startLoopRun(config(), "delivery", openAiTheme);
    const waiting = runtime.completeAgentStep(config(), builtInLoopThemes, {
      stepRunId: parent.stepRuns[0]!.stepRunId,
      outcome: ready
    });
    const gate = waiting.stepRuns.at(-1)!;

    expect(() => runtime.respondToStepRun(config(), [], parent.runId, gate.stepRunId, "approved", "Continue"))
      .toThrow("Cannot start a loop while its theme is invalid.");
    expect(runtime.getLoopRun(parent.runId)).toMatchObject({ status: "waiting_for_human" });
    expect(runtime.latestLoopRun("release")).toBeUndefined();
    runtime.close();
  });

  it("cancels active work and logs but ignores a late agent completion", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const run = runtime.startLoopRun(config(), "delivery", openAiTheme);
    const step = run.stepRuns[0]!;
    expect(runtime.cancelLoopRun(run.runId).status).toBe("cancelled");
    const afterLate = runtime.completeAgentStep(config(), builtInLoopThemes, { stepRunId: step.stepRunId, outcome: ready });
    expect(afterLate.status).toBe("cancelled");
    expect(afterLate.stepRuns).toHaveLength(1);
    runtime.close();
  });

  it("blocks a root run after the 20-transition safety limit", async () => {
    const runtime = new RuntimeDatabase(await tempDbPath());
    const cyclic: ProjectAutomationConfig = {
      version: 5,
      loops: [{
        id: "cycle",
        theme: "open-ai",
        start: "again",
        steps: [{
          id: "again",
          type: "agent",
          agentId: "developer-agent",
          description: "Again.",
          nodeSize: "medium",
          on: { approved: "again", rejected: { end: "failed" } }
        }]
      }]
    };
    let details = runtime.startLoopRun(cyclic, "cycle", openAiTheme);
    for (let index = 0; index < 21 && details.status === "running"; index += 1) {
      const step = details.stepRuns.at(-1)!;
      details = runtime.completeAgentStep(cyclic, builtInLoopThemes, { stepRunId: step.stepRunId, outcome: ready });
    }
    expect(details.status).toBe("blocked");
    expect(details.transitionCount).toBe(20);
    expect(details.stepRuns).toHaveLength(21);
    runtime.close();
  });

});

describe("agent outcome", () => {
  it("validates structured outcome JSON", () => {
    expect(parseAgentOutcomeText(JSON.stringify(ready))).toEqual(ready);
    expect(parseAgentOutcomeText(JSON.stringify(rejected))).toEqual(rejected);
    expect(() => parseAgentOutcomeText("{bad json")).toThrow("not valid JSON");
  });
});
