import { describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectAutomationConfig, type ProjectLoop } from "@shared/api/workspace-contracts";
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
    const valid: ProjectAutomationConfig = { version: 8, loops: [loop()] };
    expect(automationDraftIsValid(valid)).toBe(true);
    expect(automationDraftIsValid({ ...valid, loops: [loop(), loop()] })).toBe(false);

    const duplicateNodes = loop();
    duplicateNodes.nodes.push({ ...duplicateNodes.nodes[0]! });
    expect(automationDraftIsValid({ version: 8, loops: [duplicateNodes] })).toBe(false);
  });

  it("provides adjacent Loop and Step field messages", () => {
    const current = loop();
    expect(loopIdError({ ...current, id: "Invalid ID" }, [])).toBe("Use 2–101 lowercase kebab-case characters.");
    expect(loopIdError({ ...current }, [current])).toBe(`Loop ${current.id} already exists.`);
    expect(stepIdError(current, { ...current.nodes[0]!, id: "Invalid ID" })).toBe("Use 1–160 lowercase kebab-case characters.");
    expect(stepDescriptionError({ ...current.nodes[0]!, description: "x".repeat(2_001) })).toBe("Description must be 2,000 characters or fewer.");
  });
});
