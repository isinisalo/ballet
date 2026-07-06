import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import type { AutomationTab } from "../../types";
import type { WorkflowNameMode } from "./WorkflowHeaderNameEditor";

type SelectAutomationEntity = (tab: AutomationTab, id?: string) => void;

export function useWorkflowHeaderNameEditor({
  activeTab,
  draft,
  setDraft,
  saveDraft,
  selectedWorkflowId,
  selectAutomationEntity
}: {
  activeTab: AutomationTab;
  draft: ProjectAutomationConfig;
  setDraft: Dispatch<SetStateAction<ProjectAutomationConfig>>;
  saveDraft: (nextDraft?: ProjectAutomationConfig) => Promise<boolean>;
  selectedWorkflowId?: string;
  selectAutomationEntity: SelectAutomationEntity;
}) {
  const selectedWorkflow = activeTab === "workflows"
    ? draft.workflows.find((workflow) => workflow.id === selectedWorkflowId)
    : undefined;
  const [mode, setMode] = useState<WorkflowNameMode>("read");
  const [value, setValue] = useState("");
  const trimmedValue = value.trim();
  const valueExists = draft.workflows.some((workflow) =>
    workflow.id === trimmedValue && (mode === "create" || workflow.id !== selectedWorkflow?.id)
  );
  const canSave = Boolean(trimmedValue) && !valueExists;

  useEffect(() => {
    setMode("read");
    setValue("");
  }, [activeTab, selectedWorkflow?.id]);

  const beginCreate = () => {
    setMode("create");
    setValue("");
  };

  const beginEdit = () => {
    if (!selectedWorkflow) return;
    setMode("edit");
    setValue(selectedWorkflow.id);
  };

  const save = async () => {
    if (!canSave) return;
    const nextDraft = mode === "create"
      ? createWorkflowDraft(draft, trimmedValue)
      : renameWorkflowDraft(draft, selectedWorkflow?.id, trimmedValue);

    setDraft(nextDraft);
    const saved = await saveDraft(nextDraft);
    if (saved) {
      selectAutomationEntity("workflows", trimmedValue);
      setMode("read");
      setValue("");
    }
  };

  return {
    beginCreate,
    editorProps: {
      mode,
      selectedWorkflowId: selectedWorkflow?.id,
      value,
      canSave,
      onEdit: beginEdit,
      onValueChange: setValue,
      onSave: () => void save()
    }
  };
}

const createWorkflowDraft = (draft: ProjectAutomationConfig, id: string): ProjectAutomationConfig => ({
  ...draft,
  workflows: [...draft.workflows, { id, title: id, steps: [] }]
});

const renameWorkflowDraft = (draft: ProjectAutomationConfig, currentId: string | undefined, id: string): ProjectAutomationConfig => ({
  ...draft,
  workflows: draft.workflows.map((workflow) =>
    workflow.id === currentId ? { ...workflow, id, title: id } : workflow
  )
});
