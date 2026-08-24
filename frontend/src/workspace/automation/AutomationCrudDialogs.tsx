import type { AppData, ProjectAutomationConfig, ProjectIntrinsicOutcome } from "@shared/api/workspace-contracts";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { automationGraphNodePath, automationGraphPath } from "../routing";
import type { EngineeringLevel } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { CapabilityContractDialog } from "./CapabilityContractDialog";
import {
  ActionNodeCreateDialog,
  ActionNodeRenameDialog,
  GraphNodeCreateDialog,
  GraphNodeRenameDialog
} from "./GraphNodeCrudDialogs";
import {
  addGraphNode,
  addActionNode,
  createGenericGraphNode,
  createGenericActionNode,
  removeGraphNode,
  removeActionNode,
  renameGraphNode,
  renameActionNode
} from "./graphNodeAuthoring";

type GraphNode = ProjectAutomationConfig["graph"]["graphNodes"][number];
type Entity = GraphNode | GraphNode["actionNodes"][number];
export type AutomationDialogState = { kind: "create" | "rename" | "edit" | "delete"; id?: string };
type SetDraft = React.Dispatch<React.SetStateAction<ProjectAutomationConfig>>;

export function AutomationCrudDialogs({
  dialog, setDialog, data, draft, setDraft, graphNode, level, navigate
}: {
  dialog?: AutomationDialogState;
  setDialog: (value: AutomationDialogState | undefined) => void;
  data: AppData;
  draft: ProjectAutomationConfig;
  setDraft: SetDraft;
  graphNode?: GraphNode;
  level: EngineeringLevel;
  navigate: WorkspaceNavigation["navigate"];
}) {
  const entity = level === "graph"
    ? draft.graph.graphNodes.find(({ id }) => id === dialog?.id)
    : graphNode?.actionNodes.find(({ id }) => id === dialog?.id);
  const close = (open: boolean) => { if (!open) setDialog(undefined); };
  return <>
    <CreateDialog dialog={dialog} close={close} data={data} draft={draft} setDraft={setDraft} graphNode={graphNode} level={level} />
    <RenameDialog dialog={dialog} close={close} draft={draft} setDraft={setDraft} graphNode={graphNode} entity={entity} level={level} navigate={navigate} />
    <CapabilityContractDialog
      node={dialog?.kind === "edit" ? entity : undefined} open={dialog?.kind === "edit" && Boolean(entity)}
      locked={false} onOpenChange={close}
      onSave={(patch) => saveContract(setDraft, level, graphNode, entity, patch)}
    />
    <RemoveDialog dialog={dialog} close={close} setDraft={setDraft} graphNode={graphNode} entity={entity} level={level} navigate={navigate} />
  </>;
}

function CreateDialog({ dialog, close, data, draft, setDraft, graphNode, level }: {
  dialog?: AutomationDialogState; close: (open: boolean) => void; data: AppData;
  draft: ProjectAutomationConfig; setDraft: SetDraft; graphNode?: GraphNode; level: EngineeringLevel;
}) {
  const common = {
    open: dialog?.kind === "create", onOpenChange: close, profiles: data.executionProfiles,
    instructions: data.instructions,
    existingIds: level === "graph" ? draft.graph.graphNodes.map(({ id }) => id) : graphNode?.actionNodes.map(({ id }) => id) ?? []
  };
  if (level === "graph") return <GraphNodeCreateDialog
    {...common} onCreate={(input) => setDraft((config) => addGraphNode(config, createGenericGraphNode(input)))}
  />;
  if (!graphNode) return null;
  return <ActionNodeCreateDialog
    {...common} onCreate={(input) => setDraft((config) => addActionNode(config, graphNode.id, createGenericActionNode(input)))}
  />;
}

function RenameDialog({ dialog, close, draft, setDraft, graphNode, entity, level, navigate }: {
  dialog?: AutomationDialogState; close: (open: boolean) => void; draft: ProjectAutomationConfig;
  setDraft: SetDraft; graphNode?: GraphNode; entity?: Entity; level: EngineeringLevel;
  navigate: WorkspaceNavigation["navigate"];
}) {
  if (dialog?.kind !== "rename" || !entity) return null;
  if (level === "graph") return <GraphNodeRenameDialog
    open onOpenChange={close} currentId={entity.id} existingIds={draft.graph.graphNodes.map(({ id }) => id)}
    onRename={(id) => {
      setDraft((config) => renameGraphNode(config, entity.id, id));
      navigate(automationGraphNodePath(id), { bypassBlocker: true });
    }}
  />;
  if (!graphNode) return null;
  return <ActionNodeRenameDialog
    open onOpenChange={close} currentId={entity.id} existingIds={graphNode.actionNodes.map(({ id }) => id)}
    onRename={(id) => {
      setDraft((config) => renameActionNode(config, graphNode.id, entity.id, id));
      navigate(automationGraphNodePath(graphNode.id), { bypassBlocker: true });
    }}
  />;
}

function RemoveDialog({ dialog, close, setDraft, graphNode, entity, level, navigate }: {
  dialog?: AutomationDialogState; close: (open: boolean) => void; setDraft: SetDraft;
  graphNode?: GraphNode; entity?: Entity; level: EngineeringLevel; navigate: WorkspaceNavigation["navigate"];
}) {
  if (dialog?.kind !== "delete" || !entity) return null;
  return <DeleteConfirmDialog
    open onOpenChange={close} deleteType={level === "graph" ? "Graph Node" : "Action Node"} resourceName={entity.id}
    onConfirm={() => {
      if (level === "graph") {
        setDraft((config) => removeGraphNode(config, entity.id));
        navigate(automationGraphPath(), { bypassBlocker: true });
      } else if (graphNode) setDraft((config) => removeActionNode(config, graphNode.id, entity.id));
    }}
  />;
}

function saveContract(
  setDraft: SetDraft,
  level: EngineeringLevel,
  graphNode: GraphNode | undefined,
  entity: Entity | undefined,
  patch: { description: string; capabilities: Entity["capabilities"]; outcomes: ProjectIntrinsicOutcome[]; stateDescription?: string }
) {
  if (!entity) return;
  if (level === "graph") {
    setDraft((config) => ({
      ...config,
      graph: {
        ...config.graph,
        graphNodes: config.graph.graphNodes.map((node) => node.id === entity.id ? {
          ...node, description: patch.description, capabilities: patch.capabilities,
          outcomes: patch.outcomes.map((outcome) => ({
            ...outcome,
            acceptanceEffects: node.outcomes.find(({ outcomeId }) => outcomeId === outcome.outcomeId)?.acceptanceEffects ?? []
          })), stateContract: { description: patch.stateDescription ?? node.stateContract.description }
        } : node)
      }
    }));
    return;
  }
  if (graphNode) updateGraphNode(setDraft, graphNode.id, (node) => ({
    ...node,
    actionNodes: node.actionNodes.map((action) => action.id === entity.id ? {
      ...action, description: patch.description, capabilities: patch.capabilities, outcomes: patch.outcomes
    } : action)
  }));
}

const updateGraphNode = (setDraft: SetDraft, id: string, update: (node: GraphNode) => GraphNode) =>
  setDraft((config) => ({
    ...config,
    graph: { ...config.graph, graphNodes: config.graph.graphNodes.map((node) => node.id === id ? update(node) : node) }
  }));
