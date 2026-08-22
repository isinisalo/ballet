import { useEffect, useMemo, useState } from "react";
import { Eye, GitBranch, Pencil, Plus, Save, Settings2, Trash2 } from "lucide-react";
import {
  automationConfigSchema,
  type AppData,
  type CanvasNodeSize,
  type CanvasNodeStyle,
  type PolicyPreviewResultV1,
  type ProjectAutomationConfig,
  type ProjectSspGraphStrategyV1
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { automationGraphNodePath, automationJobNodePath } from "../routing";
import { automationGraphPath } from "../routing";
import type { EngineeringLevel } from "../types";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";
import { useAutomationDraft } from "./useAutomationDraft";
import { EngineeringShell } from "./EngineeringShell";
import { EngineeringInspector } from "./EngineeringInspector";
import { JobFlowCanvas } from "./JobFlowCanvas";
import { SpaceEngineeringCanvas, type SpaceCanvasNode } from "./SpaceEngineeringCanvas";
import { automationInspectorModel, updateAutomationSelection, type AutomationSelection } from "./automationSelection";
import { api } from "@/api";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { DecisionModelEditor } from "./DecisionModelEditor";
import { GraphNodeCreateDialog, GraphNodeRenameDialog } from "./GraphNodeCrudDialogs";
import { addGraphNode, createGenericGraphNode, removeGraphNode, renameGraphNode } from "./graphNodeAuthoring";
import { PolicyPreviewDialog } from "./PolicyPreviewDialog";

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
  const [selection, setSelection] = useState<AutomationSelection>(defaultSelection);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [policyResult, setPolicyResult] = useState<PolicyPreviewResultV1>();
  const [policyLoading, setPolicyLoading] = useState(false);
  useEffect(() => setSelection(defaultSelection()), [level, graphNodeId, jobNodeId]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty, "Discard unsaved Graph Engineering changes?");
  const parse = useMemo(() => automationConfigSchema.safeParse(draft), [draft]);
  const graphRunActive = data.activeRootRuns.some((run) => run.kind === "graph" && run.targetId === draft.graph.id && isActive(run.status));
  const graphNodeRunActive = Boolean(graphNode && data.activeRootRuns.some((run) =>
    (run.kind === "graph" && run.targetId === draft.graph.id) || (run.kind === "graph_node" && run.targetId === graphNode.id)));
  const locked = level === "graph" ? graphRunActive : graphNodeRunActive;
  useEffect(() => {
    if (draft.graph.strategy.kind !== "ssp_v1" || !parse.success) { setPolicyResult(undefined); setPolicyLoading(false); return; }
    let active = true;
    setPolicyLoading(true);
    const timer = window.setTimeout(() => {
      void api.previewPolicy(draft).then((result) => { if (active) setPolicyResult(result); })
        .catch((cause) => { if (active) setPolicyResult({ issues: [{ path: "graph.strategy", message: cause instanceof Error ? cause.message : "Unable to validate Decision Model." }] }); })
        .finally(() => { if (active) setPolicyLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [draft, parse.success]);
  const model = automationInspectorModel(level, selection, draft, graphNode, jobNode, locked);
  const change = (field: string, value: string | number) => setDraft((config) => updateAutomationSelection(
    config, level, selection, graphNodeId, jobNodeId, field, value
  ));
  const policyIssues = draft.graph.strategy.kind === "ssp_v1" ? policyResult?.issues ?? [] : [];
  const actions = <>
    {level === "graph" ? <Button type="button" size="sm" variant="outline" disabled={locked || draft.graph.graphNodes.length >= 40} onClick={() => setCreateOpen(true)}><Plus /> Graph Node</Button> : null}
    {level === "graph" && draft.graph.strategy.kind === "ssp_v1" ? <Button type="button" size="sm" variant="outline" onClick={() => setModelOpen(true)}><GitBranch /> Decision Model</Button> : null}
    {level === "graph" && draft.graph.strategy.kind === "ssp_v1" ? <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}><Eye /> Policy Preview</Button> : null}
    {level === "graph_node" && graphNode ? <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => setRenameOpen(true)}><Pencil /> Rename</Button> : null}
    {level === "graph_node" && graphNode ? <Button type="button" size="sm" variant="outline" disabled={locked || draft.graph.graphNodes.length <= 1} onClick={() => setDeleteOpen(true)}><Trash2 /> Delete</Button> : null}
    <Button type="button" size="sm" variant="outline" onClick={() => setSelection("settings")}><Settings2 /> Settings</Button>
    <Button type="button" size="sm" disabled={!isDirty || saving || !parse.success || locked || policyLoading || policyIssues.length > 0} onClick={() => void saveDraft()}><Save /> {saving ? "Saving…" : "Save"}</Button>
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
        {policyIssues.length ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription><strong>Decision Model is not runnable.</strong> {policyIssues[0]?.message}{policyIssues.length > 1 ? ` (${policyIssues.length - 1} more)` : ""}</AlertDescription></Alert> : null}
        {data.automationIssues.length ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{data.automationIssues[0]?.message}</AlertDescription></Alert> : null}
        <div className="flex min-h-0 min-w-0 flex-1">
          {level === "graph" ? <SpaceEngineeringCanvas
            hub={canvasNode(draft.graph.strategy.kind === "agent_v1"
              ? draft.graph.strategy.orchestrator : draft.graph.strategy, "Graph Orchestrator", graphRunActive)}
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
          /> : level === "job_node" && graphNode && jobNode ? <JobFlowCanvas
            job={jobNode}
            orchestratorId={graphNode.orchestrator.id}
            selected={selection === "work" || selection === "validation" ? selection : undefined}
            locked={graphNodeRunActive}
            onWork={() => setSelection("work")}
            onValidation={() => setSelection("validation")}
          /> : <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">The requested engineering node was not found.</div>}
          <EngineeringInspector model={model} profiles={data.executionProfiles} instructions={data.instructions} onChange={change} onClose={() => setSelection("none")} />
        </div>
      </div>
      <GraphNodeCreateDialog open={createOpen} onOpenChange={setCreateOpen} profiles={data.executionProfiles} instructions={data.instructions} existingIds={draft.graph.graphNodes.map(({ id }) => id)} onCreate={(input) => setDraft((config) => addGraphNode(config, createGenericGraphNode(input)))} />
      {graphNode ? <GraphNodeRenameDialog open={renameOpen} onOpenChange={setRenameOpen} currentId={graphNode.id} existingIds={draft.graph.graphNodes.map(({ id }) => id)} onRename={(id) => {
        const previous = graphNode.id;
        setDraft((config) => renameGraphNode(config, previous, id));
        navigate(automationGraphNodePath(id), { bypassBlocker: true });
      }} /> : null}
      {graphNode ? <DeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} deleteType="Graph Node" resourceName={graphNode.id} onConfirm={() => {
        setDraft((config) => removeGraphNode(config, graphNode.id));
        navigate(automationGraphPath(), { bypassBlocker: true });
      }} /> : null}
      {draft.graph.strategy.kind === "ssp_v1" ? <DecisionModelEditor open={modelOpen} onOpenChange={setModelOpen} strategy={draft.graph.strategy} graphNodeIds={draft.graph.graphNodes.map(({ id }) => id)} issues={policyIssues} locked={graphRunActive} onChange={(strategy: ProjectSspGraphStrategyV1) => setDraft((config) => ({ ...config, graph: { ...config.graph, strategy } }))} /> : null}
      <PolicyPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} result={policyResult} loading={policyLoading} />
    </EngineeringShell>
  );
}

const defaultSelection = (): AutomationSelection => "none";
const isActive = (status: string) => ["queued", "running", "waiting_for_input", "finalizing"].includes(status);
const canvasNode = (
  node: { id: string; description: string; nodeStyle: CanvasNodeStyle; nodeSize: CanvasNodeSize },
  role: string,
  active: boolean
): SpaceCanvasNode => ({ id: node.id, label: node.id, role, nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, active, locked: active });
