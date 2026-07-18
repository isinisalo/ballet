import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome, LoopRunDetails } from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";
import {
  dataImportFixture,
  documentReviewFixture,
  incidentEscalationFixture
} from "./fixtures/platformTransitionWorkflows.js";

const roots: string[] = [];

const createRuntime = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-transition-fixture-"));
  roots.push(root);
  return new RuntimeDatabase(path.join(root, "runtime.sqlite"));
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const startLoop = (
  runtime: RuntimeDatabase,
  automation: ProjectAutomationConfig,
  loopId: string,
  input = "Fixture input."
): LoopRunDetails => {
  const rootRunId = randomUUID();
  const timestamp = new Date().toISOString();
  runtime.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, created_at, updated_at
    ) VALUES (?, 'loop', ?, 'manual', 'queued', ?, ?, ?, 'config', 'snapshot', ?, ?)
  `).run(rootRunId, loopId, `/tmp/${rootRunId}`, `ballet/run/${rootRunId}`, "a".repeat(40), timestamp, timestamp);
  return runtime.startLoopRun(automation, loopId, defaultLoopTheme, rootRunId, input);
};

const outcome = (value: AgentOutcome["outcome"], summary = `${value}.`): AgentOutcome => ({
  outcome: value,
  summary,
  ...(value === "failed" ? { failure: { classification: "permanent" as const } } : {}),
  checks: []
});

const completeLatest = (
  runtime: RuntimeDatabase,
  automation: ProjectAutomationConfig,
  details: LoopRunDetails,
  value: AgentOutcome["outcome"],
  summary?: string
) => runtime.completeAgentStep(automation, defaultLoopTheme, {
  stepRunId: details.stepRuns.at(-1)!.stepRunId,
  outcome: outcome(value, summary)
});

describe("document review transition fixture", () => {
  it("runs the document review local cycle and resumes its configured wait", async () => {
    const runtime = await createRuntime();
    const automation = documentReviewFixture();
    let details = startLoop(runtime, automation, "document-review", "Review this draft.");

    details = completeLatest(runtime, automation, details, "blocked", "Editorial judgment required.");
    expect(details.stepRuns[0]).toMatchObject({
      result: { kind: "agent", outcome: "blocked" },
      transition: { action: "goto", target: "editor-decision" }
    });
    expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "editor-decision", type: "human" });

    details = runtime.respondToStepRun(
      automation,
      defaultLoopTheme,
      details.runId,
      details.stepRuns.at(-1)!.stepRunId,
      "rejected",
      "Tighten the conclusion."
    );
    expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "revise-draft", type: "agent" });
    details = completeLatest(runtime, automation, details, "ready");
    expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "inspect-draft", type: "agent" });

    details = completeLatest(runtime, automation, details, "needs_input", "Which audience should this target?");
    const waiting = details.stepRuns.at(-1)!;
    expect(waiting).toMatchObject({
      stepId: "inspect-draft",
      status: "waiting_for_human",
      transition: { action: "wait", resume: "same-step" }
    });
    details = runtime.resumeStepRun(
      automation,
      defaultLoopTheme,
      details.runId,
      waiting.stepRunId,
      "Target maintainers."
    );
    expect(details.stepRuns.at(-1)).toMatchObject({
      stepId: "inspect-draft",
      status: "queued",
      input: expect.stringContaining("Target maintainers.")
    });
    runtime.close();
  });
});

describe("data import transition fixture", () => {
  it("runs the data import cross-Loop cycle from a scheduled source", async () => {
    const runtime = await createRuntime();
    const automation = dataImportFixture();
    const parent = startLoop(runtime, automation, "data-import");
    const completedParent = completeLatest(runtime, automation, parent, "blocked", "Mapping is missing.");

    expect(completedParent).toMatchObject({
      status: "completed",
      termination: {
        signal: { kind: "agent", outcome: "blocked" },
        target: { loop: "mapping-assistance" }
      }
    });
    const assistance = runtime.listLoopRuns().find((candidate) => candidate.loopId === "mapping-assistance")!;
    expect(assistance).toMatchObject({
      source: "transition",
      parentRunId: parent.runId,
      rootRunId: parent.rootRunId,
      status: "waiting_for_human"
    });

    runtime.respondToStepRun(
      automation,
      defaultLoopTheme,
      assistance.runId,
      assistance.stepRuns[0]!.stepRunId,
      "approved",
      "Map external_id to id."
    );
    const returned = runtime.listLoopRuns().find((candidate) =>
      candidate.loopId === "data-import" && candidate.runId !== parent.runId)!;
    expect(returned).toMatchObject({
      source: "transition",
      parentRunId: assistance.runId,
      rootRunId: parent.rootRunId,
      status: "running"
    });
    runtime.close();
  });

  it("honors the data import retry count and executes its configured fallback", async () => {
    const runtime = await createRuntime();
    const automation = dataImportFixture();
    let details = startLoop(runtime, automation, "data-import");

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      details = completeLatest(runtime, automation, details, "failed", `Import attempt ${attempt} failed.`);
      if (attempt <= 4) {
        expect(details.stepRuns.at(-1)).toMatchObject({
          stepId: "ingest-batch",
          status: "queued",
          attempt: attempt + 1
        });
      }
    }

    expect(details.stepRuns.at(-2)).toMatchObject({
      stepId: "ingest-batch",
      transition: { action: "goto", target: "discard-batch", cause: "retry-exhausted" }
    });
    expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "discard-batch", status: "queued" });
    details = completeLatest(runtime, automation, details, "ready");
    expect(details).toMatchObject({
      status: "failed",
      termination: {
        code: "configured_termination",
        signal: { kind: "agent", outcome: "ready" }
      }
    });
    runtime.close();
  });
});

describe("incident escalation transition fixture", () => {
  it("runs incident retry escalation and counter-semantic terminations from config", async () => {
    const directRuntime = await createRuntime();
    const automation = incidentEscalationFixture();
    const direct = completeLatest(
      directRuntime,
      automation,
      startLoop(directRuntime, automation, "incident-triage"),
      "ready"
    );
    expect(direct).toMatchObject({
      status: "blocked",
      termination: {
        code: "configured_termination",
        signal: { kind: "agent", outcome: "ready" }
      }
    });
    directRuntime.close();

    const runtime = await createRuntime();
    let details = startLoop(runtime, automation, "incident-triage");
    details = completeLatest(runtime, automation, details, "blocked", "Diagnostics required.");
    expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "collect-diagnostics", status: "queued" });
    details = completeLatest(runtime, automation, details, "ready");
    expect(details.stepRuns.at(-1)).toMatchObject({ stepId: "triage-incident", status: "queued" });
    const escalatedParent = completeLatest(runtime, automation, details, "blocked", "Escalate after diagnostics.");
    expect(escalatedParent.stepRuns.at(-1)).toMatchObject({
      stepId: "triage-incident",
      transition: { action: "goto", target: { loop: "incident-escalation" }, cause: "retry-exhausted" }
    });

    const escalation = runtime.listLoopRuns().find((candidate) => candidate.loopId === "incident-escalation")!;
    const completedEscalation = runtime.respondToStepRun(
      automation,
      defaultLoopTheme,
      escalation.runId,
      escalation.stepRuns[0]!.stepRunId,
      "rejected",
      "No mitigation is required."
    );
    expect(completedEscalation).toMatchObject({
      status: "completed",
      termination: {
        code: "configured_termination",
        signal: { kind: "human", decision: "rejected" }
      }
    });
    runtime.close();
  });

  it("resumes the incident human wait to its configured target", async () => {
    const runtime = await createRuntime();
    const automation = incidentEscalationFixture();
    let details = startLoop(runtime, automation, "incident-triage", "Investigate latency.");
    details = completeLatest(runtime, automation, details, "needs_input", "Provide the incident window.");
    expect(details.stepRuns.at(-1)).toMatchObject({
      stepId: "context-decision",
      input: "Provide the incident window."
    });
    details = runtime.respondToStepRun(
      automation,
      defaultLoopTheme,
      details.runId,
      details.stepRuns.at(-1)!.stepRunId,
      "approved",
      "Window starts at 10:00 UTC."
    );
    const waiting = details.stepRuns.at(-1)!;
    expect(waiting).toMatchObject({
      type: "human",
      status: "waiting_for_human",
      transition: { action: "wait", resume: { target: "triage-incident" } }
    });
    details = runtime.resumeStepRun(
      automation,
      defaultLoopTheme,
      details.runId,
      waiting.stepRunId,
      "Window confirmed."
    );
    expect(details.stepRuns.at(-1)).toMatchObject({
      stepId: "triage-incident",
      status: "queued",
      input: expect.stringContaining("Window confirmed.")
    });
    runtime.close();
  });
});
