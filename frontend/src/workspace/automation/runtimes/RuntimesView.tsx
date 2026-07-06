import { useState } from "react";
import { Code2, Save } from "lucide-react";
import type { AppData, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage } from "@shared/api/automationValidation";
import { HeaderCrudActions, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { runtimePath } from "../../routing";
import { editablePolicyToken } from "../automationUtils";
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
  const [newRuntime, setNewRuntime] = useState({ id: "", title: "", command: "codex", args: [] as string[] });

  const selectedRuntimeId = draft.runtimes.some((runtime) => runtime.id === selectedId) ? selectedId : undefined;
  const selectedRuntime = draft.runtimes.find((runtime) => runtime.id === selectedRuntimeId);
  const isCreateMode = !selectedRuntime;

  const saveRuntimesFromHeader = async () => {
    if (!isCreateMode) {
      if (draft.runtimes.some(hasRuntimeFieldErrors)) return;
      await saveDraft();
      return;
    }
    const id = editablePolicyToken(newRuntime.id);
    const nextRuntime = { ...newRuntime, id, title: newRuntime.title.trim() };
    if (hasRuntimeFieldErrors(nextRuntime) || draft.runtimes.some((runtime) => runtime.id === id)) return;
    const nextDraft = {
      ...draft,
      runtimes: [...draft.runtimes, nextRuntime]
    };
    setDraft(nextDraft);
    const saved = await saveDraft(nextDraft);
    if (saved) {
      setNewRuntime({ id: "", title: "", command: "codex", args: [] });
      navigate(runtimePath(id));
    }
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
            <HeaderCrudActions
              saveAction={(
                <Button type="button" size="icon-sm" aria-label="Save runtimes" title="Save runtimes" onClick={() => void saveRuntimesFromHeader()}>
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
          <RuntimesEditor config={draft} selectedId={selectedRuntimeId} createDraft={newRuntime} onCreateDraftChange={(patch) => setNewRuntime((current) => ({ ...current, ...patch }))} onSelect={(id) => navigate(runtimePath(id))} updateConfig={updateConfig} />
        </div>
      </Panel>
    </div>
  );
}

const hasRuntimeFieldErrors = (runtime: { id: string; title: string; command: string; args: string[] }) =>
  Boolean(automationTokenValidationMessage("Runtime ID", runtime.id)) ||
  Boolean(automationStringValidationMessage("Title", runtime.title, automationFieldLimits.name)) ||
  Boolean(automationStringValidationMessage("Command", runtime.command, automationFieldLimits.command)) ||
  runtime.args.some((arg) => Boolean(automationStringValidationMessage("Arg", arg, automationFieldLimits.arg, { required: false })));
