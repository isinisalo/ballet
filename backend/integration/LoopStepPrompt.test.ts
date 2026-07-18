import { describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectLoop } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { LoopRunDetails, StepRun } from "../../shared/domain/runtime.js";
import { renderLoopStepPrompt } from "./LoopStepPrompt.js";

const loop: ProjectLoop = {
  id: "quality-cycle",
  start: "work",
  nodes: [{
    id: "work",
    type: "agent",
    agentId: "worker",
    description: "Complete the current work.",
    nodeStyle: "flat",
    nodeSize: "medium",
    on: { approved: "completed", rejected: "work" }
  }, ...defaultTerminalNodes()]
};

describe("Loop Step prompt", () => {
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

    const prompt = JSON.parse(renderLoopStepPrompt([run], run, current)) as {
      current: { resume: { question: string; context: string; response: string } };
      run_input: string;
    };

    expect(prompt.current.resume).toEqual({
      question: "Which database should I use?",
      context: "The repository supports SQLite and Postgres.",
      response: "Use SQLite."
    });
    expect(prompt.run_input).toContain("Original request.");
    expect(prompt.run_input).toContain("Use SQLite.");
  });

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

    const prompt = JSON.parse(renderLoopStepPrompt([run], run, current)) as {
      recent_steps: Array<{ outcome: { state: string; result: string; summary: string; checks: unknown[] } }>;
    };

    expect(prompt.recent_steps[0]?.outcome).toMatchObject({
      state: "completed",
      result: "rejected",
      summary: "The implementation needs another pass.",
      checks: [{ name: "acceptance", status: "failed", details: "One scenario is missing." }]
    });
  });
});

const step = (overrides: Partial<StepRun> = {}): StepRun => ({
  stepRunId: "current",
  runId: "run-1",
  loopId: loop.id,
  stepId: "work",
  type: "agent",
  agentId: "worker",
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
