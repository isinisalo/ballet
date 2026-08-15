import { describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectLoop } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import type { LoopRunDetails, RootExecutionSnapshot, StepRun } from "../../shared/domain/runtime.js";
import {
  MAX_LOOP_RUN_INPUT_CHARS,
  MAX_LOOP_STEP_HISTORY_ENTRIES,
  renderStepTaskEnvelope,
  serializeTaskEnvelopeV1
} from "./LoopStepPrompt.js";

const profile: ExecutionProfile = {
  id: "test-profile",
  name: "Test profile",
  provider: "codex",
  model: "test-model",
  reasoningEffort: "medium",
  networkAccess: false
};

const loop: ProjectLoop = {
  id: "quality-cycle",
  start: "work",
  nodes: [{
    id: "work",
    type: "agent",
    executionProfileId: profile.id,
    primaryInstructionId: "project:worker",
    skillIds: [],
    description: "Complete the current work.",
    nodeStyle: "flat",
    nodeSize: "medium",
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
};

describe("TaskEnvelopeV1 exact serialization", () => {
  it("serializes the initial TaskEnvelopeV1 with exact bytes and no transition targets", () => {
    const current = step({ input: "Initial request." });
    const run = details([current]);
    const expected = '{"version":1,"loopId":"quality-cycle","stepId":"work",'
      + '"task":"Complete the current work.","runInput":"Initial request.","recentSteps":[]}';

    expect(serializeTaskEnvelopeV1({
      version: 1,
      loopId: "quality-cycle",
      stepId: "work",
      task: "Complete the current work.",
      runInput: "Initial request.",
      recentSteps: []
    })).toBe(expected);
    expect(renderStepTaskEnvelope(snapshot, [run], run, current)).toBe(expected);
    expect(expected).not.toMatch(/"(?:approved|rejected|completed|blocked)"/u);
  });

  it("retains the needs-input question, context, and answer when the same Step resumes", () => {
    const current = step({
      status: "queued",
      input: "Original request.\n\nUse SQLite.",
      responseInput: "Use SQLite.",
      outcome: {
        state: "needs_input",
        question: "Which database should I use?",
        context: "The repository supports SQLite and Postgres.",
        summary: "A storage decision is required.",
        checks: []
      }
    });
    const run = details([current]);
    const expected = '{"version":1,"loopId":"quality-cycle","stepId":"work",'
      + '"task":"Complete the current work.","runInput":"Original request.\\n\\nUse SQLite.",'
      + '"recentSteps":[],"resume":{"question":"Which database should I use?",'
      + '"context":"The repository supports SQLite and Postgres.","response":"Use SQLite."}}';
    const rendered = renderStepTaskEnvelope(snapshot, [run], run, current);

    expect(serializeTaskEnvelopeV1({
      version: 1,
      loopId: "quality-cycle",
      stepId: "work",
      task: "Complete the current work.",
      runInput: "Original request.\n\nUse SQLite.",
      recentSteps: [],
      resume: {
        question: "Which database should I use?",
        context: "The repository supports SQLite and Postgres.",
        response: "Use SQLite."
      }
    })).toBe(expected);
    expect(rendered).toBe(expected);
    expect(rendered).not.toMatch(/"(?:approved|rejected|completed|blocked)"/u);

    const prompt = JSON.parse(rendered) as {
      version: number;
      loopId: string;
      stepId: string;
      task: string;
      resume: { question: string; context: string; response: string };
      runInput: string;
    };

    expect(prompt).toMatchObject({
      version: 1,
      loopId: loop.id,
      stepId: "work",
      task: "Complete the current work."
    });
    expect(prompt.resume).toEqual({
      question: "Which database should I use?",
      context: "The repository supports SQLite and Postgres.",
      response: "Use SQLite."
    });
    expect(prompt.runInput).toContain("Original request.");
    expect(prompt.runInput).toContain("Use SQLite.");
  });

});

describe("Loop Step prompt", () => {
  it("keeps rejected completion feedback in recent summary and checks", () => {
    const previous = step({
      stepRunId: "previous",
      status: "completed",
      result: "rejected",
      outcome: {
        state: "completed",
        result: "rejected",
        summary: "The implementation needs another pass.",
        checks: [{ name: "acceptance", status: "failed", details: "One scenario is missing." }]
      },
      completedAt: "2026-07-18T10:01:00.000Z"
    });
    const current = step({ stepRunId: "current", createdAt: "2026-07-18T10:02:00.000Z", updatedAt: "2026-07-18T10:02:00.000Z" });
    const run = details([previous, current]);

    const prompt = JSON.parse(renderStepTaskEnvelope(snapshot, [run], run, current)) as {
      recentSteps: Array<{ outcome: { state: string; result: string; summary: string; checks: unknown[] } }>;
    };

    expect(prompt.recentSteps[0]?.outcome).toMatchObject({
      state: "completed",
      result: "rejected",
      summary: "The implementation needs another pass.",
      checks: [{ name: "acceptance", status: "failed", details: "One scenario is missing." }]
    });
  });

  it("truncates long Run input in the middle without changing the envelope fields", () => {
    const input = `${"a".repeat(MAX_LOOP_RUN_INPUT_CHARS)}${"z".repeat(MAX_LOOP_RUN_INPUT_CHARS)}`;
    const current = step({ input });
    const run = details([current]);

    const prompt = JSON.parse(renderStepTaskEnvelope(snapshot, [run], run, current)) as {
      runInput: string;
    };

    expect(prompt.runInput).toHaveLength(MAX_LOOP_RUN_INPUT_CHARS);
    expect(prompt.runInput).toContain("[... RUN_INPUT TRUNCATED ...]");
    expect(prompt.runInput.startsWith("a")).toBe(true);
    expect(prompt.runInput.endsWith("z")).toBe(true);
  });

  it("keeps only the most recent bounded history entries", () => {
    const previous = Array.from({ length: MAX_LOOP_STEP_HISTORY_ENTRIES + 1 }, (_, index) => step({
      stepRunId: `previous-${index}`,
      stepId: `history-${index}`,
      status: "completed",
      result: "approved",
      outcome: {
        state: "completed",
        result: "approved",
        summary: `Completed history ${index}.`,
        checks: []
      },
      completedAt: `2026-07-18T10:0${index}:00.000Z`
    }));
    const current = step({
      stepRunId: "current",
      createdAt: "2026-07-18T10:10:00.000Z",
      updatedAt: "2026-07-18T10:10:00.000Z"
    });
    const run = details([...previous, current]);

    const prompt = JSON.parse(renderStepTaskEnvelope(snapshot, [run], run, current)) as {
      recentSteps: Array<{ stepId: string }>;
    };

    expect(prompt.recentSteps).toHaveLength(MAX_LOOP_STEP_HISTORY_ENTRIES);
    expect(prompt.recentSteps.map((entry) => entry.stepId)).toEqual([
      "history-3",
      "history-2",
      "history-1"
    ]);
  });
});

const step = (overrides: Partial<StepRun> = {}): StepRun => ({
  stepRunId: "current",
  runId: "run-1",
  loopId: loop.id,
  stepId: "work",
  type: "agent",
  status: "queued",
  attempt: 1,
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T10:00:00.000Z",
  ...overrides
});

const details = (stepRuns: StepRun[]): LoopRunDetails => ({
  runId: "run-1",
  loopId: loop.id,
  rootRunId: "root-1",
  source: "manual",
  status: "running",
  snapshot: loop,
  themeSnapshot: defaultLoopTheme,
  transitionCount: 0,
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T10:02:00.000Z",
  stepRuns
});

const snapshot: RootExecutionSnapshot = {
  version: 1,
  rootLoopId: loop.id,
  project: {
    checkoutRoot: "/tmp/project",
    headSha: "a".repeat(40),
    configHash: "b".repeat(64),
    snapshotHash: "c".repeat(64)
  },
  loops: [loop],
  theme: defaultLoopTheme,
  executionProfiles: [profile],
  runtimes: [],
  resources: [],
  createdAt: "2026-07-18T10:00:00.000Z"
};
