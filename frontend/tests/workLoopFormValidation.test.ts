import { describe, expect, it } from "vitest";
import type { ExecutionProfile, ProjectInstruction, Skill } from "@shared/api/workspace-contracts";
import { updateNodeEdgeTarget } from "../src/workspace/automation/loops/loopEditorState";
import { automationDraftIssues, parseInitialState } from "../src/workspace/automation/loops/loopFormValidation";
import { localRuntime } from "./runtimeFixtures";
import { v11Automation, v11Loop } from "./v11Fixtures";

const profile: ExecutionProfile = {
  id: "codex-test",
  name: "Codex test",
  provider: "codex",
  model: "gpt-test",
  reasoningEffort: "high",
  networkAccess: false
};
const instruction = (id: string): ProjectInstruction => ({
  id,
  title: id,
  body: "Instruction body.",
  relativePath: `.ballet/instructions/${id}.md`,
  origin: "project",
  valid: true,
  sourceSha256: "a".repeat(64),
  contentSha256: "b".repeat(64),
  sizeBytes: 17
});
const skill: Skill = {
  id: "project:test-skill",
  projectId: "test-skill",
  name: "Test skill",
  description: "Test skill.",
  body: "Skill body.",
  relativePath: ".agents/skills/test-skill/SKILL.md",
  metadata: {},
  origin: "project",
  valid: true,
  sourceSha256: "c".repeat(64),
  contentSha256: "d".repeat(64),
  sizeBytes: 11
};
const resources = [instruction("project:architect"), instruction("project:worker")];

describe("Work Loop form validation", () => {
  it("accepts a complete v10 draft and rejects missing profiles and resources", () => {
    const config = v11Automation(v11Loop());
    expect(automationDraftIssues(config, [profile], resources, [skill], localRuntime())).toEqual([]);
    const missing = automationDraftIssues(config, [], [], [], localRuntime());
    expect(missing.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      "orchestrator.executionProfileId",
      "orchestrator.primaryInstructionId",
      "loops.0.nodes.0.work.executionProfileId",
      "loops.0.nodes.0.work.primaryInstructionId"
    ]));
  });

  it("enforces scheduled start placement and a reachable exit", () => {
    const loop = v11Loop();
    const second = structuredClone(loop.nodes[0]!);
    loop.nodes.push({
      ...second,
      id: "work-2",
      work: {
        type: "scheduled",
        task: "Scheduled work.",
        executionProfileId: profile.id,
        primaryInstructionId: "project:worker",
        skillIds: [],
        nodeStyle: "flat",
        nodeSize: "medium",
        schedule: { kind: "once", date: "2026-08-17", time: "09:00", timeZone: "Europe/Helsinki" }
      }
    });
    const cycle = updateNodeEdgeTarget(updateNodeEdgeTarget(loop, "work", { nodeId: "work-2" }), "work-2", { nodeId: "work" });
    const issues = automationDraftIssues(v11Automation(cycle), [profile], resources, [], localRuntime());
    expect(issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "Scheduled Work is allowed only in the start Work Loop Node.",
      "Loop needs a reachable terminal target."
    ]));
  });

  it("permits multiple flow candidates and rejects a duplicate route candidate", () => {
    const first = v11Loop("first-loop");
    const second = v11Loop("second-loop");
    second.nodes[0] = { ...second.nodes[0]!, id: "second-work" };
    second.startNodeId = "second-work";
    second.edges[0] = { ...second.edges[0]!, source: "second-work" };
    const config = v11Automation(first, second);
    config.graph.loopEdges = [
      { id: "flow-1", source: first.id, target: first.id, kind: "flow", capability: "test:loop.transfer", description: "Repeat." },
      { id: "flow-2", source: first.id, target: second.id, kind: "flow", capability: "test:loop.transfer", description: "Continue." },
      { id: "repair-1", source: first.id, target: second.id, kind: "repair", capability: "test:loop.transfer", description: "Repair." },
      { id: "repair-2", source: first.id, target: second.id, kind: "repair", capability: "test:loop.transfer", description: "Repair again." }
    ];
    const messages = automationDraftIssues(config, [profile], resources, [], localRuntime()).map((issue) => issue.message);
    expect(messages).toContain(`Duplicate Loop Edge route candidate id: ${first.id}→${second.id}:repair:test:loop.transfer.`);
    expect(messages.some((message) => message.includes("outgoing flow"))).toBe(false);
  });

  it("validates initial state JSON without truncation", () => {
    expect(parseInitialState('{"ticket":1}')).toEqual({ value: { ticket: 1 } });
    expect(parseInitialState("{")).toEqual({ error: "Initial state must be valid JSON." });
    expect(parseInitialState(JSON.stringify("x".repeat(262_145)))).toEqual({
      error: "Initial state must not exceed 262144 bytes."
    });
  });
});
