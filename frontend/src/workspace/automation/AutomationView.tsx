import { useEffect, useMemo, useState } from "react";
import { Save, Settings2 } from "lucide-react";
import {
  automationConfigSchema,
  type AppData,
  type PolicyPreviewResultV3,
  type ProjectAutomationConfig
} from "@shared/api/workspace-contracts";
import { api } from "@/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { automationGraphNodePath, automationGraphPath } from "../routing";
import type { EngineeringLevel, EngineeringSection } from "../types";
import { useWorkspaceNavigationBlocker, type WorkspaceNavigation } from "../useWorkspaceNavigation";
import { type AutomationSelection } from "./automationSelection";
import { AutomationCrudDialogs, type AutomationDialogState } from "./AutomationCrudDialogs";
import { AutomationLevelContent } from "./AutomationLevelContent";
import { EngineeringShell } from "./EngineeringShell";
import { useAutomationDraft } from "./useAutomationDraft";

export function AutomationView({ data, level, section, graphNodeId, actionNodeId, saveAutomation, navigate, setNavigationBlocker }: {
  data: AppData; level: EngineeringLevel; section?: EngineeringSection; graphNodeId?: string; actionNodeId?: string;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: WorkspaceNavigation["navigate"]; setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  const { draft, setDraft, saveDraft, isDirty, saving, error } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const graphNode = draft.graph.graphNodes.find((node) => node.id === graphNodeId);
  const actionNode = graphNode?.actionNodes.find((node) => node.id === actionNodeId);
  const [selection, setSelection] = useState<AutomationSelection>("none");
  const [dialog, setDialog] = useState<AutomationDialogState>();
  const [policyResult, setPolicyResult] = useState<PolicyPreviewResultV3>();
  const [policyLoading, setPolicyLoading] = useState(false);
  useEffect(() => { setSelection("none"); setDialog(undefined); }, [level, graphNodeId, actionNodeId]);
  useWorkspaceNavigationBlocker(setNavigationBlocker, isDirty, "Discard unsaved Graph Engineering changes?");
  const parse = useMemo(() => automationConfigSchema.safeParse(draft), [draft]);
  const graphRunActive = data.activeRootRuns.some((run) => run.kind === "graph" && run.targetId === draft.graph.id && active(run.status));
  const graphNodeRunActive = Boolean(graphNode && data.activeRootRuns.some((run) =>
    (run.kind === "graph" && run.targetId === draft.graph.id) || (run.kind === "graph_node" && run.targetId === graphNode.id)));
  const locked = level === "graph" ? graphRunActive : graphNodeRunActive;
  useEffect(() => {
    if (!parse.success || level !== "graph" || section !== "decision-model") {
      setPolicyResult(undefined);
      setPolicyLoading(false);
      return;
    }
    let current = true; setPolicyLoading(true);
    const timer = window.setTimeout(() => void api.previewPolicy({ config: draft })
      .then((result) => { if (current) setPolicyResult(result); })
      .catch((cause) => {
        if (current) setPolicyResult({
          issues: [{ path: "graph.strategy", message: cause instanceof Error ? cause.message : "Unable to compile policy." }]
        });
      })
      .finally(() => { if (current) setPolicyLoading(false); }), 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [draft, level, parse.success, section]);

  const actions = <><Button type="button" size="sm" variant="outline" disabled={!isDirty || saving || !parse.success || locked} onClick={() => void saveDraft()}><Save /> {saving ? "Saving…" : "Save draft"}</Button>{level === "action_node" ? <Button type="button" size="sm" variant="outline" onClick={() => setSelection("settings")}><Settings2 /> Settings</Button> : null}</>;
  return <EngineeringShell level={level} section={section} graphNodeId={graphNode?.id} graphNodeTitle={graphNode?.description} actionNodeId={actionNode?.id} actionNodeTitle={actionNode?.description} actions={actions} navigate={navigate}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Notices error={error} parse={parse} automationIssues={visibleAutomationIssues(section, data.automationIssues)} />
      {level !== "action_node" ? <SectionTabs level={level} section={section} graphNodeId={graphNodeId} navigate={navigate} /> : null}
      <AutomationLevelContent
        draft={draft} setDraft={setDraft} data={data} level={level} section={section} graphNode={graphNode}
        actionNode={actionNode} graphNodeId={graphNodeId} actionNodeId={actionNodeId} selection={selection}
        setSelection={setSelection} locked={locked} policyResult={policyResult} policyLoading={policyLoading}
        navigate={navigate} setDialog={setDialog}
      />
    </div>
    <AutomationCrudDialogs dialog={dialog} setDialog={setDialog} data={data} draft={draft} setDraft={setDraft} graphNode={graphNode} level={level} navigate={navigate} />
  </EngineeringShell>;
}

function SectionTabs({ level, section, graphNodeId, navigate }: { level: EngineeringLevel; section?: EngineeringSection; graphNodeId?: string; navigate: WorkspaceNavigation["navigate"] }) {
  const entries = level === "graph"
    ? [["Capability Graph", "capabilities"], ["Decision Model", "decision-model"]] as const
    : [["Ordered Actions", "actions"]] as const;
  return <nav className="flex shrink-0 gap-1 border-b border-divider-strong bg-card px-3 pt-2" aria-label="Engineering sections">{entries.map(([label, value]) => <Button key={value} size="sm" variant={section === value || (!section && value === entries[0][1]) ? "secondary" : "ghost"} className="rounded-b-none" onClick={() => navigate(level === "graph" ? automationGraphPath(value as "capabilities" | "decision-model") : automationGraphNodePath(graphNodeId!))}>{label}</Button>)}</nav>;
}

function Notices({ error, parse, automationIssues }: { error?: string; parse: ReturnType<typeof automationConfigSchema.safeParse>; automationIssues: Array<{ message: string }> }) { return <>{error ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}{!parse.success ? <Alert variant="destructive" className="m-3 mb-0"><AlertDescription>{parse.error.issues[0]?.message ?? "Graph configuration is structurally invalid."}</AlertDescription></Alert> : null}{automationIssues.length ? <Alert className="m-3 mb-0"><AlertDescription>Saved configuration: {automationIssues[0]?.message}</AlertDescription></Alert> : null}</>; }
const active = (status: string) => ["queued", "running", "waiting_for_input", "finalizing"].includes(status);
const visibleAutomationIssues = (section: EngineeringSection | undefined, issues: Array<{ message: string }>) => section === "decision-model" ? [] : issues;
