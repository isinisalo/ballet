import type { ProjectAutomationConfig, ProjectGraphNode, ProjectJobNode } from "@shared/api/workspace-contracts";
import type { EngineeringInspectorModel } from "./EngineeringInspector";

export type AutomationSelection = "none" | "settings" | "work" | "validation";

export const automationInspectorModel = (
  selection: AutomationSelection,
  graphNode: ProjectGraphNode | undefined,
  actionNode: ProjectJobNode | undefined,
  locked: boolean
): EngineeringInspectorModel | undefined => {
  if (!graphNode || !actionNode || selection === "none") return undefined;
  if (selection === "settings") return {
    key: `${actionNode.id}:settings`, role: "Action Node", title: actionNode.description, id: actionNode.id,
    description: actionNode.description, maxRetries: actionNode.maxRetries,
    accepts: actionNode.capabilities.accepts, provides: actionNode.capabilities.provides, locked
  };
  const node = selection === "work" ? actionNode.workNode : actionNode.validationNode;
  return {
    key: node.id, role: selection === "work" ? "Work" : "Validation", title: node.description,
    id: node.id, description: node.description, task: node.task, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
    executionProfileId: node.type === "agent" ? node.executionProfileId : undefined,
    primaryInstructionId: node.type === "agent" ? node.primaryInstructionId : undefined, locked
  };
};

export const updateAutomationSelection = (
  config: ProjectAutomationConfig, selection: AutomationSelection, graphNodeId: string | undefined,
  actionNodeId: string | undefined, field: string, value: string | number
): ProjectAutomationConfig => ({
  ...config, graph: { ...config.graph, graphNodes: config.graph.graphNodes.map((graphNode) => graphNode.id !== graphNodeId ? graphNode : ({
    ...graphNode, jobNodes: graphNode.jobNodes.map((actionNode) => actionNode.id !== actionNodeId ? actionNode : updateJob(actionNode, selection, field, value))
  })) }
});

const updateJob = (job: ProjectJobNode, selection: AutomationSelection, field: string, value: string | number): ProjectJobNode => {
  if (selection === "settings") return { ...job, [field]: value };
  if (selection === "work") return { ...job, workNode: { ...job.workNode, [field]: value } } as ProjectJobNode;
  if (selection === "validation") return { ...job, validationNode: { ...job.validationNode, [field]: value } } as ProjectJobNode;
  return job;
};
