import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultAgentStepTransitions,
  defaultTerminalNodes,
  gotoTransition,
  terminateTransition,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome, LoopRunDetails } from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";

const roots: string[] = [];

const databasePath = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-runtime-compatibility-"));
  roots.push(root);
  return path.join(root, "runtime.sqlite");
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("persisted transition compatibility", () => {
  it("migrates an unversioned opinionated snapshot and resumes a legacy wait", async () => {
    const file = await databasePath();
    let runtime = new RuntimeDatabase(file);
    const automation = compatibilityConfig();
    let details = start(runtime, automation);
    details = runtime.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: details.stepRuns[0]!.stepRunId,
      outcome: outcome("needs_input", "Which database?")
    });
    const waiting = details.stepRuns[0]!;
    const legacyLoop = structuredClone(details.snapshot) as unknown as {
      nodes: Array<{ id: string; on: unknown }>;
    };
    legacyLoop.nodes.find((node) => node.id === "work")!.on = {
      ready: "completed",
      approved: "completed",
      "changes-requested": { repair: "repair" },
      needs_input: { wait: true },
      blocked: { terminal: "blocked" },
      failed: { terminal: "failed", retry: { when: "transient", limit: 1 } }
    };
    runtime.connection().prepare("UPDATE loop_runs SET snapshot_json = ?, source = 'human' WHERE run_id = ?")
      .run(JSON.stringify({ loop: legacyLoop, theme: defaultLoopTheme }), details.runId);
    runtime.connection().prepare("UPDATE step_runs SET transition_json = ? WHERE step_run_id = ?")
      .run(JSON.stringify({ signal: waiting.result, action: "wait" }), waiting.stepRunId);
    runtime.close();

    runtime = new RuntimeDatabase(file);
    const restored = runtime.listLoopRuns().find((candidate) => candidate.runId === details.runId)!;
    expect(restored.source).toBe("transition");
    expect(restored.snapshot.nodes.find((node) => node.id === "work")).toMatchObject({
      on: { needs_input: { action: "wait", resume: "same-step", input: "append-signal" } }
    });
    const resumed = runtime.resumeStepRun(
      automation,
      defaultLoopTheme,
      restored.runId,
      restored.stepRuns[0]!.stepRunId,
      "Use SQLite."
    );
    expect(resumed.stepRuns.at(-1)).toMatchObject({ stepId: "work", status: "queued" });
    runtime.close();
  });

  it("keeps legacy repair evidence in the configured stall policy history", async () => {
    const file = await databasePath();
    let runtime = new RuntimeDatabase(file);
    const automation = compatibilityConfig();
    let details = start(runtime, automation);
    const repeated = changesRequested();
    details = runtime.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: details.stepRuns[0]!.stepRunId,
      outcome: repeated
    });
    const first = details.stepRuns[0]!;
    if (first.transition?.action !== "retry") throw new Error("Expected retry transition.");
    runtime.connection().prepare("UPDATE step_runs SET transition_json = ? WHERE step_run_id = ?")
      .run(JSON.stringify({
        signal: first.result,
        action: "repair",
        target: "repair",
        repairAttempt: 1,
        evidenceFingerprint: first.transition.evidenceFingerprint
      }), first.stepRunId);
    runtime.close();

    runtime = new RuntimeDatabase(file);
    details = runtime.listLoopRuns().find((candidate) => candidate.runId === details.runId)!;
    details = runtime.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: outcome("ready")
    });
    details = runtime.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: repeated
    });
    expect(details).toMatchObject({
      status: "blocked",
      termination: { code: "retry_stalled", count: 2, limit: 3 }
    });
    runtime.close();
  });

  it("counts a legacy transient retry when enforcing the configured maximum", async () => {
    const file = await databasePath();
    let runtime = new RuntimeDatabase(file);
    const automation = compatibilityConfig();
    let details = start(runtime, automation);
    details = runtime.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: details.stepRuns[0]!.stepRunId,
      outcome: transientFailure()
    });
    const first = details.stepRuns[0]!;
    runtime.connection().prepare("UPDATE step_runs SET transition_json = ? WHERE step_run_id = ?")
      .run(JSON.stringify({ signal: first.result, action: "retry", target: "work", retryAttempt: 1 }), first.stepRunId);
    runtime.close();

    runtime = new RuntimeDatabase(file);
    details = runtime.listLoopRuns().find((candidate) => candidate.runId === details.runId)!;
    details = runtime.completeAgentStep(automation, defaultLoopTheme, {
      stepRunId: details.stepRuns.at(-1)!.stepRunId,
      outcome: transientFailure()
    });
    expect(details).toMatchObject({
      status: "failed",
      termination: { code: "retry_exhausted", count: 2, limit: 1 }
    });
    expect(details.stepRuns).toHaveLength(2);
    runtime.close();
  });
});

const start = (runtime: RuntimeDatabase, automation: ProjectAutomationConfig): LoopRunDetails => {
  const rootRunId = randomUUID();
  const timestamp = new Date().toISOString();
  runtime.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, created_at, updated_at
    ) VALUES (?, 'loop', 'compatibility', 'manual', 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?)
  `).run(rootRunId, `/tmp/${rootRunId}`, `ballet/run/${rootRunId}`, "a".repeat(40), timestamp, timestamp);
  return runtime.startLoopRun(automation, "compatibility", defaultLoopTheme, rootRunId, "Initial request.");
};

const compatibilityConfig = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "compatibility",
    start: "work",
    nodes: [{
      id: "work", type: "agent", agentId: "worker", description: "Work.", nodeStyle: "terra", nodeSize: "medium",
      on: {
        ...defaultAgentStepTransitions(),
        ready: terminateTransition("completed"),
        approved: terminateTransition("completed"),
        "changes-requested": {
          action: "retry",
          target: "repair",
          policy: {
            maxAttempts: 3,
            stallDetection: "same-evidence",
            onExhausted: terminateTransition("blocked")
          }
        },
        needs_input: { action: "wait", resume: "same-step", input: "append-signal" }
      }
    }, {
      id: "repair", type: "agent", agentId: "worker", description: "Repair.", nodeStyle: "flat", nodeSize: "medium",
      on: { ...defaultAgentStepTransitions(), ready: gotoTransition("work"), approved: gotoTransition("work") }
    }, ...defaultTerminalNodes()]
  }]
});

const outcome = (value: AgentOutcome["outcome"], summary = `${value}.`): AgentOutcome => ({
  outcome: value,
  summary,
  checks: []
});

const changesRequested = (): AgentOutcome => ({
  outcome: "changes-requested",
  summary: "The same check still fails.",
  artifacts: { changed_files: ["evidence.txt"] },
  checks: [{ name: "verification", status: "failed", details: "Same evidence." }]
});

const transientFailure = (): AgentOutcome => ({
  outcome: "failed",
  summary: "Provider is temporarily unavailable.",
  failure: { classification: "transient", code: "provider_busy" },
  checks: []
});
