import { useEffect, useRef } from "react";
import type { Agent, ProjectAutomationConfig, ProjectOutput } from "../../../../../shared/api/workspace-contracts";
import { EmptyState, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { agentTokenCandidates, generatedPolicyId, policyOutputEventType } from "../../../../../shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function OutputsAutomationTab({
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
  const foundSelectedIndex = config.outputs.findIndex((output) => output.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.outputs.length - 1));
  const selected = config.outputs[selectedIndex];

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectOutput>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const normalized = {
      ...next,
      id: editablePolicyToken(next.id)
    };
    updateConfig((current) => {
      const previousId = current.outputs[selectedIndex]?.id ?? selected.id;
      const eventIdMap = new Map<string, string>();
      const agentTokens = [...new Set(agents.flatMap(agentTokenCandidates))];
      agentTokens.forEach((agent) => {
        current.actions
          .filter((action) => action.outputIds.includes(previousId))
          .forEach((action) => {
            eventIdMap.set(
              policyOutputEventType({ agent, action: action.id }, previousId),
              policyOutputEventType({ agent, action: action.id }, normalized.id)
            );
          });
      });
      const policyIdMap = new Map<string, string>();
      const policies = current.policies.map((policy) => {
        const nextEvent = policy.source === "event" && policy.event ? eventIdMap.get(policy.event) ?? policy.event : policy.event;
        if (nextEvent === policy.event) return policy;
        const nextPolicy = { ...policy, event: nextEvent };
        const nextPolicyId = generatedPolicyId(nextPolicy);
        policyIdMap.set(policy.id, nextPolicyId);
        return { ...nextPolicy, id: nextPolicyId };
      });
      return {
        ...current,
        outputs: current.outputs.map((output, index) => index === selectedIndex ? normalized : output),
        actions: current.actions.map((action) => ({
          ...action,
          outputIds: action.outputIds.map((outputId) => outputId === previousId ? normalized.id : outputId)
        })),
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
          <TextField label="Output ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextAreaField label="Description" rows={4} value={selected.description} onChange={(description) => updateSelected({ description })} />
        </FieldGroup>
      ) : <EmptyState title="No output selected." />}
    </div>
  );
}
