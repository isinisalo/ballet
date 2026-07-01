import { useEffect, useRef } from "react";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "../../../../../shared/api/workspace-contracts";
import { EmptyState, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { agentTokenCandidates, generatedPolicyId, policyOutputEventTypes } from "../../../../../shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function ActionsAutomationTab({
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
