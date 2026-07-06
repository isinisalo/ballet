import { useEffect, useRef } from "react";
import type { ProjectAutomationConfig, ProjectTrigger } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage } from "@shared/api/automationValidation";
import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { generatedPolicyId } from "@shared/policy-actions";
import { editablePolicyToken } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function TriggersAutomationTab({
  config,
  selectedId,
  createDraft,
  onCreateDraftChange,
  onSelect,
  updateConfig
}: {
  config: ProjectAutomationConfig;
  selectedId?: string;
  createDraft: ProjectTrigger;
  onCreateDraftChange: (patch: Partial<ProjectTrigger>) => void;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const foundSelectedIndex = config.triggers.findIndex((trigger) => trigger.id === selectedId);
  const lastSelectedIndexRef = useRef<number | undefined>(foundSelectedIndex >= 0 ? foundSelectedIndex : undefined);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : selectedId && lastSelectedIndexRef.current !== undefined
      ? Math.min(lastSelectedIndexRef.current, Math.max(0, config.triggers.length - 1))
      : -1;
  const selected = selectedIndex >= 0 ? config.triggers[selectedIndex] : createDraft;
  const creating = selectedIndex < 0;
  const triggerIdError = selected ? automationTokenValidationMessage("Trigger ID", selected.id) : undefined;
  const descriptionError = selected ? automationStringValidationMessage("Description", selected.description, automationFieldLimits.description) : undefined;

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
    if (creating) {
      onCreateDraftChange(normalized);
      return;
    }
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
      <FieldGroup>
        <TextField
          label="Trigger ID"
          required
          minLength={automationFieldLimits.token.min}
          maxLength={automationFieldLimits.token.max}
          error={triggerIdError}
          value={selected.id}
          onChange={(id) => updateSelected({ id })}
        />
        <TextAreaField
          label="Description"
          required
          rows={4}
          minLength={automationFieldLimits.description.min}
          maxLength={automationFieldLimits.description.max}
          error={descriptionError}
          value={selected.description}
          onChange={(description) => updateSelected({ description })}
        />
      </FieldGroup>
    </div>
  );
}
