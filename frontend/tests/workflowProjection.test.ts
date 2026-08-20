import { describe, expect, it } from "vitest";
import { buildWorkflowEngineeringProjection } from "../src/workspace/automation/loops/engineeringProjections";
import { addJobPair, updatePassEdgeTarget } from "../src/workspace/automation/loops/loopEditorState";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

describe("Workflow Engineering projection", () => {
  it("projects separate Job, Validation, PassEdge, and FailEdge collections", () => {
    const loop = workflowLoop();
    const projection = buildWorkflowEngineeringProjection(workflowAutomation(loop), loop.id)!;
    expect(projection.startJobNodeId).toBe("job");
    expect(projection.jobNodes.map(({ id }) => id)).toEqual(["job"]);
    expect(projection.validationNodes.map(({ id }) => id)).toEqual(["job-validation"]);
    expect(projection.passEdges[0]?.target).toEqual({ workflowResult: "PASS" });
    expect(projection.failEdges[0]?.target).toEqual({ workflowResult: "FAIL" });
  });

  it("preserves authoring order and explicit cyclic PassEdges deterministically", () => {
    let loop = addJobPair(workflowLoop());
    loop = updatePassEdgeTarget(loop, "job-validation", { jobNodeId: "job-2" });
    loop = updatePassEdgeTarget(loop, "job-2-validation", { jobNodeId: "job" });
    const config = workflowAutomation(loop);
    const first = buildWorkflowEngineeringProjection(config, loop.id);
    const second = buildWorkflowEngineeringProjection(config, loop.id);
    expect(second).toEqual(first);
    expect(first?.jobNodes.map(({ id }) => id)).toEqual(["job", "job-2"]);
    expect(first?.passEdges.map(({ target }) => target)).toEqual([
      { jobNodeId: "job-2" }, { jobNodeId: "job" }
    ]);
  });

  it("excludes project-global LoopEdges and unrelated Loops", () => {
    const selected = workflowLoop("selected-loop");
    const linked = workflowLoop("linked-loop");
    const config = workflowAutomation(selected, linked);
    config.graph.loopEdges = [{
      id: "global", source: selected.id, target: linked.id, kind: "flow",
      capability: "test:loop.transfer", description: "Continue."
    }];
    const projection = buildWorkflowEngineeringProjection(config, selected.id)!;
    expect(JSON.stringify(projection)).not.toContain(linked.id);
    expect(JSON.stringify(projection)).not.toContain("global");
  });
});
