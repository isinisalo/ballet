import type { ProjectAutomationConfig, ProjectRuntime } from "@shared/api/workspace-contracts";
import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { editablePolicyToken } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function RuntimesEditor({
  config,
  selectedId,
  createDraft,
  onCreateDraftChange,
  onSelect,
  updateConfig
}: {
  config: ProjectAutomationConfig;
  selectedId?: string;
  createDraft: ProjectRuntime;
  onCreateDraftChange: (patch: Partial<ProjectRuntime>) => void;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const foundSelectedIndex = config.runtimes.findIndex((runtime) => runtime.id === selectedId);
  const selectedIndex = foundSelectedIndex;
  const selected = selectedIndex >= 0 ? config.runtimes[selectedIndex] : createDraft;
  const creating = foundSelectedIndex < 0;

  const updateSelected = (patch: Partial<ProjectRuntime>) => {
    if (!selected) return;
    const normalized = patch.id ? { ...patch, id: editablePolicyToken(patch.id) } : patch;
    if (creating) {
      onCreateDraftChange(normalized);
      return;
    }
    updateConfig((current) => ({
      ...current,
      runtimes: current.runtimes.map((runtime, index) => index === selectedIndex ? { ...runtime, ...normalized } : runtime)
    }));
    if (normalized.id) onSelect(normalized.id);
  };

  return (
    <div className="grid gap-4">
      <FieldGroup>
        <TextField label="Runtime ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
        <TextField label="Title" required value={selected.title} onChange={(title) => updateSelected({ title })} />
        <TextField label="Command" required value={selected.command} onChange={(command) => updateSelected({ command })} />
        <TextAreaField label="Args" rows={4} value={selected.args.join("\n")} onChange={(value) => updateSelected({ args: value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
      </FieldGroup>
    </div>
  );
}
