import { describe, expect, it } from "vitest";
import { buildRunPrompt } from "../agentd.js";
import type { AgentOperation } from "../shared/operations.js";

const operation: AgentOperation = {
  id: "developer-agent/implement-change",
  version: 1,
  name: "Implement change",
  description: "Implement a change.",
  active: true,
  agentId: "developer-agent",
  instructions: "Use the mapped input only.",
  inputContract: { id: "implement-change-input", version: 1 },
  outputContract: { id: "implement-change-output", version: 1 },
  emissionRequired: true,
  createdAt: "2026-06-25T08:00:00.000Z",
  updatedAt: "2026-06-25T08:00:00.000Z"
};

describe("agent prompt isolation", () => {
  it("includes operation instructions and mapped input without orchestration metadata", () => {
    const prompt = buildRunPrompt(operation, {
      workItemId: "work-1",
      goal: "Implement isolation",
      acceptanceCriteria: ["prompt excludes event metadata"],
      constraints: []
    });

    expect(prompt).toContain("Use the mapped input only.");
    expect(prompt).toContain('"workItemId": "work-1"');
    expect(prompt).not.toContain("event_id");
    expect(prompt).not.toContain("eventType");
    expect(prompt).not.toContain("policy_id");
    expect(prompt).not.toContain("run_id");
    expect(prompt).not.toContain("correlationId");
    expect(prompt).not.toContain("causationId");
  });
});

