import { Copy, Pencil, Pause, Play, Plus, TestTube2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AgentRun, AppData } from "backend/shared/domain";
import type { FlowCreateDraft, FlowSettingsUpdateDraft, FlowTestResult, FlowViewModel } from "backend/shared/flow";
import { api } from "@/api";
import { DiagnosticsList, HealthBadge } from "@/components/diagnostics/DiagnosticsList";
import { Button, EmptyState, PageHeader, Section, TechnicalDetails } from "@/components/forms/FormControls";
import { Badge } from "@/components/ui/badge";
import { CreateFlowWizard } from "@/features/flows/components/CreateFlowWizard";
import { FlowInspector } from "@/features/flows/components/FlowInspector";
import { FlowSequence } from "@/features/flows/components/FlowSequence";
import { FlowTestPanel } from "@/features/flows/components/FlowTestPanel";
import {
  defaultSelection,
  flowEditDraftFromFlow,
  flowCreateDraftFromFlow,
  flowPath,
  selectionExists,
  type FlowSelection
} from "@/features/flows/model/flow-page-model";

const runTimestamp = (run: AgentRun): number => Date.parse(run.updatedAt || run.createdAt);

const runStatusLabel = (status?: AgentRun["status"]): string => {
  if (!status) return "No runs yet";
  if (status === "needs_input") return "Needs input";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const buildMostRecentRunByOperation = (runs: AgentRun[]): Map<string, AgentRun> => {
  const runsByOperation = new Map<string, AgentRun>();
  for (const run of runs) {
    if (!run.operationId || run.operationVersion === undefined) continue;
    const key = `${run.operationId}@${run.operationVersion}`;
    const current = runsByOperation.get(key);
    if (!current || runTimestamp(run) > runTimestamp(current)) runsByOperation.set(key, run);
  }
  return runsByOperation;
};

const mostRecentRunForFlow = (
  flow: FlowViewModel,
  runsByOperation: Map<string, AgentRun>
): AgentRun | undefined => {
  let latest: AgentRun | undefined;
  for (const node of flow.nodes) {
    if (node.kind !== "operation") continue;
    const run = runsByOperation.get(`${node.operationId}@${node.version}`);
    if (run && (!latest || runTimestamp(run) > runTimestamp(latest))) latest = run;
  }
  return latest;
};

const activationBlockReason = (flow: FlowViewModel): string | undefined => {
  if (flow.active || flow.health !== "invalid") return undefined;
  const firstError = flow.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  return firstError
    ? `Fix ${firstError.title.toLowerCase()} before activating this Flow.`
    : "Fix configuration problems before activating this Flow.";
};

export function FlowsPage({
  data,
  flows,
  selectedFlowId,
  selectedFlowVersion,
  refresh,
  navigate
}: {
  data: AppData;
  flows: FlowViewModel[];
  selectedFlowId?: string;
  selectedFlowVersion?: number;
  refresh: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  const [creating, setCreating] = useState(new URLSearchParams(window.location.search).get("create") === "1");
  const [createInitialDraft, setCreateInitialDraft] = useState<FlowCreateDraft | undefined>();
  const [createWizardKey, setCreateWizardKey] = useState(0);
  const [flowTest, setFlowTest] = useState<FlowTestResult | undefined>();
  const [flowTestError, setFlowTestError] = useState("");
  const [selectedItem, setSelectedItem] = useState<FlowSelection | undefined>();
  const selectedFlow = selectedFlowId
    ? flows.find((flow) => flow.id === selectedFlowId && (selectedFlowVersion === undefined || flow.version === selectedFlowVersion))
      ?? flows.find((flow) => flow.id === selectedFlowId)
      ?? flows[0]
    : flows[0];
  const effectiveSelection = selectedFlow && selectionExists(selectedFlow, selectedItem) ? selectedItem : defaultSelection(selectedFlow);

  useEffect(() => {
    setSelectedItem(defaultSelection(selectedFlow));
  }, [selectedFlow?.id, selectedFlow?.version]);

  const openCreate = (initialDraft?: FlowCreateDraft) => {
    setCreateInitialDraft(initialDraft);
    setCreateWizardKey((key) => key + 1);
    setCreating(true);
  };
  const closeCreate = () => {
    setCreating(false);
    setCreateInitialDraft(undefined);
  };
  const activate = async (flow: FlowViewModel) => {
    if (flow.active) await api.pauseFlow(flow.id, flow.version);
    else await api.activateFlow(flow.id, flow.version);
    await refresh();
  };
  const testSelectedFlow = async (flow: FlowViewModel) => {
    setFlowTestError("");
    try {
      setFlowTest(await api.testFlow(flow.id, {}, flow.version));
    } catch (error) {
      setFlowTest(undefined);
      setFlowTestError(error instanceof Error ? error.message : "Unable to test Flow.");
    }
  };
  const updateSettings = async (flow: FlowViewModel, draft: FlowSettingsUpdateDraft) => {
    const saved = await api.updateFlow(flow.id, draft, flow.version);
    await refresh();
    navigate(flowPath(saved));
    setSelectedItem({ kind: "settings", id: saved.id });
  };
  const mostRecentRunByOperation = useMemo(() => buildMostRecentRunByOperation(data.agentRuns), [data.agentRuns]);
  const blockActivationReason = selectedFlow ? activationBlockReason(selectedFlow) : undefined;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Flows"
        description="Human-readable views over Loop definitions, routing rules, agent tasks, and emission rules."
        action={<Button onClick={() => openCreate()}><Plus className="size-4" />Create Flow</Button>}
      />
      {creating ? (
        <CreateFlowWizard
          key={createWizardKey}
          data={data}
          initialDraft={createInitialDraft}
          onCancel={closeCreate}
          onCreated={async (flow) => { closeCreate(); await refresh(); navigate(flowPath(flow)); }}
        />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Section title="Flow Catalog">
          {flows.length === 0 ? <EmptyState title="No Flows yet." action={<Button onClick={() => openCreate()}>Create Flow</Button>} /> : (
            <div className="grid gap-3">
              {flows.map((flow) => {
                const operationCount = flow.nodes.filter((node) => node.kind === "operation").length;
                const branchCount = flow.edges.filter((edge) => edge.kind === "emission").length;
                const recentRun = mostRecentRunForFlow(flow, mostRecentRunByOperation);
                return (
                  <button key={`${flow.id}@${flow.version}`} type="button" className="grid gap-3 rounded-md border bg-background p-3 text-left hover:bg-accent" onClick={() => navigate(flowPath(flow))}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{flow.name}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant={flow.active ? "default" : "outline"}>{flow.active ? "active" : "draft"}</Badge>
                        <HealthBadge health={flow.health} />
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{flow.description}</p>
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <span>Trigger: {flow.entryEvents.map((event) => event.name).join(", ") || "None"}</span>
                      <span>{operationCount} agent step{operationCount === 1 ? "" : "s"} · {branchCount} branch{branchCount === 1 ? "" : "es"}</span>
                      <span>Most recent run: {runStatusLabel(recentRun?.status)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
        <Section title={selectedFlow ? selectedFlow.name : "Flow"}>
          {selectedFlow ? (
            <div className="grid gap-4">
              <FlowSequence flow={selectedFlow} selected={effectiveSelection} onSelect={setSelectedItem} />
              {effectiveSelection ? <FlowInspector data={data} flow={selectedFlow} selection={effectiveSelection} onUpdateSettings={updateSettings} /> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void testSelectedFlow(selectedFlow)}>
                  <TestTube2 className="size-4" />Test
                </Button>
                <Button type="button" variant="outline" disabled={Boolean(blockActivationReason)} onClick={() => void activate(selectedFlow)}>
                  {selectedFlow.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {selectedFlow.active ? "Pause" : "Activate"}
                </Button>
                <Button type="button" variant="outline" onClick={() => openCreate(flowCreateDraftFromFlow(data, selectedFlow))}>
                  <Copy className="size-4" />Duplicate
                </Button>
                <Button type="button" variant="outline" onClick={() => openCreate(flowEditDraftFromFlow(data, selectedFlow))}>
                  <Pencil className="size-4" />Edit Flow
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedItem({ kind: "settings", id: selectedFlow.id })}>
                  Flow settings
                </Button>
              </div>
              {blockActivationReason ? <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{blockActivationReason}</div> : null}
              {flowTestError ? <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{flowTestError}</div> : null}
              {flowTest ? <FlowTestPanel result={flowTest} /> : null}
              <DiagnosticsList diagnostics={selectedFlow.diagnostics} />
              <TechnicalDetails>
                <pre className="max-h-96 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(selectedFlow, null, 2)}</pre>
              </TechnicalDetails>
            </div>
          ) : <EmptyState title="Select or create a Flow." />}
        </Section>
      </div>
    </div>
  );
}
