import { describe, expect, it } from "vitest";
import {
  defaultTerminalNodes,
  type ExecutionProfile,
  type ProjectAutomationConfig,
  type ProjectInstruction,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { automationDraftIsValid, loopIdError, stepDescriptionError, stepIdError } from "../src/workspace/automation/loops/loopFormValidation";

const loop = (): ProjectLoop => ({
  id: "delivery",
  start: "review",
  nodes: [{
    id: "review",
    type: "human",
    nodeStyle: "luna",
    nodeSize: "tiny",
    description: "Review delivery",
    on: { approved: "completed", rejected: "failed" }
  }, ...defaultTerminalNodes()]
});

describe("Loop form validation", () => {
  it("uses the shared automation schema and rejects duplicate entity ids", () => {
    const valid: ProjectAutomationConfig = { version: 9, loops: [loop()] };
    expect(automationDraftIsValid(valid)).toBe(true);
    expect(automationDraftIsValid({ ...valid, loops: [loop(), loop()] })).toBe(false);

    const duplicateNodes = loop();
    duplicateNodes.nodes.push({ ...duplicateNodes.nodes[0]! });
    expect(automationDraftIsValid({ version: 9, loops: [duplicateNodes] })).toBe(false);

    const emptyHumanTask = loop();
    emptyHumanTask.nodes[0] = { ...emptyHumanTask.nodes[0]!, description: " \n" };
    expect(automationDraftIsValid({ version: 9, loops: [emptyHumanTask] })).toBe(false);
  });

  it("requires valid v9 execution composition references", () => {
    const profile: ExecutionProfile = {
      id: "reviewer",
      name: "Reviewer",
      provider: "codex",
      model: "gpt-test",
      reasoningEffort: "high",
      networkAccess: false
    };
    const instruction: ProjectInstruction = {
      id: "project:reviewer",
      projectId: "reviewer",
      title: "Reviewer",
      origin: "project",
      valid: true,
      sourceSha256: "source",
      contentSha256: "content",
      sizeBytes: 16,
      body: "Review the work.",
      relativePath: ".ballet/instructions/reviewer.md"
    };
    const executionLoop: ProjectLoop = {
      id: "delivery",
      start: "review",
      nodes: [{
        id: "review",
        type: "agent",
        executionProfileId: profile.id,
        primaryInstructionId: instruction.id!,
        skillIds: [],
        nodeStyle: "luna",
        nodeSize: "tiny",
        description: "Review delivery",
        on: { approved: "completed", rejected: "failed" }
      }, ...defaultTerminalNodes()]
    };
    const config: ProjectAutomationConfig = { version: 9, loops: [executionLoop] };

    expect(automationDraftIsValid(config, [profile], [instruction])).toBe(true);
    expect(automationDraftIsValid(config, [], [instruction])).toBe(false);
    expect(automationDraftIsValid(config, [profile], [])).toBe(false);
  });

  it("provides adjacent Loop and Step field messages", () => {
    const current = loop();
    const currentStep = current.nodes[0];
    if (!currentStep || currentStep.type !== "human") throw new Error("Expected Human fixture Step.");
    expect(loopIdError({ ...current, id: "Invalid ID" }, [])).toBe("Use 2–101 lowercase kebab-case characters.");
    expect(loopIdError({ ...current }, [current])).toBe(`Loop ${current.id} already exists.`);
    expect(stepIdError(current, { ...currentStep, id: "Invalid ID" })).toBe("Use 1–160 lowercase kebab-case characters.");
    expect(stepDescriptionError({ ...currentStep, description: " \t" })).toBe("Task description is required.");
    expect(stepDescriptionError({ ...currentStep, description: "x".repeat(2_001) })).toBe("Task description must be 2,000 characters or fewer.");
    expect(stepDescriptionError(defaultTerminalNodes()[0]!)).toBeUndefined();
  });
});
