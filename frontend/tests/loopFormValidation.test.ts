import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { automationDraftIsValid, loopIdError, stepDescriptionError, stepIdError } from "../src/workspace/automation/loops/loopFormValidation";

const loop = (): ProjectLoop => ({
  id: "delivery",
  start: "review",
  steps: [{
    id: "review",
    type: "human",
    nodeStyle: "luna",
    description: "Review delivery",
    on: { approved: { end: "completed" }, rejected: { end: "failed" } }
  }]
});

describe("Loop form validation", () => {
  it("uses the shared automation schema and rejects duplicate entity ids", () => {
    const valid: ProjectAutomationConfig = { version: 7, loops: [loop()] };
    expect(automationDraftIsValid(valid)).toBe(true);
    expect(automationDraftIsValid({ ...valid, loops: [loop(), loop()] })).toBe(false);

    const duplicateSteps = loop();
    duplicateSteps.steps.push({ ...duplicateSteps.steps[0]! });
    expect(automationDraftIsValid({ version: 7, loops: [duplicateSteps] })).toBe(false);
  });

  it("provides adjacent Loop and Step field messages", () => {
    const current = loop();
    expect(loopIdError({ ...current, id: "Invalid ID" }, [])).toBe("Use 2–101 lowercase kebab-case characters.");
    expect(loopIdError({ ...current }, [current])).toBe(`Loop ${current.id} already exists.`);
    expect(stepIdError(current, { ...current.steps[0]!, id: "Invalid ID" })).toBe("Use 1–160 lowercase kebab-case characters.");
    expect(stepDescriptionError({ ...current.steps[0]!, description: "x".repeat(2_001) })).toBe("Description must be 2,000 characters or fewer.");
  });
});
