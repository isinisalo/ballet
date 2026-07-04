import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "../../../../../shared/api/workspace-contracts";
import { EmptyState, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agentTokenCandidates, generatedPolicyId, policyOutputEventType } from "../../../../../shared/policy-actions";
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
      id: editablePolicyToken(next.id),
      outputIds: [...new Set(next.outputIds)].slice(0, 3)
    };
    updateConfig((current) => {
      const previousAction = current.actions[selectedIndex] ?? selected;
      const previousId = previousAction.id;
      const nextActions = current.actions.map((action, index) => index === selectedIndex ? normalized : action);
      const eventIdMap = new Map<string, string>();
      if (previousId !== normalized.id) {
        const agentTokens = [...new Set(agents.flatMap(agentTokenCandidates))];
        const previousOutputIds = previousAction.outputIds.filter((outputId) =>
          current.outputs.find((output) => output.id === outputId)?.type !== "gate"
        );
        agentTokens.forEach((agent) => {
          previousOutputIds.forEach((outputId) => {
            eventIdMap.set(
              policyOutputEventType({ agent, action: previousId }, outputId),
              policyOutputEventType({ agent, action: normalized.id }, outputId)
            );
          });
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
  const selectableOutputs = config.outputs.filter((output) => !selectedOutputIds.includes(output.id));
  const canAddOutput = selectedOutputIds.length < 3 && selectableOutputs.length > 0;
  const addOutput = (outputId: string) => {
    if (!selected || !outputId || selectedOutputIds.includes(outputId) || selectedOutputIds.length >= 3) return;
    updateSelected({ outputIds: [...selectedOutputIds, outputId] });
  };
  const removeOutput = (outputId: string) => {
    if (!selected || selectedOutputIds.length <= 1) return;
    updateSelected({ outputIds: selectedOutputIds.filter((candidate) => candidate !== outputId) });
  };

  return (
    <div className="grid gap-4">
      {selected ? (
        <FieldGroup>
          <TextField label="Action ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextAreaField label="Description" rows={4} value={selected.description} onChange={(description) => updateSelected({ description })} />
          <Field>
            <FieldLabel>Outputs</FieldLabel>
            <div className="flex min-h-7 flex-wrap items-center gap-2">
              {selectedOutputIds.map((outputId) => (
                <Badge key={outputId} variant="outline" className="border-divider-strong bg-muted/50 font-mono">
                  {outputId}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove output ${outputId}`}
                    title={`Remove output ${outputId}`}
                    disabled={selectedOutputIds.length <= 1}
                    onClick={() => removeOutput(outputId)}
                    className="-mr-1 size-4 rounded-full p-0"
                  >
                    <X data-icon="inline-end" />
                  </Button>
                </Badge>
              ))}
              <Select onValueChange={addOutput} disabled={!canAddOutput}>
                <SelectTrigger
                  aria-label="Add output"
                  className="h-5 w-auto gap-1 rounded-xl border-dashed border-divider-strong bg-transparent px-2 py-0.5 font-mono text-xs text-muted-foreground shadow-none hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SelectValue placeholder="+ Output" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {selectableOutputs.map((output) => (
                      <SelectItem key={output.id} value={output.id}>
                        {output.description ? `${output.id} · ${output.type} · ${output.description}` : `${output.id} · ${output.type}`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </Field>
        </FieldGroup>
      ) : <EmptyState title="No action selected." />}
    </div>
  );
}
