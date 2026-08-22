import { useEffect, useMemo, useState } from "react";
import { Save, Settings2 } from "lucide-react";
import {
  automationConfigSchema,
  routeTargetKey,
  type AppData,
  type CanvasNodeSize,
  type CanvasNodeStyle,
  type ProjectGraphNode,
  type ProjectJobNode,
  type ProjectOrchestrator,
  type ProjectRepairNode,
  type ProjectWorkNode,
  type ProjectValidationNode,
  type ProjectAutomationConfig
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { automationGraphNodePath, automationJobNodePath } from "../routing";
import type { EngineeringLevel } from "../types";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";
import { useAutomationDraft } from "./useAutomationDraft";
import { EngineeringShell } from "./EngineeringShell";
import { EngineeringInspector, type EngineeringInspectorModel } from "./EngineeringInspector";
import { JobEngineeringCanvas, SpaceEngineeringCanvas, type SpaceCanvasNode } from "./SpaceEngineeringCanvas";

type SelectionKind = "none" | "settings" | "orchestrator" | "repair" | "work" | "validation";

export function AutomationView({ data, level, graphNodeId, jobNodeId, saveAutomation, navigate, setNavigationBlocker }: {
  data: AppData;
  level: EngineeringLevel;
  graphNodeId?: string;
  jobNodeId?: string;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const { draft, setDraft, saveDraft, isDirty, saving, error } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const graphNode = draft.graph.graphNodes.find((node) => node.id === graphNodeId);
  const jobNode = graphNode?.jobNodes.find((node) => node.id === jobNodeId);
  const [selection, setSelection] = useState<SelectionKind>(defaultSelection);
  useEffect(() => setSelection(defaultSelection()), [level, graphNodeId, jobNodeId]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty, "Discard unsaved Graph Engineering changes?");
  const parse = useMemo(() => automationConfigSchema.safeParse(draft), [draft]);
  const graphRunActive = data.activeRootRuns.some((run) => run.kind === "graph" && run.targetId === draft.graph.id && isActive(run.status));
  const graphNodeRunActive = Boolean(graphNode && data.activeRootRuns.some((run) =>
    (run.kind === "graph" && run.targetId === draft.graph.id) || (run.kind === "graph_node" && run.targetId === graphNode.id)));
  const locked = level === "graph" ? graphRunActive : graphNodeRunActive;
  const model = inspectorModel(level, selection, draft, graphNode, jobNode, locked);
  const change = (field: string, value: string | number) => setDraft((config) => updateSelection(
    config, level, selection, graphNodeId, jobNodeId, field, value
  ));
  const actions = <>
    <Button type="button" size="sm" variant="outline" onClick={() => setSelection("settings")}><Settings2 /> Settings</Button>
    <Button type="button" size="sm" disabled={!isDirty || saving || !parse.success || locked} onClick={() => void saveDraft()}><Save /> {saving ? "Saving…" : "Save"}</Button>
  </>;
  return (
    <EngineeringShell
      level={level}
      graphNodeId={graphNode?.id}
      graphNodeTitle={graphNode?.description}
      jobNodeId={jobNode?.id}
      jobNodeTitle={jobNode?.description}
      actions={actions}
      navigate={navigate}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {error ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
        {!parse.success ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{parse.error.issues[0]?.message ?? "Graph configuration is invalid."}</AlertDescription></Alert> : null}
        {data.automationIssues.length ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{data.automationIssues[0]?.message}</AlertDescription></Alert> : null}
        <div className="flex min-h-0 min-w-0 flex-1">
          {level === "graph" ? <SpaceEngineeringCanvas
            hub={canvasNode(draft.graph.orchestrator, "Graph Orchestrator", graphRunActive)}
            repair={draft.graph.repairNode ? canvasNode(draft.graph.repairNode, "Repair Node", graphRunActive) : undefined}
            children={draft.graph.graphNodes.map((node) => canvasNode(node, "Graph Node", graphNodeRunActive && node.id === graphNodeId))}
            onHub={() => setSelection("orchestrator")}
            onRepair={() => setSelection("repair")}
            onChild={(id) => navigate(automationGraphNodePath(id))}
          /> : level === "graph_node" && graphNode ? <SpaceEngineeringCanvas
            hub={canvasNode(graphNode.orchestrator, "Graph Node Orchestrator", graphNodeRunActive)}
            repair={graphNode.repairNode ? canvasNode(graphNode.repairNode, "Repair Node", graphNodeRunActive) : undefined}
            children={graphNode.jobNodes.map((node) => canvasNode(node, "Job Node", graphNodeRunActive && node.id === jobNodeId))}
            onHub={() => setSelection("orchestrator")}
            onRepair={() => setSelection("repair")}
            onChild={(id) => navigate(automationJobNodePath(graphNode.id, id))}
          /> : level === "job_node" && graphNode && jobNode ? <JobEngineeringCanvas
            work={canvasNode(jobNode.workNode, "Work Node", graphNodeRunActive)}
            validation={canvasNode(jobNode.validationNode, "Validation Node", graphNodeRunActive)}
            onWork={() => setSelection("work")}
            onValidation={() => setSelection("validation")}
          /> : <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">The requested engineering node was not found.</div>}
          <EngineeringInspector model={model} profiles={data.executionProfiles} instructions={data.instructions} onChange={change} onClose={() => setSelection("none")} />
        </div>
      </div>
    </EngineeringShell>
  );
}

const defaultSelection = (): SelectionKind => "none";
const isActive = (status: string) => ["queued", "running", "waiting_for_input", "finalizing"].includes(status);
const canvasNode = (
  node: { id: string; description: string; nodeStyle: CanvasNodeStyle; nodeSize: CanvasNodeSize },
  role: string,
  active: boolean
): SpaceCanvasNode => ({ id: node.id, label: node.id, role, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, active, locked: active });

function inspectorModel(
  level: EngineeringLevel,
  selection: SelectionKind,
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
  if (selection === "settings") return {
    ...metadataModel(jobNode, "Job Node", locked), maxRetries: jobNode.maxRetries
  };
  if (selection === "validation") return executableModel(jobNode.validationNode, "Validation Node", locked);
  return executableModel(jobNode.workNode, "Work Node", locked);
}

function metadataModel(node: ProjectGraphNode | ProjectJobNode, role: string, locked: boolean): EngineeringInspectorModel {
  return {
    key: `${role}:${node.id}`, role, title: node.description, id: node.id, description: node.description,
    nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, accepts: node.capabilities.accepts,
    provides: node.capabilities.provides, locked
  };
}
function executableModel(node: ProjectWorkNode | ProjectValidationNode, role: string, locked: boolean): EngineeringInspectorModel {
  return {
    key: `${role}:${node.id}`, role, title: node.description, id: node.id, description: node.description,
    task: node.task, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
    ...(node.type === "agent" ? { executionProfileId: node.executionProfileId, primaryInstructionId: node.primaryInstructionId } : {}),
    locked
  };
}
function repairModel(node: ProjectRepairNode, role: string, locked: boolean): EngineeringInspectorModel {
  return {
    key: `${role}:${node.id}`, role, title: node.description, id: node.id, description: node.description,
    task: node.task, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize,
    executionProfileId: node.executionProfileId, primaryInstructionId: node.primaryInstructionId,
    maxRepairDepth: node.maxRepairDepth, maxRepairAttempts: node.maxRepairAttempts, locked
  };
}
function orchestratorModel<T>(node: ProjectOrchestrator<T>, role: string, locked: boolean): EngineeringInspectorModel {
  const rules = [node.routing.start, ...node.routing.continuation, ...node.routing.repair];
  return {
    key: `${role}:${node.id}`, role, title: node.description, id: node.id, description: node.description,
    nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, executionProfileId: node.executionProfileId,
    primaryInstructionId: node.primaryInstructionId, maxTransitions: node.maxTransitions,
    maxRouteAttempts: node.maxRouteAttempts,
    candidates: rules.map((rule) => ({
      label: rule.id,
      values: rule.candidates.map((candidate) => routeTargetKey(candidate.target as never))
    })),
    locked
  };
}

function updateSelection(
  config: ProjectAutomationConfig,
  level: EngineeringLevel,
  selection: SelectionKind,
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
    if (!node) return config;
    return { ...config, graph: { ...config.graph, [key]: { ...node, [field]: value } } };
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
    const nextJob = selection === "settings"
      ? { ...job, [field]: value }
      : selection === "validation"
        ? { ...job, validationNode: { ...job.validationNode, [field]: value } }
        : { ...job, workNode: { ...job.workNode, [field]: value } };
    nextGraphNode = { ...graphNode, jobNodes: graphNode.jobNodes.map((node, index) => index === jobIndex ? nextJob : node) };
  }
  return {
    ...config,
    graph: { ...config.graph, graphNodes: config.graph.graphNodes.map((node, index) => index === graphNodeIndex ? nextGraphNode : node) }
  };
}
