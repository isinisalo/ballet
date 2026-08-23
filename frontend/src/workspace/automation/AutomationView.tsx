import { useEffect, useMemo, useState } from "react";
import { Save, Settings2 } from "lucide-react";
import {
  automationConfigSchema, type AppData, type PolicyPreviewResultV2, type ProjectAutomationConfig,
  type ProjectGraphDecisionStrategyV2, type ProjectGraphNodeDecisionStrategyV2
} from "@shared/api/workspace-contracts";
import { api } from "@/api";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { automationGraphNodePath, automationGraphPath, automationJobNodePath } from "../routing";
import type { EngineeringLevel, EngineeringSection } from "../types";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";
import { automationInspectorModel, updateAutomationSelection, type AutomationSelection } from "./automationSelection";
import { CapabilityCards } from "./CapabilityCards";
import { CapabilityContractDialog } from "./CapabilityContractDialog";
import { DecisionModelWorkspace } from "./DecisionModelWorkspace";
import { EngineeringInspector } from "./EngineeringInspector";
import { EngineeringShell } from "./EngineeringShell";
import { GraphNodeCreateDialog, GraphNodeRenameDialog, JobNodeCreateDialog, JobNodeRenameDialog } from "./GraphNodeCrudDialogs";
import { JobFlowCanvas } from "./JobFlowCanvas";
import {
  addGraphNode, addJobNode, createGenericGraphNode, createGenericJobNode, jobNodeReferences,
  removeGraphNode, removeJobNode, renameGraphNode, renameJobNode
} from "./graphNodeAuthoring";
import { useAutomationDraft } from "./useAutomationDraft";

export function AutomationView({ data, level, section, graphNodeId, jobNodeId, saveAutomation, navigate, setNavigationBlocker }: {
  data: AppData; level: EngineeringLevel; section?: EngineeringSection; graphNodeId?: string; jobNodeId?: string;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: WorkspaceNavigation["navigate"]; setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const { draft, setDraft, saveDraft, isDirty, saving, error } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const graphNode = draft.graph.graphNodes.find((node) => node.id === graphNodeId);
  const jobNode = graphNode?.jobNodes.find((node) => node.id === jobNodeId);
  const [selection, setSelection] = useState<AutomationSelection>("none");
  const [dialog, setDialog] = useState<{ kind: "create" | "rename" | "edit" | "delete"; id?: string }>();
  const [policyResult, setPolicyResult] = useState<PolicyPreviewResultV2>();
  const [policyLoading, setPolicyLoading] = useState(false);
  useEffect(() => { setSelection("none"); setDialog(undefined); }, [level, graphNodeId, jobNodeId]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty, "Discard unsaved Graph Engineering changes?");
  const parse = useMemo(() => automationConfigSchema.safeParse(draft), [draft]);
  const graphRunActive = data.activeRootRuns.some((run) => run.kind === "graph" && run.targetId === draft.graph.id && active(run.status));
  const graphNodeRunActive = Boolean(graphNode && data.activeRootRuns.some((run) =>
    (run.kind === "graph" && run.targetId === draft.graph.id) || (run.kind === "graph_node" && run.targetId === graphNode.id)));
  const locked = level === "graph" ? graphRunActive : graphNodeRunActive;
  const activeStrategy = level === "graph" ? draft.graph.strategy : graphNode?.strategy;
  useEffect(() => {
    if (!parse.success || activeStrategy?.kind !== "ssp_v2" || level === "job_node") { setPolicyResult(undefined); setPolicyLoading(false); return; }
    let current = true; setPolicyLoading(true);
    const timer = window.setTimeout(() => void api.previewPolicy({
      config: draft, scope: level === "graph" ? "graph" : "graph_node", graphNodeId: level === "graph_node" ? graphNodeId : undefined
    }).then((result) => { if (current) setPolicyResult(result); }).catch((cause) => { if (current) setPolicyResult({ issues: [{ path: "strategy", message: cause instanceof Error ? cause.message : "Unable to compile policy." }] }); }).finally(() => { if (current) setPolicyLoading(false); }), 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [activeStrategy, draft, graphNodeId, level, parse.success]);

  const actions = <><Button type="button" size="sm" variant="outline" disabled={!isDirty || saving || !parse.success || locked} onClick={() => void saveDraft()}><Save /> {saving ? "Saving…" : "Save draft"}</Button>{level === "job_node" ? <Button type="button" size="sm" variant="outline" onClick={() => setSelection("settings")}><Settings2 /> Settings</Button> : null}</>;
  return <EngineeringShell level={level} section={section} graphNodeId={graphNode?.id} graphNodeTitle={graphNode?.description} jobNodeId={jobNode?.id} jobNodeTitle={jobNode?.description} actions={actions} navigate={navigate}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Notices error={error} parse={parse} automationIssues={data.automationIssues} />
      {level !== "job_node" ? <SectionTabs level={level} section={section} graphNodeId={graphNodeId} navigate={navigate} /> : null}
      {level === "graph" ? section === "decision-model" ? <DecisionModelWorkspace
        scopeKey={draft.graph.id} strategy={draft.graph.strategy}
        actionContracts={draft.graph.graphNodes.map(({ id, outcomes }) => ({ id, outcomes }))}
        repair={draft.graph.repairNode} issues={policyResult?.issues ?? []} preview={policyResult} loading={policyLoading} locked={locked}
        onStrategyChange={(strategy) => setDraft((config) => ({ ...config, graph: { ...config.graph, strategy: strategy as ProjectGraphDecisionStrategyV2 } }))}
        onRepairChange={(repairNode) => setDraft((config) => ({ ...config, graph: { ...config.graph, repairNode } }))}
      /> : <CapabilityCards nodes={draft.graph.graphNodes} kind="Graph Node" locked={locked} onAdd={() => setDialog({ kind: "create" })} onOpen={(id) => navigate(automationGraphNodePath(id))} onEdit={(id) => setDialog({ kind: "edit", id })} onRename={(id) => setDialog({ kind: "rename", id })} onDelete={(id) => setDialog({ kind: "delete", id })} />
        : level === "graph_node" && graphNode ? section === "local-decision-model" ? <DecisionModelWorkspace
          scopeKey={graphNode.id} strategy={graphNode.strategy}
          actionContracts={graphNode.jobNodes.map(({ id, outcomes }) => ({ id, outcomes }))}
          repair={graphNode.repairNode} issues={policyResult?.issues ?? []} preview={policyResult} loading={policyLoading} locked={locked}
          onStrategyChange={(strategy) => updateCurrentGraphNode(setDraft, graphNode.id, (node) => ({ ...node, strategy: strategy as ProjectGraphNodeDecisionStrategyV2 }))}
          onRepairChange={(repairNode) => updateCurrentGraphNode(setDraft, graphNode.id, (node) => ({ ...node, repairNode }))}
        /> : <CapabilityCards nodes={graphNode.jobNodes} kind="Job Node" locked={locked} onAdd={() => setDialog({ kind: "create" })} onOpen={(id) => navigate(automationJobNodePath(graphNode.id, id))} onEdit={(id) => setDialog({ kind: "edit", id })} onRename={(id) => setDialog({ kind: "rename", id })} onDelete={(id) => setDialog({ kind: "delete", id })} deleteIssues={(id) => jobNodeReferences(graphNode, id)} />
          : level === "job_node" && graphNode && jobNode ? <div className="flex min-h-0 flex-1"><JobFlowCanvas job={jobNode} selected={selection === "work" || selection === "validation" ? selection : undefined} locked={locked} onWork={() => setSelection("work")} onValidation={() => setSelection("validation")} /><EngineeringInspector model={automationInspectorModel(selection, graphNode, jobNode, locked)} profiles={data.executionProfiles} instructions={data.instructions} onChange={(field, value) => setDraft((config) => updateAutomationSelection(config, selection, graphNodeId, jobNodeId, field, value))} onClose={() => setSelection("none")} /></div>
            : <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">The requested engineering node was not found.</div>}
    </div>
    <CrudDialogs dialog={dialog} setDialog={setDialog} data={data} draft={draft} setDraft={setDraft} graphNode={graphNode} level={level} navigate={navigate} />
  </EngineeringShell>;
}

function SectionTabs({ level, section, graphNodeId, navigate }: { level: EngineeringLevel; section?: EngineeringSection; graphNodeId?: string; navigate: WorkspaceNavigation["navigate"] }) {
  const entries = level === "graph" ? [["Capability Graph", "capabilities"], ["Decision Model", "decision-model"]] as const : [["Jobs", "jobs"], ["Local Decision Model & Repair", "local-decision-model"]] as const;
  return <nav className="flex shrink-0 gap-1 border-b border-divider-strong bg-card px-3 pt-2" aria-label="Engineering sections">{entries.map(([label, value]) => <Button key={value} size="sm" variant={section === value || (!section && value === entries[0][1]) ? "secondary" : "ghost"} className="rounded-b-none" onClick={() => navigate(level === "graph" ? automationGraphPath(value as "capabilities" | "decision-model") : automationGraphNodePath(graphNodeId!, value as "jobs" | "local-decision-model"))}>{label}</Button>)}</nav>;
}

function Notices({ error, parse, automationIssues }: { error?: string; parse: ReturnType<typeof automationConfigSchema.safeParse>; automationIssues: Array<{ message: string }> }) { return <>{error ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}{!parse.success ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{parse.error.issues[0]?.message ?? "Graph configuration is structurally invalid."}</AlertDescription></Alert> : null}{automationIssues.length ? <Alert className="m-3 mb-0"><AlertDescription>Saved configuration: {automationIssues[0]?.message}</AlertDescription></Alert> : null}</>; }
const active = (status: string) => ["queued", "running", "waiting_for_input", "finalizing"].includes(status);
const updateCurrentGraphNode = (setDraft: React.Dispatch<React.SetStateAction<ProjectAutomationConfig>>, id: string, update: (node: ProjectAutomationConfig["graph"]["graphNodes"][number]) => ProjectAutomationConfig["graph"]["graphNodes"][number]) => setDraft((config) => ({ ...config, graph: { ...config.graph, graphNodes: config.graph.graphNodes.map((node) => node.id === id ? update(node) : node) } }));

function CrudDialogs({ dialog, setDialog, data, draft, setDraft, graphNode, level, navigate }: { dialog?: { kind: "create" | "rename" | "edit" | "delete"; id?: string }; setDialog: (value: { kind: "create" | "rename" | "edit" | "delete"; id?: string } | undefined) => void; data: AppData; draft: ProjectAutomationConfig; setDraft: React.Dispatch<React.SetStateAction<ProjectAutomationConfig>>; graphNode?: ProjectAutomationConfig["graph"]["graphNodes"][number]; level: EngineeringLevel; navigate: WorkspaceNavigation["navigate"] }) {
  const graphEntity = draft.graph.graphNodes.find(({ id }) => id === dialog?.id);
  const jobEntity = graphNode?.jobNodes.find(({ id }) => id === dialog?.id);
  const entity = level === "graph" ? graphEntity : jobEntity;
  const createProps = { open: dialog?.kind === "create", onOpenChange: (open: boolean) => { if (!open) setDialog(undefined); }, profiles: data.executionProfiles, instructions: data.instructions, existingIds: level === "graph" ? draft.graph.graphNodes.map(({ id }) => id) : graphNode?.jobNodes.map(({ id }) => id) ?? [] };
  return <>
    {level === "graph" ? <GraphNodeCreateDialog {...createProps} onCreate={(input) => setDraft((config) => addGraphNode(config, createGenericGraphNode(input)))} /> : graphNode ? <JobNodeCreateDialog {...createProps} onCreate={(input) => setDraft((config) => addJobNode(config, graphNode.id, createGenericJobNode(input)))} /> : null}
    {dialog?.kind === "rename" && entity ? level === "graph" ? <GraphNodeRenameDialog open onOpenChange={(open) => { if (!open) setDialog(undefined); }} currentId={entity.id} existingIds={draft.graph.graphNodes.map(({ id }) => id)} onRename={(id) => { setDraft((config) => renameGraphNode(config, entity.id, id)); navigate(automationGraphNodePath(id), { bypassBlocker: true }); }} /> : graphNode ? <JobNodeRenameDialog open onOpenChange={(open) => { if (!open) setDialog(undefined); }} currentId={entity.id} existingIds={graphNode.jobNodes.map(({ id }) => id)} onRename={(id) => { setDraft((config) => renameJobNode(config, graphNode.id, entity.id, id)); navigate(automationGraphNodePath(graphNode.id), { bypassBlocker: true }); }} /> : null : null}
    <CapabilityContractDialog node={dialog?.kind === "edit" ? entity : undefined} open={dialog?.kind === "edit" && Boolean(entity)} locked={false} onOpenChange={(open) => { if (!open) setDialog(undefined); }} onSave={(patch) => {
      if (!entity) return;
      if (level === "graph") setDraft((config) => ({ ...config, graph: { ...config.graph, graphNodes: config.graph.graphNodes.map((node) => node.id === entity.id ? { ...node, description: patch.description, capabilities: patch.capabilities, outcomes: patch.outcomes, stateContract: { description: patch.stateDescription ?? node.stateContract.description } } : node) } }));
      else if (graphNode) updateCurrentGraphNode(setDraft, graphNode.id, (node) => ({ ...node, jobNodes: node.jobNodes.map((job) => job.id === entity.id ? { ...job, description: patch.description, capabilities: patch.capabilities, outcomes: patch.outcomes } : job) }));
    }} />
    {dialog?.kind === "delete" && entity ? <DeleteConfirmDialog open onOpenChange={(open) => { if (!open) setDialog(undefined); }} deleteType={level === "graph" ? "Graph Node" : "Job Node"} resourceName={entity.id} onConfirm={() => {
      if (level === "graph") { setDraft((config) => removeGraphNode(config, entity.id)); navigate(automationGraphPath(), { bypassBlocker: true }); }
      else if (graphNode) setDraft((config) => removeJobNode(config, graphNode.id, entity.id));
    }} /> : null}
  </>;
}
