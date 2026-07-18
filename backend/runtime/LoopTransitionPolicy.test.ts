import { describe, expect, it } from "vitest";
import type { TransitionAction } from "../../shared/domain/automation.js";
import type { StepRun, StepRunResult } from "../../shared/domain/runtime.js";
import { interpretTransitionAction } from "./LoopTransitionPolicy.js";

const signals: StepRunResult[] = [
  { kind: "agent", outcome: "ready" },
  { kind: "agent", outcome: "approved" },
  { kind: "agent", outcome: "changes-requested" },
  { kind: "agent", outcome: "needs_input" },
  { kind: "agent", outcome: "blocked" },
  { kind: "agent", outcome: "failed" },
  { kind: "human", decision: "approved" },
  { kind: "human", decision: "rejected" }
];

const actions: TransitionAction[] = [{
  action: "goto",
  target: "next",
  input: "signal"
}, {
  action: "terminate",
  status: "failed"
}, {
  action: "wait",
  resume: { target: "next" },
  input: "append-signal"
}, {
  action: "retry",
  target: "next",
  policy: {
    maxAttempts: 2,
    onExhausted: { action: "terminate", status: "blocked" }
  }
}];

describe("generic transition action interpreter", () => {
  it.each(signals)("interprets every action for $kind signal", (signal) => {
    for (const action of actions) {
      const decision = interpretTransitionAction({
        action,
        signal,
        stepRun: stepRun(signal),
        history: []
      });

      expect(decision.kind).toBe(action.action);
      expect(decision.transition).toMatchObject({
        version: 1,
        signal,
        action: action.action
      });
      if (decision.kind === "goto" || decision.kind === "retry") {
        expect(decision.target).toBe("next");
      }
    }
  });

  it("selects the configured termination status without deriving it from the signal", () => {
    for (const signal of signals) {
      const decision = interpretTransitionAction({
        action: { action: "terminate", status: "completed" },
        signal,
        stepRun: stepRun(signal),
        history: []
      });

      expect(decision).toMatchObject({
        kind: "terminate",
        termination: { status: "completed", signal }
      });
    }
  });
});

const stepRun = (signal: StepRunResult): StepRun => ({
  stepRunId: `step-${signal.kind}`,
  runId: "run-1",
  loopId: "loop-1",
  stepId: "source",
  type: signal.kind,
  status: signal.kind === "agent" ? "running" : "waiting_for_human",
  attempt: 1,
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z"
});
