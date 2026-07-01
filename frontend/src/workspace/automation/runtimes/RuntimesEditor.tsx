import { useEffect, useRef } from "react";
import type { ProjectAutomationConfig, ProjectRuntime } from "../../../../../shared/api/workspace-contracts";
import { EmptyState, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import type { AutomationConfigUpdater } from "../useAutomationDraft";

export function RuntimesEditor({
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
  const foundSelectedIndex = config.runtimes.findIndex((runtime) => runtime.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.runtimes.length - 1));
  const selected = config.runtimes[selectedIndex];

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectRuntime>) => {
    if (!selected) return;
    updateConfig((current) => ({
      ...current,
      runtimes: current.runtimes.map((runtime, index) => index === selectedIndex ? { ...runtime, ...patch } : runtime)
    }));
    if (patch.id) onSelect(patch.id);
  };

  return (
    <div className="grid gap-4">
      {selected ? (
        <FieldGroup>
          <TextField label="Runtime ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextField label="Title" required value={selected.title} onChange={(title) => updateSelected({ title })} />
          <TextField label="Command" required value={selected.command} onChange={(command) => updateSelected({ command })} />
          <TextAreaField label="Args" rows={4} value={selected.args.join("\n")} onChange={(value) => updateSelected({ args: value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
        </FieldGroup>
      ) : <EmptyState title="No runtime selected." />}
    </div>
  );
}
