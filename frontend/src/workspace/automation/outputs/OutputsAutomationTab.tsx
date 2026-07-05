import { useEffect, useRef } from "react";
import type { ProjectAutomationConfig, ProjectOutput } from "../../../../../shared/api/workspace-contracts";
import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generatedPolicyId, policyOutputEventType } from "../../../../../shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function OutputsAutomationTab({
  config,
  selectedId,
  createDraft,
  onCreateDraftChange,
  onSelect,
  updateConfig
}: {
  config: ProjectAutomationConfig;
  selectedId?: string;
  createDraft: ProjectOutput;
  onCreateDraftChange: (patch: Partial<ProjectOutput>) => void;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const foundSelectedIndex = config.outputs.findIndex((output) => output.id === selectedId);
  const lastSelectedIndexRef = useRef<number | undefined>(foundSelectedIndex >= 0 ? foundSelectedIndex : undefined);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : selectedId && lastSelectedIndexRef.current !== undefined
      ? Math.min(lastSelectedIndexRef.current, Math.max(0, config.outputs.length - 1))
      : -1;
  const selected = selectedIndex >= 0 ? config.outputs[selectedIndex] : createDraft;
  const creating = selectedIndex < 0;

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
    if (creating) {
      onCreateDraftChange(normalized);
      return;
    }
    updateConfig((current) => {
      const previousId = current.outputs[selectedIndex]?.id ?? selected.id;
      const previousType = current.outputs[selectedIndex]?.type ?? selected.type;
      const eventIdMap = new Map<string, string>();
      if (previousType === "event" && normalized.type === "event") {
        current.actions
          .filter((action) => action.outputIds.includes(previousId))
          .forEach((action) => {
            eventIdMap.set(
              policyOutputEventType({ action: action.id }, previousId),
              policyOutputEventType({ action: action.id }, normalized.id)
            );
          });
      }
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
      <FieldGroup>
        <TextField label="Output ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
        <Field>
          <FieldLabel>Type</FieldLabel>
          <Select value={selected.type} onValueChange={(type: ProjectOutput["type"]) => updateSelected({ type })}>
            <SelectTrigger aria-label="Output type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="gate">Gate</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <TextAreaField label="Description" rows={4} value={selected.description} onChange={(description) => updateSelected({ description })} />
      </FieldGroup>
    </div>
  );
}
