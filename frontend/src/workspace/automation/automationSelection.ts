import {
  routeTargetKey,
  type ProjectAutomationConfig,
  type ProjectGraphNode,
  type ProjectJobNode,
  type ProjectOrchestrator,
  type ProjectRepairNode,
  type ProjectValidationNode,
  type ProjectWorkNode
} from "@shared/api/workspace-contracts";
import type { EngineeringLevel } from "../types";
import type { EngineeringInspectorModel } from "./EngineeringInspector";

export type AutomationSelection = "none" | "settings" | "orchestrator" | "repair" | "work" | "validation";

export function automationInspectorModel(
  level: EngineeringLevel,
  selection: AutomationSelection,
  config: ProjectAutomationConfig,
  graphNode: ProjectGraphNode | undefined,
  jobNode: ProjectJobNode | undefined,
  locked: boolean
): EngineeringInspectorModel | undefined {
  if (selection === "none") return undefined;
  if (level === "graph") {
    if (selection === "settings") return {
      key: "graph-settings", role: "Graph", title: config.graph.name, id: config.graph.id,
      description: config.graph.state.description, locked
    };
    if (selection === "repair" && config.graph.repairNode) return repairModel(config.graph.repairNode, "Graph Repair Node", locked);
    return orchestratorModel(config.graph.orchestrator, "Graph Orchestrator", locked);
  }
  if (!graphNode) return undefined;
  if (level === "graph_node") {
    if (selection === "settings") return metadataModel(graphNode, "Graph Node", locked);
    if (selection === "repair" && graphNode.repairNode) return repairModel(graphNode.repairNode, "Graph Node Repair Node", locked);
    return orchestratorModel(graphNode.orchestrator, "Graph Node Orchestrator", locked);
  }
  if (!jobNode) return undefined;
  if (selection === "settings") return { ...metadataModel(jobNode, "Job Node", locked), maxRetries: jobNode.maxRetries };
  if (selection === "validation") return executableModel(jobNode.validationNode, "Validation Node", "Verify Result", locked);
  return executableModel(jobNode.workNode, "Work Node", "Take action", locked);
}

export function updateAutomationSelection(
  config: ProjectAutomationConfig,
  level: EngineeringLevel,
  selection: AutomationSelection,
  graphNodeId: string | undefined,
  jobNodeId: string | undefined,
  field: string,
  value: string | number
): ProjectAutomationConfig {
  if (level === "graph") {
    if (selection === "settings") return {
      ...config, graph: { ...config.graph, state: { ...config.graph.state, description: String(value) } }
    };
    const key = selection === "repair" ? "repairNode" : "orchestrator";
    const node = config.graph[key];
    return node ? { ...config, graph: { ...config.graph, [key]: { ...node, [field]: value } } } : config;
  }
  const graphNodeIndex = config.graph.graphNodes.findIndex((node) => node.id === graphNodeId);
  if (graphNodeIndex < 0) return config;
  const graphNode = config.graph.graphNodes[graphNodeIndex];
  let nextGraphNode: ProjectGraphNode;
  if (level === "graph_node") {
    if (selection === "settings") nextGraphNode = { ...graphNode, [field]: value };
    else {
      const key = selection === "repair" ? "repairNode" : "orchestrator";
      const node = graphNode[key];
      if (!node) return config;
      nextGraphNode = { ...graphNode, [key]: { ...node, [field]: value } };
    }
  } else {
    const jobIndex = graphNode.jobNodes.findIndex((node) => node.id === jobNodeId);
    if (jobIndex < 0) return config;
    const job = graphNode.jobNodes[jobIndex];
    const nextJob = selection === "settings" ? { ...job, [field]: value }
      : selection === "validation" ? { ...job, validationNode: { ...job.validationNode, [field]: value } }
        : { ...job, workNode: { ...job.workNode, [field]: value } };
    nextGraphNode = { ...graphNode, jobNodes: graphNode.jobNodes.map((node, index) => index === jobIndex ? nextJob : node) };
  }
  return {
    ...config,
    graph: { ...config.graph, graphNodes: config.graph.graphNodes.map((node, index) => index === graphNodeIndex ? nextGraphNode : node) }
  };
}

const metadataModel = (node: ProjectGraphNode | ProjectJobNode, role: string, locked: boolean): EngineeringInspectorModel => ({
  key: `${role}:${node.id}`, role, title: node.description, id: node.id, description: node.description,
  nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, accepts: node.capabilities.accepts,
  provides: node.capabilities.provides, locked
});

const executableModel = (
  node: ProjectWorkNode | ProjectValidationNode, role: string, title: string, locked: boolean
): EngineeringInspectorModel => ({
  key: `${role}:${node.id}`, role, title, id: node.id, description: node.description,
  task: node.task, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
  ...(node.type === "agent" ? { executionProfileId: node.executionProfileId, primaryInstructionId: node.primaryInstructionId } : {}),
  locked
});

const repairModel = (node: ProjectRepairNode, role: string, locked: boolean): EngineeringInspectorModel => ({
  key: `${role}:${node.id}`, role, title: node.description, id: node.id, description: node.description,
  task: node.task, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
  executionProfileId: node.executionProfileId, primaryInstructionId: node.primaryInstructionId,
  maxRepairDepth: node.maxRepairDepth, maxRepairAttempts: node.maxRepairAttempts, locked
});

const orchestratorModel = <T>(node: ProjectOrchestrator<T>, role: string, locked: boolean): EngineeringInspectorModel => ({
  key: `${role}:${node.id}`, role, title: node.description, id: node.id, description: node.description,
  nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, executionProfileId: node.executionProfileId,
  primaryInstructionId: node.primaryInstructionId, maxTransitions: node.maxTransitions,
  maxRouteAttempts: node.maxRouteAttempts,
  candidates: [node.routing.start, ...node.routing.continuation, ...node.routing.repair].map((rule) => ({
    label: rule.id, values: rule.candidates.map((candidate) => routeTargetKey(candidate.target as never))
  })),
  locked
});
