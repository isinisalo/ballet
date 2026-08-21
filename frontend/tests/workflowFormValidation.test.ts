import { describe, expect, it } from "vitest";
import type { ExecutionProfile, ProjectInstruction, Skill } from "@shared/api/workspace-contracts";
import {
  addJobPair,
  changeJobNodeType,
  updatePassEdgeTarget
} from "../src/workspace/automation/loops/loopEditorState";
import { automationDraftIssues, parseInitialState } from "../src/workspace/automation/loops/loopFormValidation";
import { localRuntime } from "./runtimeFixtures";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

const profile: ExecutionProfile = {
  id: "codex-test", name: "Codex test", provider: "codex", model: "gpt-test",
  reasoningEffort: "high", networkAccess: false
};
const instruction = (id: string): ProjectInstruction => ({
  id, title: id, body: "Instruction body.", relativePath: `.ballet/instructions/${id}.md`,
  origin: "project", valid: true, sourceSha256: "a".repeat(64), contentSha256: "b".repeat(64), sizeBytes: 17
});
const skill: Skill = {
  id: "project:test-skill", projectId: "test-skill", name: "Test skill", description: "Test skill.",
  body: "Skill body.", relativePath: ".agents/skills/test-skill/SKILL.md", metadata: {}, origin: "project",
  valid: true, sourceSha256: "c".repeat(64), contentSha256: "d".repeat(64), sizeBytes: 11
};
const resources = [instruction("project:architect"), instruction("project:worker")];

describe("Workflow Engineering form validation", () => {
  it("accepts a complete v13 draft and reports missing compositions at Workflow paths", () => {
    const config = workflowAutomation(workflowLoop());
    expect(automationDraftIssues(config, [profile], resources, [skill], localRuntime())).toEqual([]);
    const missing = automationDraftIssues(config, [], [], [], localRuntime());
    expect(missing.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      "loops.0.workflow.jobNodes.0.executionProfileId",
      "loops.0.workflow.jobNodes.0.primaryInstructionId"
    ]));
  });

  it("enforces scheduled start placement and a reachable PASS endpoint", () => {
    let loop = workflowLoop();
    const scheduled = changeJobNodeType({
      ...loop.workflow.jobNodes[0]!, id: "job-2", validationNodeId: "job-2-validation"
    }, "scheduled");
    const validation = { ...loop.workflow.validationNodes[0]!, id: "job-2-validation" };
    loop = addJobPair(loop, scheduled, validation);
    loop = updatePassEdgeTarget(loop, "job-validation", { jobNodeId: "job-2" });
    loop = updatePassEdgeTarget(loop, "job-2-validation", { jobNodeId: "job" });
    const messages = automationDraftIssues(workflowAutomation(loop), [profile], resources, [], localRuntime())
      .map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      "Scheduled Job is allowed only as the Workflow start.",
      "Workflow needs a reachable PASS endpoint."
    ]));
  });

  it("keeps RunBook transitions and repair routes separate and rejects a duplicate transition key", () => {
    const first = workflowLoop("first-loop");
    const second = workflowLoop("second-loop");
    const config = workflowAutomation(first, second);
    config.graph.transitions = [
      { id: "route-1", source: first.id, decision: "PASS", outcome: "success", target: { loopId: second.id }, description: "Continue." },
      { id: "route-2", source: first.id, decision: "PASS", outcome: "success", target: { loopId: first.id }, description: "Duplicate key." }
    ];
    config.graph.repairEdges = [
      { id: "repair-1", source: first.id, target: second.id, capability: "test:loop.transfer", description: "Repair." }
    ];
    config.orchestrator.repairRouter = {
      executionProfileId: profile.id, primaryInstructionId: "project:architect",
      skillIds: [], maxRepairDepth: 3, maxRepairAttempts: 3
    };
    const messages = automationDraftIssues(config, [profile], resources, [], localRuntime()).map((issue) => issue.message);
    expect(messages).toContain(`Duplicate RunBook transition key id: ${first.id}:PASS:success.`);
  });

  it("validates initial State JSON without truncation", () => {
    expect(parseInitialState('{"ticket":1}')).toEqual({ value: { ticket: 1 } });
    expect(parseInitialState("{")).toEqual({ error: "Initial State must be valid JSON." });
    expect(parseInitialState(JSON.stringify("x".repeat(262_145)))).toEqual({
      error: "Initial State must not exceed 262144 bytes."
    });
  });
});
