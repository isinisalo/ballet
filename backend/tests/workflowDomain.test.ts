import { describe, expect, it } from "vitest";
import {
  getProjectFailEdges,
  getProjectPassEdges,
  getReachableProjectJobNodeIds,
  hasReachableProjectWorkflowPass,
  isProjectProviderJobNode,
  isProjectScheduledJobNode,
  resolveProjectWorkflowStartJob
} from "../../shared/domain/automation.js";
import { validateProjectAutomationConfig } from "../automation.js";
import { testAutomationConfig, testJobPair, testLoop } from "./v12TestConfig.js";

describe("ProjectWorkflow domain", () => {
  it("resolves start, paired Validation, and explicit Pass/Fail edges", () => {
    const loop = testLoop();
    expect(resolveProjectWorkflowStartJob(loop)?.id).toBe("job");
    expect(getProjectPassEdges(loop, "job-validation")).toEqual(loop.workflow.passEdges);
    expect(getProjectFailEdges(loop, "job-validation")).toEqual(loop.workflow.failEdges);
    expect(getReachableProjectJobNodeIds(loop)).toEqual(new Set(["job"]));
    expect(hasReachableProjectWorkflowPass(loop)).toBe(true);
  });

  it("models schedule only on a provider Job Node", () => {
    const pair = testJobPair("scheduled", { scheduled: {
      kind: "once", date: "2026-08-16", time: "09:00", timeZone: "Europe/Helsinki"
    } });
    expect(isProjectScheduledJobNode(pair.job)).toBe(true);
    expect(isProjectProviderJobNode(pair.job)).toBe(true);
  });

  it("rejects shared/orphan Validation Nodes and missing Pass/Fail edges", () => {
    const loop = testLoop();
    const second = testJobPair("second");
    loop.workflow.jobNodes.push({ ...second.job, validationNodeId: "job-validation" });
    loop.workflow.validationNodes.push(second.validation);
    const issues = validateProjectAutomationConfig(testAutomationConfig(loop), []);
    expect(issues.map(({ message }) => message).join("\n")).toMatch(/shared|exactly one|orphan/i);
  });

  it("rejects unreachable Jobs and a Workflow without a reachable PASS endpoint", () => {
    const loop = testLoop();
    const second = testJobPair("second");
    loop.workflow.jobNodes.push(second.job);
    loop.workflow.validationNodes.push(second.validation);
    loop.workflow.passEdges = [{ id: "job-cycle", sourceValidationNodeId: "job-validation", target: { jobNodeId: "job" } }];
    loop.workflow.failEdges.push({ id: "second-fail", sourceValidationNodeId: second.validation.id, target: { workflowResult: "FAIL" } });
    const issues = validateProjectAutomationConfig(testAutomationConfig(loop), []);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringMatching(/JobNode is unreachable.*second/) }),
      expect.objectContaining({ message: expect.stringMatching(/PASS result reachable/) })
    ]));
  });
});
