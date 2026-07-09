import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { automationFieldLimits, automationStringValidationMessage } from "@shared/api/automationValidation";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { defaultActionOutputIds } from "@shared/policy-actions";
import { ShieldCheck } from "lucide-react";
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
  const humanGate = Boolean(action.humanGate);
  const outputSlotIds = humanGate || selectedAgentId ? [...defaultActionOutputIds] : [];
  const actionIdError = automationStringValidationMessage("Action ID", action.id, automationFieldLimits.policyId);
  const descriptionError = automationStringValidationMessage("Description", action.description, automationFieldLimits.description, { required: false });
  const updateAgent = (agentId: string) => {
    if (humanGate) return;
    if (agentId === noAgentSelectionValue) {
      onChange({ agentId: undefined });
      return;
    }
    if (!agentId) return;
    onChange({ agentId });
  };
  const updateHumanGate = (enabled: boolean) => {
    onChange(enabled
      ? {
        humanGate: true,
        agentId: undefined
      }
      : {
        humanGate: false,
        agentId: agents[0]?.id
      });
  };
  const approvedOutputId = defaultActionOutputIds[0];
  const rejectedOutputId = defaultActionOutputIds[1];
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
                {outputBadges(rejectedOutputId)}
              </div>
            </div>
          </div>
        )}
      </Field>
    </FieldGroup>
  );
}
