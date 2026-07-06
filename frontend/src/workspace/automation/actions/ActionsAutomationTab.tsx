import { useEffect, useRef } from "react";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "../../../../../shared/api/workspace-contracts";
import { normalizePolicyToken } from "../../../../../shared/policy-actions";
import type { AutomationConfigUpdater } from "../useAutomationDraft";
import { ActionEditorFields } from "./ActionEditorFields";
import { nextConfigWithActionPatch, normalizeActionDraft } from "./actionEditorLogic";

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
    const normalized = normalizeActionDraft({ ...selected, ...patch });
    if (creating) {
      onCreateDraftChange(normalized);
      return;
    }
    updateConfig((current) => {
      return nextConfigWithActionPatch(current, selected.id, patch).config;
    });
    if (normalized.id) onSelect(normalized.id);
  };

  const createOutput = (outputId: string) => {
    const id = normalizePolicyToken(outputId);
    if (!id || config.outputs.some((output) => normalizePolicyToken(output.id) === id)) return;
    updateConfig((current) => ({ ...current, outputs: [...current.outputs, { id }] }));
  };

  return (
    <div className="grid gap-4">
      <ActionEditorFields agents={agents} config={config} action={selected} onChange={updateSelected} onCreateOutput={createOutput} />
    </div>
  );
}
