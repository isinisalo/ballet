import { useMemo } from "react";
import { X } from "lucide-react";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultPolicyOutputIds } from "@shared/policy-actions";
import { OutputSelector } from "../outputs/OutputSelector";

export function ActionEditorFields({
  agents,
  config,
  action,
  onChange,
  onCreateOutput
}: {
  agents: Agent[];
  config: ProjectAutomationConfig;
  action: ProjectAction;
  onChange: (patch: Partial<ProjectAction>) => void;
  onCreateOutput: (id: string) => void;
}) {
  const selectedAgentIds = action.agentIds ?? [];
  const selectedOutputIds = action.outputIds ?? [];
  const selectableAgents = useMemo(() => agents.filter((agent) => !selectedAgentIds.includes(agent.id)), [agents, selectedAgentIds]);
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;
  const fallbackOutputIds = () => {
    const availableOutputIds = config.outputs.map((output) => output.id);
    const defaultOutputIds = defaultPolicyOutputIds.filter((outputId) => availableOutputIds.includes(outputId));
    return defaultOutputIds.length > 0 ? defaultOutputIds.slice(0, 1) : availableOutputIds.slice(0, 1);
  };
  const canAddAgent = selectedAgentIds.length < 5 && selectableAgents.length > 0;
  const addAgent = (agentId: string) => {
    if (!agentId || selectedAgentIds.includes(agentId) || selectedAgentIds.length >= 5) return;
    onChange({
      agentIds: [...selectedAgentIds, agentId],
      outputIds: selectedOutputIds.length > 0 ? selectedOutputIds : fallbackOutputIds()
    });
  };
  const removeAgent = (agentId: string) => {
    onChange({ agentIds: selectedAgentIds.filter((candidate) => candidate !== agentId) });
  };

  return (
    <FieldGroup>
      <TextField label="Action ID" required value={action.id} onChange={(id) => onChange({ id })} />
      <TextAreaField label="Description" rows={4} value={action.description} onChange={(description) => onChange({ description })} />
      <Field>
        <FieldLabel>Agents</FieldLabel>
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
      </Field>
      <Field>
        <FieldLabel>Outputs</FieldLabel>
        <OutputSelector
          value={selectedOutputIds}
          initialOptions={config.outputs.map((output) => output.id)}
          disabled={selectedAgentIds.length === 0}
          onChange={(outputIds) => onChange({ outputIds })}
          onCreateOption={onCreateOutput}
        />
      </Field>
    </FieldGroup>
  );
}
