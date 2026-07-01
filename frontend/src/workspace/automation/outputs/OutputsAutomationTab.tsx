import { useEffect, useRef } from "react";
import type { ProjectAutomationConfig, ProjectOutput } from "../../../../../shared/api/workspace-contracts";
import { EmptyState, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { editablePolicyToken } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function OutputsAutomationTab({
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
    updateConfig((current) => ({
      ...current,
      outputs: current.outputs.map((output, index) => index === selectedIndex ? normalized : output)
    }));
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
