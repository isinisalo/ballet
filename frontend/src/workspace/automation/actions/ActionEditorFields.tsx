import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { automationFieldLimits, automationStringValidationMessage } from "@shared/api/automationValidation";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { defaultActionOutputIds, normalizeActionOutputSlots } from "@shared/policy-actions";
import { Plus, ShieldCheck, X } from "lucide-react";
import { actionOutputTargetsByOutputId, type ActionOutputTarget } from "./actionOutputTargets";

const noAgentSelectionValue = "__no-agent__";

export function ActionEditorFields({
  agents,
  config,
  action,
  onChange
}: {
  agents: Agent[];
  config: ProjectAutomationConfig;
  action: ProjectAction;
  onChange: (patch: Partial<ProjectAction>) => void;
}) {
  const selectedAgentId = action.agentId ?? "";
  const selectedOutputIds = action.outputIds ?? [];
  const humanGate = Boolean(action.humanGate);
  const outputSlotIds = humanGate || selectedAgentId ? normalizeActionOutputSlots(selectedOutputIds) : [];
  const actionIdError = automationStringValidationMessage("Action ID", action.id, automationFieldLimits.policyId);
  const descriptionError = automationStringValidationMessage("Description", action.description, automationFieldLimits.description, { required: false });
  const fallbackOutputIds = () => {
    const availableOutputIds = config.outputs.map((output) => output.id);
    const defaultOutputIds = defaultActionOutputIds.filter((outputId) => availableOutputIds.includes(outputId));
    return defaultOutputIds.length === defaultActionOutputIds.length ? defaultOutputIds : [...defaultActionOutputIds];
  };
  const updateAgent = (agentId: string) => {
    if (humanGate) return;
    if (agentId === noAgentSelectionValue) {
      onChange({ agentId: undefined, outputIds: [] });
      return;
    }
    if (!agentId) return;
    onChange({
      agentId,
      outputIds: selectedOutputIds.length > 0 ? selectedOutputIds : fallbackOutputIds()
    });
  };
  const updateHumanGate = (enabled: boolean) => {
    onChange(enabled
      ? {
        humanGate: true,
        agentId: undefined,
        outputIds: selectedOutputIds.length > 0 ? normalizeActionOutputSlots(selectedOutputIds) : fallbackOutputIds()
      }
      : {
        humanGate: false,
        agentId: agents[0]?.id,
        outputIds: agents[0]?.id ? (selectedOutputIds.length > 0 ? normalizeActionOutputSlots(selectedOutputIds) : fallbackOutputIds()) : []
      });
  };
  const approvedOutputId = defaultActionOutputIds[0];
  const rejectedOutputId = defaultActionOutputIds[1];
  const hasRejectedOutput = outputSlotIds.includes(rejectedOutputId);
  const setRejectedOutput = (enabled: boolean) => {
    onChange({ outputIds: enabled ? [approvedOutputId, rejectedOutputId] : [approvedOutputId] });
  };
  const outputTargetById = actionOutputTargetsByOutputId(config, action.id, outputSlotIds);
  const outputDisplayTargets = (outputId: string): ActionOutputTarget[] =>
    outputTargetById[outputId] ?? [{ type: "event", id: outputId, label: outputId }];
  const outputDisplayClassName = () =>
    "border-primary/60 bg-primary/10 font-mono text-primary";
  const outputBadges = (outputId: string) => outputDisplayTargets(outputId).map((target) => (
    <Badge key={`${target.type}:${target.id}`} variant="outline" className={`${outputDisplayClassName()} max-w-full`}>
      <span className="truncate" title={target.label}>{target.label}</span>
    </Badge>
  ));

  return (
    <FieldGroup>
      <TextField
        label="Action ID"
        required
        minLength={automationFieldLimits.policyId.min}
        maxLength={automationFieldLimits.policyId.max}
        error={actionIdError}
        value={action.id}
        onChange={(id) => onChange({ id })}
      />
      <TextAreaField
        label="Description"
        rows={4}
        maxLength={automationFieldLimits.description.max}
        error={descriptionError}
        value={action.description}
        onChange={(description) => onChange({ description })}
      />
      <Field orientation="horizontal">
        <FieldLabel htmlFor={`${action.id || "action"}-gate`}>Human gate</FieldLabel>
        <Switch
          id={`${action.id || "action"}-gate`}
          checked={humanGate}
          aria-label="Human gate"
          onCheckedChange={updateHumanGate}
        />
        <FieldDescription>Route this action to a human operator instead of an agent.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Agent</FieldLabel>
        {humanGate ? (
          <div className="flex min-h-7 flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-tertiary/60 bg-tertiary/10 font-mono text-tertiary">
              <ShieldCheck data-icon="inline-start" />
              Human operator
            </Badge>
          </div>
        ) : (
          <div className="flex min-h-7 items-center">
            <Select value={selectedAgentId || noAgentSelectionValue} onValueChange={updateAgent}>
              <SelectTrigger
                aria-label="Select agent"
                className="w-full max-w-md font-mono"
              >
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={noAgentSelectionValue}>No agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name ? `${agent.name} · ${agent.id}` : agent.id}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
      </Field>
      <Field>
        <FieldLabel>Outputs</FieldLabel>
        {!humanGate && !selectedAgentId ? (
          <span className="text-sm text-muted-foreground">None</span>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <FieldLabel className="text-xs text-muted-foreground">Approved output</FieldLabel>
              <div className="flex min-h-7 flex-wrap items-center gap-2">
                {outputBadges(approvedOutputId)}
              </div>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel className="text-xs text-muted-foreground">Rejected output</FieldLabel>
              <div className="flex min-h-7 flex-wrap items-center gap-2">
                {hasRejectedOutput ? (
                  <>
                    {outputBadges(rejectedOutputId)}
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Remove output ${rejectedOutputId}`}
                      title={`Remove output ${rejectedOutputId}`}
                      onClick={() => setRejectedOutput(false)}
                      className="-mr-1 size-4 rounded-full p-0"
                    >
                      <X data-icon="inline-end" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    aria-label="Add rejected output"
                    onClick={() => setRejectedOutput(true)}
                    className="h-5 rounded-xl border-dashed border-divider-strong bg-transparent px-2 py-0.5 font-mono text-xs text-muted-foreground shadow-none hover:bg-muted"
                  >
                    <Plus data-icon="inline-start" />
                    Output
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Field>
    </FieldGroup>
  );
}
