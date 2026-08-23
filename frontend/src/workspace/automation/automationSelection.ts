import type { ProjectAutomationConfig, ProjectGraphNode, ProjectActionNode } from "@shared/api/workspace-contracts";
import type { EngineeringInspectorModel } from "./EngineeringInspector";

export type AutomationSelection = "none" | "settings" | "work" | "validation";

export const automationInspectorModel = (
  selection: AutomationSelection,
  graphNode: ProjectGraphNode | undefined,
  actionNode: ProjectActionNode | undefined,
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
    ...graphNode, actionNodes: graphNode.actionNodes.map((actionNode) => actionNode.id !== actionNodeId ? actionNode : updateAction(actionNode, selection, field, value))
  })) }
});

const updateAction = (action: ProjectActionNode, selection: AutomationSelection, field: string, value: string | number): ProjectActionNode => {
  if (selection === "settings") return { ...action, [field]: value };
  if (selection === "work") return { ...action, workNode: { ...action.workNode, [field]: value } } as ProjectActionNode;
  if (selection === "validation") return { ...action, validationNode: { ...action.validationNode, [field]: value } } as ProjectActionNode;
  return action;
};
