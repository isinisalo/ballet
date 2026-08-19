import { describe, expect, it } from "vitest";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { LoopRunNotFoundError } from "../runtime/LoopRunErrors.js";
import {
  reachableExecutionGraph,
  reachableProviderCompositions
} from "./LoopExecutionSnapshot.js";
import {
  testExecutionProfile,
  testLoop,
  testOrchestrator,
  testWorkLoopNode
} from "../tests/v11TestConfig.js";

const configuration = (): ProjectConfiguration => {
  const root = testLoop("root-loop");
  const second = testWorkLoopNode("verify", { validation: "agent" });
  root.nodes = [second, root.nodes[0]!];
  root.edges = [
    { id: "verify-completed", source: "verify", target: { terminal: "completed" } },
    { id: "work-to-verify", source: "work", target: { nodeId: "verify" } }
  ];
  return {
    version: 11,
    executionProfiles: [testExecutionProfile],
    orchestrator: { ...testOrchestrator(), maxRepairDepth: 2 },
    graph: { loopEdges: [
      { id: "repair-to-nested", source: "repair-loop", target: "nested-repair", kind: "repair", capability: "test:loop.transfer", description: "Nested repair." },
      { id: "root-to-repair", source: "root-loop", target: "repair-loop", kind: "repair", capability: "test:loop.transfer", description: "Allowed repair." },
      { id: "root-to-flow", source: "root-loop", target: "flow-loop", kind: "flow", capability: "test:loop.transfer", description: "Normal flow." },
      { id: "nested-too-deep", source: "nested-repair", target: "unused-loop", kind: "repair", capability: "test:loop.transfer", description: "Exceeds depth." },
      { id: "repair-normal-flow", source: "repair-loop", target: "repair-flow", kind: "flow", capability: "test:loop.transfer", description: "Repair target flow closure." }
    ] },
    loops: [
      testLoop("unused-loop"),
      testLoop("nested-repair"),
      testLoop("repair-flow"),
      root,
      testLoop("repair-loop"),
      testLoop("flow-loop")
    ]
  };
};

describe("reachable Root execution snapshot graph", () => {
  it("walks Validation OK Node Edges and normal flow Loop Edges deterministically", () => {
    const graph = reachableExecutionGraph(configuration(), "root-loop");

    expect(graph.loops.map((loop) => loop.id)).toEqual([
      "flow-loop", "nested-repair", "repair-flow", "repair-loop", "root-loop"
    ]);
    expect(graph.loops.find((loop) => loop.id === "root-loop")?.nodes.map((node) => node.id))
      .toEqual(["verify", "work"]);
    expect(graph.loops.find((loop) => loop.id === "root-loop")?.edges.map((edge) => edge.id))
      .toEqual(["verify-completed", "work-to-verify"]);
    expect(graph.graph.loopEdges.map((edge) => edge.id)).toEqual([
      "repair-normal-flow", "repair-to-nested", "root-to-flow", "root-to-repair"
    ]);
  });

  it("includes nested repair routes only through the snapshotted repair depth", () => {
    const graph = reachableExecutionGraph(configuration(), "root-loop");

    expect(graph.minimumRepairDepthByLoopId.get("root-loop")).toBe(0);
    expect(graph.minimumRepairDepthByLoopId.get("repair-loop")).toBe(1);
    expect(graph.minimumRepairDepthByLoopId.get("repair-flow")).toBe(1);
    expect(graph.minimumRepairDepthByLoopId.get("nested-repair")).toBe(2);
    expect(graph.minimumRepairDepthByLoopId.has("unused-loop")).toBe(false);
    expect(graph.graph.loopEdges.some((edge) => edge.id === "nested-too-deep")).toBe(false);
  });

  it("excludes the complete repair catalog when maxRepairDepth is zero", () => {
    const config = configuration();
    config.orchestrator.maxRepairDepth = 0;
    const graph = reachableExecutionGraph(config, "root-loop");

    expect(graph.loops.map((loop) => loop.id)).toEqual(["flow-loop", "root-loop"]);
    expect(graph.graph.loopEdges.map((edge) => edge.id)).toEqual(["root-to-flow"]);
  });

  it("snapshots provider compositions only from reachable Work and Validation Nodes", () => {
    expect(reachableProviderCompositions(configuration(), "root-loop").map((entry) => entry.id)).toEqual([
      "flow-loop:work:work",
      "nested-repair:work:work",
      "repair-flow:work:work",
      "repair-loop:work:work",
      "root-loop:verify:work",
      "root-loop:verify:validation",
      "root-loop:work:work"
    ]);
  });

  it("fails closed for a missing root or reachable target Loop", () => {
    expect(() => reachableExecutionGraph(configuration(), "missing-loop"))
      .toThrow(LoopRunNotFoundError);
    const missing = configuration();
    missing.loops = missing.loops.filter((loop) => loop.id !== "repair-loop");
    expect(() => reachableExecutionGraph(missing, "root-loop"))
      .toThrow("Reachable Loop repair-loop was not found.");
  });
});
