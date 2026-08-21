import { describe, expect, it } from "vitest";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { LoopRunNotFoundError } from "../runtime/LoopRunErrors.js";
import { reachableExecutionGraph, reachableProviderCompositions } from "./LoopExecutionSnapshot.js";
import { testExecutionProfile, testJobPair, testLoop, testOrchestrator } from "../tests/v13TestConfig.js";

const configuration = (): ProjectConfiguration => {
  const root = testLoop("root-loop");
  const second = testJobPair("verify", { validation: "agent" });
  const first = root.workflow.jobNodes[0]!;
  const firstValidation = root.workflow.validationNodes[0]!;
  root.workflow = {
    startJobNodeId: first.id,
    jobNodes: [second.job, first],
    validationNodes: [second.validation, firstValidation],
    passEdges: [
      { id: "verify-pass", sourceValidationNodeId: second.validation.id, target: { workflowResult: "PASS" } },
      { id: "job-to-verify", sourceValidationNodeId: firstValidation.id, target: { jobNodeId: second.job.id } }
    ],
    failEdges: [
      { id: "verify-fail", sourceValidationNodeId: second.validation.id, target: { workflowResult: "FAIL" } },
      { id: "job-fail", sourceValidationNodeId: firstValidation.id, target: { workflowResult: "FAIL" } }
    ]
  };
  return {
    version: 13,
    executionProfiles: [testExecutionProfile],
    issueTracker: {
      kind: "tk",
      testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration",
      workDirectory: ".tickets/work"
    },
    orchestrator: {
      ...testOrchestrator(),
      repairRouter: { ...testOrchestrator().repairRouter!, maxRepairDepth: 2 }
    },
    graph: {
      id: "test-graph",
      name: "Test Graph",
      startLoopId: "root-loop",
      transitions: [
        { id: "root-to-flow", source: "root-loop", decision: "PASS", outcome: "success", target: { loopId: "flow-loop" }, description: "Normal transition." },
        { id: "repair-normal-flow", source: "repair-loop", decision: "PASS", outcome: "success", target: { loopId: "repair-flow" }, description: "Repair target transition closure." }
      ],
      repairEdges: [
        { id: "repair-to-nested", source: "repair-loop", target: "nested-repair", capability: "test:loop.transfer", description: "Nested repair." },
        { id: "root-to-repair", source: "root-loop", target: "repair-loop", capability: "test:loop.transfer", description: "Allowed repair." },
        { id: "nested-too-deep", source: "nested-repair", target: "unused-loop", capability: "test:loop.transfer", description: "Exceeds depth." }
      ]
    },
    loops: [testLoop("unused-loop"), testLoop("nested-repair"), testLoop("repair-flow"), root, testLoop("repair-loop"), testLoop("flow-loop")]
  };
};

describe("reachable Root execution snapshot graph", () => {
  it("walks PassEdges and Graph flow/repair Edges deterministically", () => {
    const graph = reachableExecutionGraph(configuration(), "root-loop");
    expect(graph.loops.map((loop) => loop.id)).toEqual(["flow-loop", "nested-repair", "repair-flow", "repair-loop", "root-loop"]);
    const root = graph.loops.find((loop) => loop.id === "root-loop")!;
    expect(root.workflow.jobNodes.map((node) => node.id)).toEqual(["job", "verify"]);
    expect(root.workflow.passEdges.map((edge) => edge.id)).toEqual(["job-to-verify", "verify-pass"]);
    expect(graph.graph.transitions.map((edge) => edge.id)).toEqual(["repair-normal-flow", "root-to-flow"]);
    expect(graph.graph.repairEdges.map((edge) => edge.id)).toEqual(["repair-to-nested", "root-to-repair"]);
  });

  it("includes nested repair routes only through the snapshotted repair depth", () => {
    const graph = reachableExecutionGraph(configuration(), "root-loop");
    expect(graph.minimumRepairDepthByLoopId.get("root-loop")).toBe(0);
    expect(graph.minimumRepairDepthByLoopId.get("repair-loop")).toBe(1);
    expect(graph.minimumRepairDepthByLoopId.get("nested-repair")).toBe(2);
    expect(graph.minimumRepairDepthByLoopId.has("unused-loop")).toBe(false);
  });

  it("excludes repair routes when maxRepairDepth is zero", () => {
    const config = configuration();
    config.orchestrator.repairRouter!.maxRepairDepth = 0;
    const graph = reachableExecutionGraph(config, "root-loop");
    expect(graph.loops.map((loop) => loop.id)).toEqual(["flow-loop", "root-loop"]);
    expect(graph.graph.transitions.map((edge) => edge.id)).toEqual(["root-to-flow"]);
    expect(graph.graph.repairEdges).toEqual([]);
  });

  it("snapshots provider compositions from reachable Job and Validation Nodes", () => {
    expect(reachableProviderCompositions(configuration(), "root-loop", "graph").map((entry) => entry.id)).toEqual([
      "flow-loop:job:job",
      "nested-repair:job:job",
      "repair-flow:job:job",
      "repair-loop:job:job",
      "root-loop:job:job",
      "root-loop:verify:job",
      "root-loop:verify-validation:validation"
    ]);
  });

  it("fails closed for a missing root or reachable target Loop", () => {
    expect(() => reachableExecutionGraph(configuration(), "missing-loop")).toThrow(LoopRunNotFoundError);
    const missing = configuration();
    missing.loops = missing.loops.filter((loop) => loop.id !== "repair-loop");
    expect(() => reachableExecutionGraph(missing, "root-loop")).toThrow("Reachable Loop repair-loop was not found.");
  });
});
