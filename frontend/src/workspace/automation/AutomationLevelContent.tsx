import type {
  AppData,
  PolicyPreviewResultV4,
  ProjectAutomationConfig
} from "@shared/api/workspace-contracts";
import { automationActionNodePath, automationGraphNodePath } from "../routing";
import type { EngineeringLevel, EngineeringSection } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import type { AutomationDialogState } from "./AutomationCrudDialogs";
import { type AutomationSelection, automationInspectorModel, updateAutomationSelection } from "./automationSelection";
import { CapabilityCards } from "./CapabilityCards";
import { DecisionModelWorkspace } from "./DecisionModelWorkspace";
import { EngineeringInspector } from "./EngineeringInspector";
import { ActionFlowCanvas } from "./ActionFlowCanvas";
import { actionNodeReferences, graphNodeReferences } from "./graphNodeAuthoring";

type GraphNode = ProjectAutomationConfig["graph"]["graphNodes"][number];
type ActionNode = GraphNode["actionNodes"][number];

export function AutomationLevelContent({
  draft, setDraft, data, level, section, graphNode, actionNode, graphNodeId, actionNodeId,
  selection, setSelection, locked, policyResult, policyLoading, navigate, setDialog
}: {
  draft: ProjectAutomationConfig;
  setDraft: React.Dispatch<React.SetStateAction<ProjectAutomationConfig>>;
  data: AppData;
  level: EngineeringLevel;
  section?: EngineeringSection;
  graphNode?: GraphNode;
  actionNode?: ActionNode;
  graphNodeId?: string;
  actionNodeId?: string;
  selection: AutomationSelection;
  setSelection: (selection: AutomationSelection) => void;
  locked: boolean;
  policyResult?: PolicyPreviewResultV4;
  policyLoading: boolean;
  navigate: WorkspaceNavigation["navigate"];
  setDialog: (dialog: AutomationDialogState | undefined) => void;
}) {
  if (level === "graph") {
    if (section === "decision-model") return <DecisionModelWorkspace
      scope="graph" strategy={draft.graph.strategy} nodes={draft.graph.graphNodes}
      acceptance={draft.graph.acceptance}
      issues={policyResult?.issues ?? []} preview={policyResult}
      loading={policyLoading} locked={locked}
      onStrategyChange={(strategy) => setDraft((config) => ({ ...config, graph: { ...config.graph, strategy } }))}
      onZoomNode={(id) => navigate(automationGraphNodePath(id, "decision-model"))}
    />;
    return <CapabilityCards
      nodes={draft.graph.graphNodes} kind="Graph Node" locked={locked}
      onAdd={() => setDialog({ kind: "create" })} onOpen={(id) => navigate(automationGraphNodePath(id))}
      onEdit={(id) => setDialog({ kind: "edit", id })} onRename={(id) => setDialog({ kind: "rename", id })}
      onDelete={(id) => setDialog({ kind: "delete", id })} deleteIssues={(id) => graphNodeReferences(draft, id)}
    />;
  }
  if (level === "graph_node" && graphNode) {
    if (section === "decision-model") return <DecisionModelWorkspace
      scope="graph_node" strategy={graphNode.strategy} nodes={graphNode.actionNodes}
      issues={policyResult?.issues ?? []} preview={policyResult} loading={policyLoading} locked={locked}
      onStrategyChange={(strategy) => setDraft((config) => ({
        ...config,
        graph: {
          ...config.graph,
          graphNodes: config.graph.graphNodes.map((node) => node.id === graphNode.id ? { ...node, strategy } : node)
        }
      }))}
    />;
    return <CapabilityCards
      nodes={graphNode.actionNodes} kind="Action Node" locked={locked}
      onAdd={() => setDialog({ kind: "create" })} onOpen={(id) => navigate(automationActionNodePath(graphNode.id, id))}
      onEdit={(id) => setDialog({ kind: "edit", id })} onRename={(id) => setDialog({ kind: "rename", id })}
      onDelete={(id) => setDialog({ kind: "delete", id })} deleteIssues={(id) => actionNodeReferences(graphNode, id)}
    />;
  }
  if (level === "action_node" && graphNode && actionNode) return <div className="flex min-h-0 flex-1">
    <ActionFlowCanvas
      action={actionNode} selected={selection === "work" || selection === "validation" ? selection : undefined}
      locked={locked} onWork={() => setSelection("work")} onValidation={() => setSelection("validation")}
    />
    <EngineeringInspector
      model={automationInspectorModel(selection, graphNode, actionNode, locked)} profiles={data.executionProfiles}
      instructions={data.instructions}
      onChange={(field, value) => setDraft((config) =>
        updateAutomationSelection(config, selection, graphNodeId, actionNodeId, field, value))}
      onClose={() => setSelection("none")}
    />
  </div>;
  return <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">
    The requested engineering node was not found.
  </div>;
}
