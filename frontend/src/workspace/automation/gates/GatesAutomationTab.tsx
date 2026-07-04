import { useEffect, useRef } from "react";
import type { ProjectAutomationConfig, ProjectGate } from "../../../../../shared/api/workspace-contracts";
import { EmptyState, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { editablePolicyToken } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function GatesAutomationTab({
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
  const foundSelectedIndex = config.gates.findIndex((gate) => gate.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.gates.length - 1));
  const selected = config.gates[selectedIndex];

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectGate>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const normalized = {
      ...next,
      id: editablePolicyToken(next.id)
    };
    updateConfig((current) => ({
      ...current,
      gates: current.gates.map((gate, index) => index === selectedIndex ? normalized : gate)
    }));
    if (normalized.id) onSelect(normalized.id);
  };

  return (
    <div className="grid gap-4">
      {selected ? (
        <FieldGroup>
          <TextField label="Gate ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextAreaField label="Description" required rows={4} value={selected.description} onChange={(description) => updateSelected({ description })} />
        </FieldGroup>
      ) : <EmptyState title="No gate selected." />}
    </div>
  );
}
