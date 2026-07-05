import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "../../../../../shared/api/workspace-contracts";
import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultPolicyOutputIds, generatedPolicyId, normalizePolicyToken, policyOutputEventType } from "../../../../../shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";
import { OutputSelector } from "../outputs/OutputSelector";
import { uniqueOutputIds } from "../outputs/outputSelectorUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function ActionsAutomationTab({
  agents,
  config,
  selectedId,
  createDraft,
  onCreateDraftChange,
  onSelect,
  updateConfig
}: {
  agents: Agent[];
  config: ProjectAutomationConfig;
  selectedId?: string;
  createDraft: ProjectAction;
  onCreateDraftChange: (patch: Partial<ProjectAction>) => void;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const foundSelectedIndex = config.actions.findIndex((action) => action.id === selectedId);
  const lastSelectedIndexRef = useRef<number | undefined>(foundSelectedIndex >= 0 ? foundSelectedIndex : undefined);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : selectedId && lastSelectedIndexRef.current !== undefined
      ? Math.min(lastSelectedIndexRef.current, Math.max(0, config.actions.length - 1))
      : -1;
  const selected = selectedIndex >= 0 ? config.actions[selectedIndex] : createDraft;
  const creating = selectedIndex < 0;

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectAction>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const normalized = {
      ...next,
      id: editablePolicyToken(next.id),
      outputIds: uniqueOutputIds(next.outputIds, 3),
      agentIds: [...new Set(next.agentIds)].slice(0, 5)
    };
    if (normalized.agentIds.length === 0) normalized.outputIds = [];
    if (creating) {
      onCreateDraftChange(normalized);
      return;
    }
    updateConfig((current) => {
      const previousAction = current.actions[selectedIndex] ?? selected;
      const previousId = previousAction.id;
      const nextActions = current.actions.map((action, index) => index === selectedIndex ? normalized : action);
      const eventIdMap = new Map<string, string>();
      if (previousId !== normalized.id) {
        previousAction.outputIds.forEach((outputId) => {
          eventIdMap.set(
            policyOutputEventType({ action: previousId }, outputId),
            policyOutputEventType({ action: normalized.id }, outputId)
          );
        });
      }
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
        actions: nextActions,
        policies,
        workflows: current.workflows.map((workflow) => ({
          ...workflow,
          steps: workflow.steps.map((step) => policyIdMap.get(step) ?? step)
        }))
      };
    });
    if (normalized.id) onSelect(normalized.id);
  };

  const selectedOutputIds = selected?.outputIds ?? [];
  const selectedAgentIds = selected?.agentIds ?? [];
  const selectableAgents = useMemo(() => agents.filter((agent) => !selectedAgentIds.includes(agent.id)), [agents, selectedAgentIds]);
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;
  const fallbackOutputIds = () => {
    const availableOutputIds = config.outputs.map((output) => output.id);
    const defaultOutputIds = defaultPolicyOutputIds.filter((outputId) => availableOutputIds.includes(outputId));
    return defaultOutputIds.length > 0 ? defaultOutputIds.slice(0, 1) : availableOutputIds.slice(0, 1);
  };
  const canAddAgent = selectedAgentIds.length < 5 && selectableAgents.length > 0;
  const updateOutputs = (outputIds: string[]) => {
    if (!selected) return;
    updateSelected({ outputIds });
  };
  const createOutput = (outputId: string) => {
    const id = normalizePolicyToken(outputId);
    if (!id || config.outputs.some((output) => normalizePolicyToken(output.id) === id)) return;
    updateConfig((current) => ({ ...current, outputs: [...current.outputs, { id }] }));
  };
  const addAgent = (agentId: string) => {
    if (!selected || !agentId || selectedAgentIds.includes(agentId) || selectedAgentIds.length >= 5) return;
    updateSelected({
      agentIds: [...selectedAgentIds, agentId],
      outputIds: selectedOutputIds.length > 0 ? selectedOutputIds : fallbackOutputIds()
    });
  };
  const removeAgent = (agentId: string) => {
    if (!selected) return;
    updateSelected({ agentIds: selectedAgentIds.filter((candidate) => candidate !== agentId) });
  };

  return (
    <div className="grid gap-4">
      <FieldGroup>
        <TextField label="Action ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
        <TextAreaField label="Description" rows={4} value={selected.description} onChange={(description) => updateSelected({ description })} />
          <Field>
            <FieldLabel>Agents</FieldLabel>
            <div className="flex min-h-7 flex-wrap items-center gap-2">
              {selectedAgentIds.map((agentId) => (
                <Badge key={agentId} variant="outline" className="border-divider-strong bg-muted/50 font-mono">
                  {agentLabel(agentId)}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove agent ${agentLabel(agentId)}`}
                    title={`Remove agent ${agentLabel(agentId)}`}
                    onClick={() => removeAgent(agentId)}
                    className="-mr-1 size-4 rounded-full p-0"
                  >
                    <X data-icon="inline-end" />
                  </Button>
                </Badge>
              ))}
              <Select onValueChange={addAgent} disabled={!canAddAgent}>
                <SelectTrigger
                  aria-label="Add agent"
                  className="h-5 w-auto gap-1 rounded-xl border-dashed border-divider-strong bg-transparent px-2 py-0.5 font-mono text-xs text-muted-foreground shadow-none hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SelectValue placeholder="+ Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {selectableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name ? `${agent.name} · ${agent.id}` : agent.id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field>
            <FieldLabel>Outputs</FieldLabel>
            <OutputSelector
              value={selectedOutputIds}
              initialOptions={config.outputs.map((output) => output.id)}
              disabled={selectedAgentIds.length === 0}
              onChange={updateOutputs}
              onCreateOption={createOutput}
            />
          </Field>
      </FieldGroup>
    </div>
  );
}
