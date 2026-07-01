import { Code2, Plus, Save } from "lucide-react";
import type { AppData, ProjectAutomationConfig } from "../../../../../shared/api/workspace-contracts";
import { HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { runtimePath } from "../../routing";
import { uniqueAutomationId } from "../automationUtils";
import { AutomationIssues } from "../AutomationIssues";
import { useAutomationDraft } from "../useAutomationDraft";
import { RuntimesEditor } from "./RuntimesEditor";

export function RuntimesView({
  data,
  selectedId,
  saveAutomation,
  navigate
}: {
  data: AppData;
  selectedId?: string;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: (path: string) => void;
}) {
  const { draft, setDraft, updateConfig, saveDraft } = useAutomationDraft({
    automation: data.automation,
    saveAutomation
  });

  const selectedRuntimeId = selectedId ?? draft.runtimes[0]?.id ?? "";
  const selectedRuntime = draft.runtimes.find((runtime) => runtime.id === selectedRuntimeId) ?? draft.runtimes[0];

  const addRuntime = () => {
    const id = uniqueAutomationId("new-runtime", draft.runtimes.map((runtime) => runtime.id));
    setDraft((current) => ({
      ...current,
      runtimes: [...current.runtimes, { id, title: "New runtime", command: "codex", args: [] }]
    }));
    navigate(runtimePath(id));
  };

  const removeSelectedRuntime = () => {
    if (!selectedRuntime) return;
    const nextId = draft.runtimes.find((runtime) => runtime.id !== selectedRuntime.id)?.id;
    setDraft((current) => ({
      ...current,
      runtimes: current.runtimes.filter((runtime) => runtime.id !== selectedRuntime.id)
    }));
    navigate(runtimePath(nextId));
  };

  return (
    <div className="grid gap-4">
      <Panel
        title="Runtimes"
        icon={<Code2 data-icon="inline-start" />}
        action={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="icon-sm" variant="outline" aria-label="Add runtime" title="Add runtime" onClick={addRuntime}>
              <Plus data-icon="inline-start" />
            </Button>
            <HeaderCrudActions
              saveAction={(
                <Button type="button" size="icon-sm" aria-label="Save runtimes" title="Save runtimes" onClick={() => void saveDraft()}>
                  <Save data-icon="inline-start" />
                </Button>
              )}
              deleteLabel="Delete runtime"
              deleteType="runtime"
              resourceName={selectedRuntime?.title || selectedRuntime?.id}
              canDelete={Boolean(selectedRuntime)}
              onDelete={removeSelectedRuntime}
            />
          </div>
        )}
      >
        <div className="grid gap-4">
          <AutomationIssues issues={data.automationIssues} />
          <RuntimesEditor config={draft} selectedId={selectedRuntimeId} onSelect={(id) => navigate(runtimePath(id))} updateConfig={updateConfig} />
        </div>
      </Panel>
    </div>
  );
}
