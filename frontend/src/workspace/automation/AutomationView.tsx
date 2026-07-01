import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Activity, Code2, Pencil, Plus, Route, Save, Trash2, Zap, type LucideIcon } from "lucide-react";
import type { AppData } from "../../../../shared/api/workspace-contracts";
import type { Agent } from "../../../../shared/api/workspace-contracts";
import type {
  ProjectAction,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectPolicy,
  ProjectTrigger,
  ProjectWorkflow
} from "../../../../shared/api/workspace-contracts";
import type { ProjectRuntime } from "../../../../shared/api/workspace-contracts";
import { agentTokenCandidates, generatedPolicyId, normalizePolicyToken, policyOutputEventType, policyOutputEventTypes, preferredAgentToken } from "../../../../shared/policy-actions";
import { HeaderCrudActions, EmptyState, Panel, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { automationSectionPath, runtimePath } from "../routing";
import type { AutomationTab } from "../types";
import { automationAgentOptions, editablePolicyToken, uniqueAutomationId, uniquePolicyAction, automationConfigTemplate } from "./automationUtils";
import { buildWorkflowGraph, workflowOutputEvents, workflowTriggerLabel, type WorkflowStepRecord } from "./workflows/workflowGraph";
import { workflowConnectorPath, type WorkflowBranchLayout, type WorkflowCanvasEdge, type WorkflowCanvasPoint } from "./workflows/workflowLayout";

const noSelection = "__none__";

type AutomationConfigUpdater = (updater: (config: ProjectAutomationConfig) => ProjectAutomationConfig) => void;

export function AutomationView({
  data,
  activeTab,
  selectedId,
  saveAutomation,
  navigate
}: {
  data: AppData;
  activeTab: AutomationTab;
  selectedId?: string;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: (path: string) => void;
}) {
  const [draft, setDraft] = useState<ProjectAutomationConfig>(data.automation ?? automationConfigTemplate());

  useEffect(() => {
    const next = data.automation ?? automationConfigTemplate();
    setDraft(next);
  }, [data.automation]);

  const updateConfig: AutomationConfigUpdater = (updater) => {
    setDraft((current) => updater(current));
  };

  const saveDraft = async () => {
    try {
      const saved = await saveAutomation(draft);
      setDraft(saved);
      return true;
    } catch {
      return false;
    }
  };

  const selectedTriggerId = activeTab === "triggers" ? selectedId ?? draft.triggers[0]?.id ?? "" : draft.triggers[0]?.id ?? "";
  const selectedActionId = activeTab === "actions" ? selectedId ?? draft.actions[0]?.id ?? "" : draft.actions[0]?.id ?? "";
  const selectedWorkflowId = activeTab === "workflows" ? selectedId ?? draft.workflows[0]?.id ?? "" : draft.workflows[0]?.id ?? "";
  const selectedTrigger = draft.triggers.find((trigger) => trigger.id === selectedTriggerId) ?? draft.triggers[0];
  const selectedAction = draft.actions.find((action) => action.id === selectedActionId) ?? draft.actions[0];
  const selectedWorkflow = draft.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? draft.workflows[0];
  const selectAutomationEntity = (tab: AutomationTab, id: string) => navigate(automationSectionPath(tab, id));

  const addTrigger = () => {
    const id = uniqueAutomationId("new-trigger", draft.triggers.map((trigger) => trigger.id));
    setDraft((current) => ({
      ...current,
      triggers: [...current.triggers, { id, description: "New trigger" }]
    }));
    selectAutomationEntity("triggers", id);
  };

  const addAction = () => {
    const id = uniqueAutomationId("new-action", draft.actions.map((action) => action.id));
    setDraft((current) => ({
      ...current,
      actions: [...current.actions, { id, description: "New action" }]
    }));
    selectAutomationEntity("actions", id);
  };

  const addWorkflow = () => {
    const id = uniqueAutomationId("new-workflow", draft.workflows.map((workflow) => workflow.id));
    setDraft((current) => ({
      ...current,
      workflows: [...current.workflows, { id, title: "New workflow", steps: [] }]
    }));
    selectAutomationEntity("workflows", id);
  };

  const removeSelectedTrigger = () => {
    if (!selectedTrigger) return;
    const nextId = draft.triggers.find((trigger) => trigger.id !== selectedTrigger.id)?.id;
    setDraft((current) => ({
      ...current,
      triggers: current.triggers.filter((trigger) => trigger.id !== selectedTrigger.id)
    }));
    navigate(automationSectionPath("triggers", nextId));
  };

  const removeSelectedAction = () => {
    if (!selectedAction) return;
    const nextId = draft.actions.find((action) => action.id !== selectedAction.id)?.id;
    setDraft((current) => ({
      ...current,
      actions: current.actions.filter((action) => action.id !== selectedAction.id)
    }));
    navigate(automationSectionPath("actions", nextId));
  };

  const removeSelectedWorkflow = () => {
    if (!selectedWorkflow) return;
    const nextId = draft.workflows.find((workflow) => workflow.id !== selectedWorkflow.id)?.id;
    setDraft((current) => ({
      ...current,
      workflows: current.workflows.filter((workflow) => workflow.id !== selectedWorkflow.id)
    }));
    navigate(automationSectionPath("workflows", nextId));
  };

  const addConfig = {
    triggers: {
      label: "Add trigger",
      onAdd: addTrigger
    },
    actions: {
      label: "Add action",
      onAdd: addAction
    },
    workflows: {
      label: "Add workflow",
      onAdd: addWorkflow
    }
  }[activeTab];

  const deleteConfig = {
    triggers: {
      label: "Delete trigger",
      type: "trigger",
      resourceName: selectedTrigger?.id,
      canDelete: Boolean(selectedTrigger),
      onDelete: removeSelectedTrigger
    },
    actions: {
      label: "Delete action",
      type: "action",
      resourceName: selectedAction?.id,
      canDelete: Boolean(selectedAction),
      onDelete: removeSelectedAction
    },
    workflows: {
      label: "Delete workflow",
      type: "workflow",
      resourceName: selectedWorkflow?.title || selectedWorkflow?.id,
      canDelete: Boolean(selectedWorkflow),
      onDelete: removeSelectedWorkflow
    }
  }[activeTab];

  return (
    <div className="grid gap-4">
      <Panel
        title="Automation"
        icon={<Route data-icon="inline-start" />}
        action={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="icon-sm" variant="outline" aria-label={addConfig.label} title={addConfig.label} onClick={addConfig.onAdd}>
              <Plus data-icon="inline-start" />
            </Button>
            <HeaderCrudActions
              saveAction={(
                <Button type="button" size="icon-sm" aria-label="Save automation" title="Save automation" onClick={() => void saveDraft()}>
                  <Save data-icon="inline-start" />
                </Button>
              )}
              deleteLabel={deleteConfig.label}
              deleteType={deleteConfig.type}
              resourceName={deleteConfig.resourceName}
              canDelete={deleteConfig.canDelete}
              onDelete={deleteConfig.onDelete}
            />
          </div>
        )}
      >
        <div className="grid gap-4">
          <AutomationIssues issues={data.automationIssues} />
          {activeTab === "triggers" ? (
            <TriggersAutomationTab config={draft} selectedId={selectedTriggerId} onSelect={(id) => selectAutomationEntity("triggers", id)} updateConfig={updateConfig} />
          ) : null}
          {activeTab === "actions" ? (
            <ActionsAutomationTab agents={data.agents} config={draft} selectedId={selectedActionId} onSelect={(id) => selectAutomationEntity("actions", id)} updateConfig={updateConfig} />
          ) : null}
          {activeTab === "workflows" ? (
            <WorkflowsAutomationTab data={data} config={draft} selectedId={selectedWorkflowId} onSelect={(id) => selectAutomationEntity("workflows", id)} updateConfig={updateConfig} saveDraft={saveDraft} />
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

export function RuntimesView({
  data,
  selectedId,
  saveAutomation,
  navigate
}: {
  data: AppData;
  selectedId?: string;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: (path: string) => void;
}) {
  const [draft, setDraft] = useState<ProjectAutomationConfig>(data.automation ?? automationConfigTemplate());

  useEffect(() => {
    setDraft(data.automation ?? automationConfigTemplate());
  }, [data.automation]);

  const updateConfig: AutomationConfigUpdater = (updater) => {
    setDraft((current) => updater(current));
  };

  const saveDraft = async () => {
    try {
      const saved = await saveAutomation(draft);
      setDraft(saved);
      return true;
    } catch {
      return false;
    }
  };

  const selectedRuntimeId = selectedId ?? draft.runtimes[0]?.id ?? "";
  const selectedRuntime = draft.runtimes.find((runtime) => runtime.id === selectedRuntimeId) ?? draft.runtimes[0];

  const addRuntime = () => {
    const id = uniqueAutomationId("new-runtime", draft.runtimes.map((runtime) => runtime.id));
    setDraft((current) => ({
      ...current,
      runtimes: [...current.runtimes, { id, title: "New runtime", command: "codex", args: [] }]
    }));
    navigate(runtimePath(id));
  };

  const removeSelectedRuntime = () => {
    if (!selectedRuntime) return;
    const nextId = draft.runtimes.find((runtime) => runtime.id !== selectedRuntime.id)?.id;
    setDraft((current) => ({
      ...current,
      runtimes: current.runtimes.filter((runtime) => runtime.id !== selectedRuntime.id)
    }));
    navigate(runtimePath(nextId));
  };

  return (
    <div className="grid gap-4">
      <Panel
        title="Runtimes"
        icon={<Code2 data-icon="inline-start" />}
        action={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="icon-sm" variant="outline" aria-label="Add runtime" title="Add runtime" onClick={addRuntime}>
              <Plus data-icon="inline-start" />
            </Button>
            <HeaderCrudActions
              saveAction={(
                <Button type="button" size="icon-sm" aria-label="Save runtimes" title="Save runtimes" onClick={() => void saveDraft()}>
                  <Save data-icon="inline-start" />
                </Button>
              )}
              deleteLabel="Delete runtime"
              deleteType="runtime"
              resourceName={selectedRuntime?.title || selectedRuntime?.id}
              canDelete={Boolean(selectedRuntime)}
              onDelete={removeSelectedRuntime}
            />
          </div>
        )}
      >
        <div className="grid gap-4">
          <AutomationIssues issues={data.automationIssues} />
          <RuntimesEditor config={draft} selectedId={selectedRuntimeId} onSelect={(id) => navigate(runtimePath(id))} updateConfig={updateConfig} />
        </div>
      </Panel>
    </div>
  );
}

function AutomationIssues({ issues }: { issues: ProjectAutomationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ")}
      </AlertDescription>
    </Alert>
  );
}

function TriggersAutomationTab({
  config,
  selectedId,
  onSelect,
  updateConfig
}: {
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const lastSelectedIndexRef = useRef(0);
  const foundSelectedIndex = config.triggers.findIndex((trigger) => trigger.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.triggers.length - 1));
  const selected = config.triggers[selectedIndex];

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectTrigger>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const normalized = {
      ...next,
      id: editablePolicyToken(next.id)
    };
    updateConfig((current) => {
      const previousId = current.triggers[selectedIndex]?.id ?? selected.id;
      return {
        ...current,
        triggers: current.triggers.map((trigger, index) => index === selectedIndex ? normalized : trigger),
        policies: current.policies.map((policy) => policy.source === "trigger" && policy.trigger === previousId
          ? { ...policy, trigger: normalized.id, id: generatedPolicyId({ ...policy, trigger: normalized.id }) }
          : policy)
      };
    });
    if (normalized.id) onSelect(normalized.id);
  };

  return (
    <div className="grid gap-4">
      {selected ? (
        <FieldGroup>
          <TextField label="Trigger ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextAreaField label="Description" required rows={4} value={selected.description} onChange={(description) => updateSelected({ description })} />
        </FieldGroup>
      ) : <EmptyState title="No trigger selected." />}
    </div>
  );
}

function ActionsAutomationTab({
  agents,
  config,
  selectedId,
  onSelect,
  updateConfig
}: {
  agents: Agent[];
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const lastSelectedIndexRef = useRef(0);
  const foundSelectedIndex = config.actions.findIndex((action) => action.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.actions.length - 1));
  const selected = config.actions[selectedIndex];

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectAction>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const normalized = {
      ...next,
      id: editablePolicyToken(next.id)
    };
    updateConfig((current) => {
      const previousId = current.actions[selectedIndex]?.id ?? selected.id;
      const eventIdMap = new Map<string, string>();
      const agentTokens = [...new Set(agents.flatMap(agentTokenCandidates))];
      agentTokens.forEach((agent) => {
        const previousEvents = policyOutputEventTypes({ agent, action: previousId });
        const nextEvents = policyOutputEventTypes({ agent, action: normalized.id });
        previousEvents.forEach((event, index) => {
          eventIdMap.set(event, nextEvents[index] ?? event);
        });
      });
      const policyIdMap = new Map<string, string>();
      const policies = current.policies.map((policy) => {
        const nextAction = policy.action === previousId ? normalized.id : policy.action;
        const nextEvent = policy.source === "event" && policy.event ? eventIdMap.get(policy.event) ?? policy.event : policy.event;
        if (nextAction === policy.action && nextEvent === policy.event) return policy;
        const nextPolicy = { ...policy, action: nextAction, event: nextEvent };
        const nextPolicyId = generatedPolicyId(nextPolicy);
        policyIdMap.set(policy.id, nextPolicyId);
        return { ...nextPolicy, id: nextPolicyId };
      });
      return {
        ...current,
        actions: current.actions.map((action, index) => index === selectedIndex ? normalized : action),
        policies,
        workflows: current.workflows.map((workflow) => ({
          ...workflow,
          steps: workflow.steps.map((step) => policyIdMap.get(step) ?? step)
        }))
      };
    });
    if (normalized.id) onSelect(normalized.id);
  };

  return (
    <div className="grid gap-4">
      {selected ? (
        <FieldGroup>
          <TextField label="Action ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextAreaField label="Description" rows={4} value={selected.description} onChange={(description) => updateSelected({ description })} />
        </FieldGroup>
      ) : <EmptyState title="No action selected." />}
    </div>
  );
}

function WorkflowsAutomationTab({
  data,
  config,
  selectedId,
  onSelect,
  updateConfig,
  saveDraft
}: {
  data: AppData;
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
  saveDraft: () => Promise<boolean>;
}) {
  const lastSelectedIndexRef = useRef(0);
  const foundSelectedIndex = config.workflows.findIndex((workflow) => workflow.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.workflows.length - 1));
  const selected = config.workflows[selectedIndex];
  const draggedStepIndexRef = useRef<number | null>(null);
  const workflowCanvasRef = useRef<HTMLDivElement | null>(null);
  const canvasPanRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const [editingPolicyIndex, setEditingPolicyIndex] = useState<number | null>(null);
  const policyById = useMemo(() => new Map(config.policies.map((policy) => [policy.id, policy])), [config.policies]);
  const policyOptions = [{ value: noSelection, label: "No policy" }, ...config.policies.map((policy) => ({ value: policy.id, label: policy.id }))];
  const actionOptions = [
    { value: noSelection, label: "No action" },
    ...config.actions.map((action) => ({ value: action.id, label: action.description ? `${action.id} · ${action.description}` : action.id }))
  ];
  const agentOptions = [{ value: noSelection, label: "No agent" }, ...automationAgentOptions(data.agents)];
  const defaultAgent = data.agents[0] ? preferredAgentToken(data.agents[0]) : "";
  const defaultAction = config.actions[0]?.id ?? "";
  const workflowStepRecords = useMemo<WorkflowStepRecord[]>(() =>
    selected?.steps.map((policyId, index) => ({ policyId, index, policy: policyById.get(policyId) })) ?? [],
  [policyById, selected?.steps]);
  const workflowGraph = useMemo(() => buildWorkflowGraph(workflowStepRecords), [workflowStepRecords]);

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  useEffect(() => {
    const updateCanvasHeight = () => {
      const top = workflowCanvasRef.current?.getBoundingClientRect().top;
      if (typeof top !== "number") return;
      setCanvasHeight(Math.max(448, window.innerHeight - top - 24));
    };

    updateCanvasHeight();
    const frame = window.requestAnimationFrame(updateCanvasHeight);
    const timeout = window.setTimeout(updateCanvasHeight, 0);
    window.addEventListener("resize", updateCanvasHeight);
    document.addEventListener("scroll", updateCanvasHeight, true);
    window.visualViewport?.addEventListener("resize", updateCanvasHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", updateCanvasHeight);
      document.removeEventListener("scroll", updateCanvasHeight, true);
      window.visualViewport?.removeEventListener("resize", updateCanvasHeight);
    };
  }, [selected?.id]);

  const updateSelected = (patch: Partial<ProjectWorkflow>) => {
    if (!selected) return;
    updateConfig((current) => ({
      ...current,
      workflows: current.workflows.map((workflow, index) => index === selectedIndex ? { ...workflow, ...patch } : workflow)
    }));
    if (patch.id) onSelect(patch.id);
  };

  const updateStep = (index: number, policyId: string) => {
    if (!selected) return;
    updateSelected({ steps: selected.steps.map((step, stepIndex) => stepIndex === index ? policyId : step) });
  };

  const updateWorkflowPolicy = (record: typeof workflowStepRecords[number], patch: Partial<ProjectPolicy>) => {
    if (!record.policy) return;
    const selectedPolicy = record.policy;
    const next = { ...selectedPolicy, ...patch };
    const source: ProjectPolicy["source"] = next.source === "trigger" ? "trigger" : "event";
    const normalized = {
      ...next,
      source,
      event: source === "event" ? next.event ?? "" : undefined,
      trigger: source === "trigger" ? normalizePolicyToken(next.trigger ?? "") : undefined,
      agent: normalizePolicyToken(next.agent),
      action: normalizePolicyToken(next.action)
    };
    const nextId = generatedPolicyId(normalized);

    updateConfig((current) => ({
      ...current,
      policies: current.policies.map((policy) => policy.id === selectedPolicy.id ? { ...normalized, id: nextId } : policy),
      workflows: current.workflows.map((workflow) => ({
        ...workflow,
        steps: workflow.steps.map((step) => step === selectedPolicy.id ? nextId : step)
      }))
    }));
  };

  const saveWorkflowPolicyEdit = async () => {
    const saved = await saveDraft();
    if (saved) setEditingPolicyIndex(null);
  };

  const addPolicyStep = (eventType?: string, sourcePolicy?: ProjectPolicy) => {
    if (!selected) return;
    const selectedPolicyIds = new Set(selected.steps);
    const nextPolicy = eventType
      ? config.policies.find((policy) => policy.source === "event" && policy.event === eventType && !selectedPolicyIds.has(policy.id))
      : config.policies.find((policy) => !selectedPolicyIds.has(policy.id)) ?? config.policies[0];
    if (!nextPolicy) {
      const agent = sourcePolicy?.agent || config.policies[0]?.agent || defaultAgent;
      const baseAction = sourcePolicy?.action || defaultAction;
      if (!agent || !baseAction) return;
      const generatedSource: ProjectPolicy["source"] = eventType || !config.triggers[0]?.id ? "event" : "trigger";
      const generatedEvent = eventType || policyOutputEventType({ agent, action: baseAction }, "failed");
      const action = generatedSource === "event" ? uniquePolicyAction(generatedEvent, agent, baseAction, config.policies) : baseAction;
      const generatedPolicy: ProjectPolicy = {
        id: generatedPolicyId({
          source: generatedSource,
          event: generatedSource === "event" ? generatedEvent : undefined,
          trigger: generatedSource === "trigger" ? config.triggers[0]?.id ?? "" : undefined,
          agent,
          action
        }),
        source: generatedSource,
        event: generatedSource === "event" ? generatedEvent : undefined,
        trigger: generatedSource === "trigger" ? config.triggers[0]?.id ?? "" : undefined,
        agent,
        action,
        enabled: true
      };
      updateConfig((current) => ({
        ...current,
        actions: current.actions.some((candidate) => candidate.id === action) ? current.actions : [...current.actions, { id: action, description: "" }],
        policies: [...current.policies, generatedPolicy],
        workflows: current.workflows.map((workflow) => workflow.id === selected.id ? { ...workflow, steps: [...workflow.steps, generatedPolicy.id] } : workflow)
      }));
      return;
    }
    updateSelected({ steps: [...selected.steps, nextPolicy.id] });
  };

  const reorderStep = (fromIndex: number, toIndex: number) => {
    if (!selected) return;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= selected.steps.length || toIndex >= selected.steps.length) return;
    const steps = [...selected.steps];
    const [movedStep] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, movedStep);
    updateSelected({ steps });
  };

  const resetStepDrag = () => {
    draggedStepIndexRef.current = null;
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
  };

  const stepIndexFromPoint = (event: PointerEvent<HTMLDivElement>) => {
    if (typeof document.elementFromPoint !== "function") return null;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-workflow-step-index]");
    if (!(target instanceof HTMLElement)) return null;
    const targetIndex = Number(target.dataset.workflowStepIndex);
    return Number.isNaN(targetIndex) ? null : targetIndex;
  };

  const handleStepPointerDown = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button, [role='combobox']")) return;
    draggedStepIndexRef.current = index;
    setDraggedStepIndex(index);
    setDragOverStepIndex(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStepPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggedStepIndexRef.current === null) return;
    const targetIndex = stepIndexFromPoint(event);
    if (targetIndex !== null) setDragOverStepIndex(targetIndex);
  };

  const handleStepPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const fromIndex = draggedStepIndexRef.current;
    if (fromIndex === null) return;
    const toIndex = stepIndexFromPoint(event) ?? dragOverStepIndex ?? fromIndex;
    reorderStep(fromIndex, toIndex);
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
    draggedStepIndexRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resetCanvasPan = () => {
    canvasPanRef.current = null;
    setIsCanvasPanning(false);
  };

  const handleCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("[data-workflow-node], button, [role='combobox']")) return;
    canvasPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: canvasOffset.x,
      originY: canvasOffset.y
    };
    setIsCanvasPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;
    if (!pan) return;
    setCanvasOffset({
      x: pan.originX + event.clientX - pan.startX,
      y: pan.originY + event.clientY - pan.startY
    });
  };

  const handleCanvasPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasPanRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resetCanvasPan();
  };

  const nodeSizes = {
    trigger: { width: 176, height: 46 },
    policy: { width: 240, height: 116 },
    event: { width: 240, height: 46 },
    action: { width: 28, height: 28 }
  };
  const canvasLayout = {
    startX: 32,
    startY: 64,
    columnGap: 36,
    branchGap: 20,
    rowStep: 54,
    edgePad: 18,
    policyAnchorY: 18
  };
  const layoutNodes: ReactNode[] = [];
  const layoutEdges: WorkflowCanvasEdge[] = [];
  let layoutWidth = canvasLayout.startX + nodeSizes.trigger.width;
  let layoutHeight = canvasLayout.startY + nodeSizes.trigger.height;

  const addLayoutNode = (key: string, x: number, y: number, width: number, height: number, node: ReactNode) => {
    layoutWidth = Math.max(layoutWidth, x + width + canvasLayout.startX);
    layoutHeight = Math.max(layoutHeight, y + height + canvasLayout.startY);
    layoutNodes.push(
      <div key={key} className="absolute flex items-center" style={{ transform: `translate(${x}px, ${y}px)`, width, height }}>
        {node}
      </div>
    );
  };

  const addLayoutEdge = (key: string, from: WorkflowCanvasPoint, to: WorkflowCanvasPoint, dashed = false) => {
    layoutWidth = Math.max(layoutWidth, from.x, to.x + canvasLayout.startX);
    layoutHeight = Math.max(layoutHeight, from.y, to.y + canvasLayout.startY);
    layoutEdges.push({ key, from, to, dashed });
  };

  const stepDragClass = (index: number) => cn(
    "cursor-grab select-none active:cursor-grabbing",
    draggedStepIndex === index && "opacity-60",
    dragOverStepIndex === index && draggedStepIndex !== index && "ring-2 ring-primary/20"
  );

  const renderPolicyNode = (record: typeof workflowStepRecords[number], isEditingPolicy: boolean) => (
    <div
      data-workflow-step-index={record.index}
      onPointerDown={(event) => handleStepPointerDown(event, record.index)}
      onPointerMove={handleStepPointerMove}
      onPointerUp={handleStepPointerUp}
      onPointerCancel={resetStepDrag}
      className={stepDragClass(record.index)}
    >
      <WorkflowCanvasNode
        label="Policy"
        tone="policy"
        icon={Route}
        value={record.policyId || "No policy"}
        dashed={!record.policy}
        className="h-[7.25rem] w-60 max-w-none items-start py-2"
      >
        {record.policy ? (
          <WorkflowPolicySummary
            policy={record.policy}
            editing={isEditingPolicy}
            agentOptions={agentOptions}
            actionOptions={actionOptions}
            onAgentChange={(agent) => updateWorkflowPolicy(record, { agent: agent === noSelection ? "" : agent })}
            onActionChange={(action) => updateWorkflowPolicy(record, { action: action === noSelection ? "" : action })}
          />
        ) : (
          <Select value={record.policyId || noSelection} onValueChange={(value) => updateStep(record.index, value === noSelection ? "" : value)}>
            <SelectTrigger className="h-6 w-full min-w-0 px-1.5 font-mono text-[0.64rem]" title={record.policyId || "No policy"} onDragStart={(event) => event.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {policyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </WorkflowCanvasNode>
    </div>
  );

  const layoutPolicyBranch = (record: typeof workflowStepRecords[number], x: number, y: number, visitedPolicyIds = new Set<string>()): WorkflowBranchLayout => {
    const policy = record.policy;
    if (visitedPolicyIds.has(record.policyId)) return { height: 0, width: 0 };
    const nextVisitedPolicyIds = new Set(visitedPolicyIds);
    nextVisitedPolicyIds.add(record.policyId);

    const policyX = x;
    const policyY = y;
    const outputX = policyX + nodeSizes.policy.width + canvasLayout.columnGap;
    const deleteX = policyX + nodeSizes.policy.width - nodeSizes.action.width;
    const editX = deleteX - nodeSizes.action.width - 6;
    const actionY = policyY + nodeSizes.policy.height + 6;
    const isEditingPolicy = editingPolicyIndex === record.index;
    let cursorY = y + canvasLayout.policyAnchorY - nodeSizes.event.height / 2;
    let branchWidth = nodeSizes.policy.width;

    addLayoutNode(`policy-${record.index}`, policyX, policyY, nodeSizes.policy.width, nodeSizes.policy.height, renderPolicyNode(record, isEditingPolicy));
    if (isEditingPolicy) {
      addLayoutNode(
        `save-${record.index}`,
        deleteX,
        actionY,
        nodeSizes.action.width,
        nodeSizes.action.height,
        <Button type="button" size="icon-sm" aria-label="Save workflow policy" title="Save workflow policy" onClick={() => void saveWorkflowPolicyEdit()}>
          <Save data-icon="inline-start" />
        </Button>
      );
    } else {
      addLayoutNode(
        `edit-${record.index}`,
        editX,
        actionY,
        nodeSizes.action.width,
        nodeSizes.action.height,
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Edit workflow policy"
          title="Edit workflow policy"
          onClick={() => setEditingPolicyIndex(record.index)}
        >
          <Pencil data-icon="inline-start" />
        </Button>
      );
      addLayoutNode(
        `delete-${record.index}`,
        deleteX,
        actionY,
        nodeSizes.action.width,
        nodeSizes.action.height,
        <Button type="button" size="icon-sm" variant="destructive" aria-label="Remove workflow step" title="Remove workflow step" onClick={() => updateSelected({ steps: selected?.steps.filter((_, stepIndex) => stepIndex !== record.index) ?? [] })}>
          <TrashButtonIcon />
        </Button>
      );
    }
    workflowOutputEvents(policy).forEach((eventType) => {
      const childRecords = (workflowGraph.childRecordsByParentEvent.get(`${record.index}:${eventType}`) ?? []).filter((childRecord) => childRecord.policyId !== record.policyId && !nextVisitedPolicyIds.has(childRecord.policyId));
      const eventRows = childRecords.length > 0 ? childRecords : [undefined];

      eventRows.forEach((childRecord, childIndex) => {
        const eventY = cursorY;
        const eventKey = `event-${record.index}-${eventType}-${childRecord?.index ?? "ghost"}-${childIndex}`;
        const canAddPolicyForEvent = Boolean((policy?.agent || config.policies[0]?.agent || defaultAgent) && (policy?.action || defaultAction));

        if (childRecord) {
          const childX = outputX;
          const childY = eventY + nodeSizes.event.height / 2 - canvasLayout.policyAnchorY;
          const childLayout = layoutPolicyBranch(childRecord, childX, childY, nextVisitedPolicyIds);
          addLayoutEdge(
            `policy-policy-${record.index}-${childRecord.index}-${eventType}`,
            { x: policyX + nodeSizes.policy.width, y: policyY + canvasLayout.policyAnchorY },
            { x: childX, y: childY + canvasLayout.policyAnchorY }
          );
          branchWidth = Math.max(branchWidth, outputX + childLayout.width - x);
          cursorY += Math.max(canvasLayout.rowStep, childY + childLayout.height - eventY) + canvasLayout.branchGap;
        } else {
          addLayoutEdge(
            `policy-event-${record.index}-${eventType}-${childIndex}`,
            { x: policyX + nodeSizes.policy.width, y: policyY + canvasLayout.policyAnchorY },
            { x: outputX, y: eventY + nodeSizes.event.height / 2 },
            !policy
          );
          addLayoutNode(
            eventKey,
            outputX,
            eventY,
            nodeSizes.event.width,
            nodeSizes.event.height,
            <WorkflowGhostNode
              value={eventType}
              icon={Activity}
              ariaLabel={`Add policy step for ${eventType}`}
              onClick={() => addPolicyStep(eventType, policy)}
              disabled={!canAddPolicyForEvent}
              className="w-60"
            />
          );
          branchWidth = Math.max(branchWidth, outputX + nodeSizes.event.width - x);
          cursorY += canvasLayout.rowStep;
        }
      });
    });

    return {
      height: Math.max(nodeSizes.policy.height, cursorY - y, actionY + nodeSizes.action.height - y),
      width: branchWidth
    };
  };

  addLayoutNode(
    "trigger",
    canvasLayout.startX,
    canvasLayout.startY,
    nodeSizes.trigger.width,
    nodeSizes.trigger.height,
    <WorkflowCanvasNode
      label="Trigger"
      value={workflowTriggerLabel(policyById.get(selected?.steps[0] ?? ""))}
      tone="trigger"
      icon={Zap}
      dashed={!selected || selected.steps.length === 0}
      className="w-44"
    />
  );

  if (selected) {
    const rootX = canvasLayout.startX + nodeSizes.trigger.width + canvasLayout.columnGap;
    let rootY = canvasLayout.startY + nodeSizes.trigger.height / 2 - canvasLayout.policyAnchorY;

    if (workflowGraph.rootRecords.length > 0) {
      workflowGraph.rootRecords.forEach((record) => {
        const rootLayout = layoutPolicyBranch(record, rootX, rootY);
        addLayoutEdge(
          `trigger-policy-${record.index}`,
          { x: canvasLayout.startX + nodeSizes.trigger.width, y: canvasLayout.startY + nodeSizes.trigger.height / 2 },
          { x: rootX, y: rootY + canvasLayout.policyAnchorY },
          !record.policy
        );
        rootY += Math.max(canvasLayout.rowStep, rootLayout.height) + canvasLayout.branchGap;
      });
    } else {
      const firstGhostY = canvasLayout.startY + nodeSizes.trigger.height / 2 - nodeSizes.event.height / 2;
      addLayoutEdge(
        "trigger-first-policy",
        { x: canvasLayout.startX + nodeSizes.trigger.width, y: canvasLayout.startY + nodeSizes.trigger.height / 2 },
        { x: rootX, y: firstGhostY + nodeSizes.event.height / 2 },
        true
      );
      addLayoutNode(
        "first-policy-ghost",
        rootX,
        firstGhostY,
        nodeSizes.event.width,
        nodeSizes.event.height,
        <WorkflowGhostNode value="Add first policy" icon={Route} ariaLabel="Add first policy" onClick={() => addPolicyStep()} disabled={!defaultAgent || !defaultAction} className="w-60" />
      );
    }
  }

  return (
    <div className="grid gap-4">
      {selected ? (
        <div className="grid gap-4">
          <div className="grid gap-3">
            <TextField label="Workflow ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          </div>
          <div
            ref={workflowCanvasRef}
            data-workflow-canvas
            className={cn("relative min-h-[28rem] overflow-hidden rounded-lg border border-divider-strong bg-background", isCanvasPanning ? "cursor-grabbing" : "cursor-grab")}
            style={{ height: canvasHeight ? `${canvasHeight}px` : undefined }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={resetCanvasPan}
          >
            <div className="pointer-events-none absolute inset-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div
              className="absolute left-0 top-0 min-w-max select-none"
              style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`, width: layoutWidth, height: layoutHeight }}
            >
              <svg className="pointer-events-none absolute inset-0 overflow-visible" width={layoutWidth} height={layoutHeight} aria-hidden="true">
                <defs>
                  <marker id="workflow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M 0 0 L 8 4 L 0 8 z" className="fill-primary/70" />
                  </marker>
                  <marker id="workflow-arrow-muted" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M 0 0 L 8 4 L 0 8 z" className="fill-muted-foreground/70" />
                  </marker>
                </defs>
                {layoutEdges.map((edge) => <WorkflowCanvasEdgePath key={edge.key} edge={edge} />)}
              </svg>
              {layoutNodes}
            </div>
          </div>
        </div>
      ) : <EmptyState title="No workflow selected." />}
    </div>
  );
}

type WorkflowNodeTone = "trigger" | "policy" | "agent" | "event";

const workflowNodeToneClasses: Record<WorkflowNodeTone, string> = {
  trigger: "text-tertiary",
  policy: "text-primary",
  agent: "text-secondary",
  event: "text-primary"
};

function WorkflowCanvasEdgePath({ edge }: { edge: WorkflowCanvasEdge }) {
  return (
    <path
      data-workflow-connector
      data-dashed={edge.dashed ? "true" : "false"}
      d={workflowConnectorPath(edge)}
      className={cn("fill-none stroke-primary/70 stroke-2", edge.dashed && "stroke-muted-foreground/70")}
      strokeDasharray={edge.dashed ? "6 5" : undefined}
      markerEnd={edge.dashed ? "url(#workflow-arrow-muted)" : "url(#workflow-arrow)"}
    />
  );
}

function WorkflowPolicySummary({
  policy,
  editing,
  agentOptions,
  actionOptions,
  onAgentChange,
  onActionChange
}: {
  policy: ProjectPolicy;
  editing: boolean;
  agentOptions: Array<{ value: string; label: string }>;
  actionOptions: Array<{ value: string; label: string }>;
  onAgentChange: (agent: string) => void;
  onActionChange: (action: string) => void;
}) {
  const sourceValue = policy.source === "trigger" ? policy.trigger : policy.event;
  const editSelectClass = "h-5 min-h-5 max-h-5 w-full min-w-0 max-w-full flex-1 cursor-pointer rounded border border-input bg-background px-1.5 py-0 font-mono text-[0.62rem] leading-4 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
  const stopCanvasPointerEvent = (event: PointerEvent<HTMLSelectElement>) => event.stopPropagation();

  return (
    <div className="grid min-w-0 gap-1 font-mono text-[0.62rem] leading-4">
      <div className="flex min-w-0 gap-1">
        <span className="shrink-0 text-foreground">type:</span>
        <span className="truncate text-primary" title={policy.source || "event"}>{policy.source || "event"}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 text-foreground">on:</span>
        <span className="truncate text-primary" title={sourceValue || "Missing source"}>{sourceValue || "Missing source"}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 text-foreground">then:</span>
        {editing ? (
          <select
            aria-label="Workflow policy agent"
            className={cn(editSelectClass, "text-secondary")}
            title={policy.agent || "Missing agent"}
            value={policy.agent || noSelection}
            onChange={(event) => onAgentChange(event.target.value)}
            onPointerDown={stopCanvasPointerEvent}
            onPointerMove={stopCanvasPointerEvent}
            onPointerUp={stopCanvasPointerEvent}
            onDragStart={(event) => event.stopPropagation()}
          >
            {agentOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <span className="truncate text-secondary" title={policy.agent || "Missing agent"}>{policy.agent || "Missing agent"}</span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 text-foreground">start:</span>
        {editing ? (
          <select
            aria-label="Workflow policy action"
            className={cn(editSelectClass, "text-tertiary")}
            title={policy.action || "Missing action"}
            value={policy.action || noSelection}
            onChange={(event) => onActionChange(event.target.value)}
            onPointerDown={stopCanvasPointerEvent}
            onPointerMove={stopCanvasPointerEvent}
            onPointerUp={stopCanvasPointerEvent}
            onDragStart={(event) => event.stopPropagation()}
          >
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <span className="truncate text-tertiary" title={policy.action || "Missing action"}>{policy.action || "Missing action"}</span>
        )}
      </div>
    </div>
  );
}

function WorkflowCanvasNode({
  label,
  value,
  tone,
  icon: Icon,
  dashed = false,
  active = false,
  children,
  className
}: {
  label: string;
  value: string;
  tone: WorkflowNodeTone;
  icon: LucideIcon;
  dashed?: boolean;
  active?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-workflow-node
      aria-label={`${label}: ${value}`}
      title={value}
      className={cn(
        "relative grid min-h-9 min-w-44 max-w-60 shrink-0 rounded-md border border-divider-strong bg-card px-2 pb-1.5 pt-3",
        dashed && "border-dashed border-muted-foreground/70 bg-background/80 opacity-80",
        active && "border-primary/80 ring-2 ring-primary/20",
        className
      )}
    >
      <div className={cn("absolute -top-px left-2 flex size-5 -translate-y-[60%] items-center justify-center rounded border border-divider-strong bg-background", workflowNodeToneClasses[tone])}>
        <Icon className="size-3.5" aria-hidden="true" />
      </div>
      <div className="grid min-w-0">
        {children ?? <span className="truncate font-mono text-[0.66rem] leading-4 text-foreground">{value}</span>}
      </div>
    </div>
  );
}

function WorkflowGhostNode({ value, icon: Icon, ariaLabel, disabled = false, className, onClick }: { value: string; icon: LucideIcon; ariaLabel: string; disabled?: boolean; className?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-workflow-node
      className={cn("relative grid min-h-9 min-w-44 max-w-60 shrink-0 cursor-pointer rounded-md border border-dashed border-muted-foreground/70 bg-background/80 px-2 pb-1.5 pt-3 text-left opacity-80 transition-colors hover:border-primary/80 hover:bg-card hover:opacity-100 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-muted-foreground/70 disabled:hover:bg-background/80", className)}
      aria-label={ariaLabel}
      title={value}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="absolute -top-px left-2 flex size-5 -translate-y-[60%] items-center justify-center rounded border border-dashed border-muted-foreground/70 bg-background text-primary">
        <Icon className="size-3.5" aria-hidden="true" />
      </div>
      <span className="truncate font-mono text-[0.66rem] leading-4 text-muted-foreground">{value}</span>
    </button>
  );
}

function RuntimesEditor({
  config,
  selectedId,
  onSelect,
  updateConfig
}: {
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const lastSelectedIndexRef = useRef(0);
  const foundSelectedIndex = config.runtimes.findIndex((runtime) => runtime.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.runtimes.length - 1));
  const selected = config.runtimes[selectedIndex];

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectRuntime>) => {
    if (!selected) return;
    updateConfig((current) => ({
      ...current,
      runtimes: current.runtimes.map((runtime, index) => index === selectedIndex ? { ...runtime, ...patch } : runtime)
    }));
    if (patch.id) onSelect(patch.id);
  };

  return (
    <div className="grid gap-4">
      {selected ? (
        <FieldGroup>
          <TextField label="Runtime ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextField label="Title" required value={selected.title} onChange={(title) => updateSelected({ title })} />
          <TextField label="Command" required value={selected.command} onChange={(command) => updateSelected({ command })} />
          <TextAreaField label="Args" rows={4} value={selected.args.join("\n")} onChange={(value) => updateSelected({ args: value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
        </FieldGroup>
      ) : <EmptyState title="No runtime selected." />}
    </div>
  );
}

function TrashButtonIcon() {
  return <Trash2 data-icon="inline-start" />;
}
