import type { ProjectAutomationConfig, ProjectRuntime } from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationIdValidationMessage, automationStringValidationMessage } from "@shared/api/automationValidation";
import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
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
  const runtimeIdError = selected
    ? automationStringValidationMessage("Runtime ID", selected.id, automationFieldLimits.token) ?? automationIdValidationMessage("Runtime ID", selected.id)
    : undefined;
  const titleError = selected ? automationStringValidationMessage("Title", selected.title, automationFieldLimits.name) : undefined;
  const commandError = selected ? automationStringValidationMessage("Command", selected.command, automationFieldLimits.command) : undefined;
  const argsError = selected?.args.find((arg) => automationStringValidationMessage("Arg", arg, automationFieldLimits.arg, { required: false }));

  const updateSelected = (patch: Partial<ProjectRuntime>) => {
    if (!selected) return;
    if (creating) {
      onCreateDraftChange(patch);
      return;
    }
    updateConfig((current) => ({
      ...current,
      runtimes: current.runtimes.map((runtime, index) => index === selectedIndex ? { ...runtime, ...patch } : runtime)
    }));
    if (patch.id) onSelect(patch.id);
  };

  return (
    <div className="grid gap-4">
      <FieldGroup>
        <TextField
          label="Runtime ID"
          required
          minLength={automationFieldLimits.token.min}
          maxLength={automationFieldLimits.token.max}
          error={runtimeIdError}
          value={selected.id}
          onChange={(id) => updateSelected({ id })}
        />
        <TextField
          label="Title"
          required
          minLength={automationFieldLimits.name.min}
          maxLength={automationFieldLimits.name.max}
          error={titleError}
          value={selected.title}
          onChange={(title) => updateSelected({ title })}
        />
        <TextField
          label="Command"
          required
          minLength={automationFieldLimits.command.min}
          maxLength={automationFieldLimits.command.max}
          error={commandError}
          value={selected.command}
          onChange={(command) => updateSelected({ command })}
        />
        <TextAreaField
          label="Args"
          rows={4}
          maxLength={automationFieldLimits.arg.max * 8}
          error={argsError ? `Args must use ${automationFieldLimits.arg.max} characters or fewer per line.` : undefined}
          value={selected.args.join("\n")}
          onChange={(value) => updateSelected({ args: value.split("\n").map((item) => item.trim()).filter(Boolean) })}
        />
      </FieldGroup>
    </div>
  );
}
