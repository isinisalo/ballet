import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage } from "@shared/api/automationValidation";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { defaultPolicyOutputIds, normalizeActionOutputSlots } from "@shared/policy-actions";
import { Plus, ShieldCheck, X } from "lucide-react";
import { useMemo } from "react";
import { ActionInputField } from "./ActionInputField";
import { actionInputSources } from "./actionInputSources";
import { actionOutputTargetsByOutputId, type ActionOutputTarget } from "./actionOutputTargets";

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
  const selectedAgentIds = action.agentIds ?? [];
  const selectedOutputIds = action.outputIds ?? [];
  const humanGate = Boolean(action.humanGate);
  const outputSlotIds = humanGate || selectedAgentIds.length > 0 ? normalizeActionOutputSlots(selectedOutputIds) : [];
  const actionIdError = automationTokenValidationMessage("Action ID", action.id);
  const descriptionError = automationStringValidationMessage("Description", action.description, automationFieldLimits.description, { required: false });
  const selectableAgents = useMemo(() => agents.filter((agent) => !selectedAgentIds.includes(agent.id)), [agents, selectedAgentIds]);
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;
  const fallbackOutputIds = () => {
    const availableOutputIds = config.outputs.map((output) => output.id);
    const defaultOutputIds = defaultPolicyOutputIds.filter((outputId) => availableOutputIds.includes(outputId));
    return defaultOutputIds.length === defaultPolicyOutputIds.length ? defaultOutputIds : [...defaultPolicyOutputIds];
  };
  const canAddAgent = selectedAgentIds.length < 5 && selectableAgents.length > 0;
  const addAgent = (agentId: string) => {
    if (humanGate || !agentId || selectedAgentIds.includes(agentId) || selectedAgentIds.length >= 5) return;
    onChange({
      agentIds: [...selectedAgentIds, agentId],
      outputIds: selectedOutputIds.length > 0 ? selectedOutputIds : fallbackOutputIds()
    });
  };
  const removeAgent = (agentId: string) => {
    onChange({ agentIds: selectedAgentIds.filter((candidate) => candidate !== agentId) });
  };
  const updateHumanGate = (enabled: boolean) => {
    onChange(enabled
      ? {
        humanGate: true,
        agentIds: [],
        outputIds: selectedOutputIds.length > 0 ? normalizeActionOutputSlots(selectedOutputIds) : fallbackOutputIds()
      }
      : {
        humanGate: false,
        agentIds: agents[0]?.id ? [agents[0].id] : [],
        outputIds: agents[0]?.id ? (selectedOutputIds.length > 0 ? normalizeActionOutputSlots(selectedOutputIds) : fallbackOutputIds()) : []
      });
  };
  const approvedOutputId = defaultPolicyOutputIds[0];
  const rejectedOutputId = defaultPolicyOutputIds[1];
  const hasRejectedOutput = outputSlotIds.includes(rejectedOutputId);
  const setRejectedOutput = (enabled: boolean) => {
    onChange({ outputIds: enabled ? [approvedOutputId, rejectedOutputId] : [approvedOutputId] });
  };
  const inputSources = actionInputSources(config.policies, action.id);
  const outputTargetById = actionOutputTargetsByOutputId(config, action.id, outputSlotIds);
  const outputDisplayTargets = (outputId: string): ActionOutputTarget[] =>
    outputTargetById[outputId] ?? [{ type: "event", id: outputId, label: outputId }];
  const outputDisplayClassName = (target: ActionOutputTarget) => target.type === "trigger"
    ? "border-tertiary/60 bg-tertiary/10 font-mono text-tertiary"
    : "border-primary/60 bg-primary/10 font-mono text-primary";
  const outputBadges = (outputId: string) => outputDisplayTargets(outputId).map((target) => (
    <Badge key={`${target.type}:${target.id}`} variant="outline" className={`${outputDisplayClassName(target)} max-w-full`}>
      <span className="truncate" title={target.label}>{target.label}</span>
    </Badge>
  ));

  return (
    <FieldGroup>
      <TextField
        label="Action ID"
        required
        minLength={automationFieldLimits.token.min}
        maxLength={automationFieldLimits.token.max}
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
      <ActionInputField sources={inputSources} />
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
        <FieldLabel>Agents</FieldLabel>
        {humanGate ? (
          <div className="flex min-h-7 flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-tertiary/60 bg-tertiary/10 font-mono text-tertiary">
              <ShieldCheck data-icon="inline-start" />
              Human operator
            </Badge>
          </div>
        ) : (
          <div className="flex min-h-7 flex-wrap items-center gap-2">
            {selectedAgentIds.map((agentId) => (
              <Badge key={agentId} variant="outline" className="border-divider-strong bg-muted/50 font-mono">
                {agentLabel(agentId)}
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove agent ${agentLabel(agentId)}`}
                  title={`Remove agent ${agentLabel(agentId)}`}
                  onClick={() => removeAgent(agentId)}
                  className="-mr-1 size-4 rounded-full p-0"
                >
                  <X data-icon="inline-end" />
                </Button>
              </Badge>
            ))}
            <Select onValueChange={addAgent} disabled={!canAddAgent}>
              <SelectTrigger
                aria-label="Add agent"
                className="h-5 w-auto gap-1 rounded-xl border-dashed border-divider-strong bg-transparent px-2 py-0.5 font-mono text-xs text-muted-foreground shadow-none hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SelectValue placeholder="+ Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {selectableAgents.map((agent) => (
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
        {!humanGate && selectedAgentIds.length === 0 ? (
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
