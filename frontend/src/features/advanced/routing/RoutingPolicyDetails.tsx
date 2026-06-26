import { Save } from "lucide-react";
import { useState } from "react";
import type { Agent, AppData } from "backend/shared/domain";
import type { AgentOperation } from "backend/shared/operations";
import type { RoutingPolicy } from "backend/shared/routing-policy";
import { api } from "@/api";
import { Button, TextAreaField } from "@/components/forms/FormControls";
import { EventSelect } from "@/components/simple-rules/EventSelect";
import { findOperation } from "@/features/advanced/model/advanced-resource-model";
import { SimpleRoutingRuleEditor } from "@/features/advanced/routing/SimpleRoutingRuleEditor";
import { routingPolicyFromSimpleDraft } from "@/features/advanced/routing/routing-rule-view-model";

export function RoutingPolicyDetails({ policy, data, refresh }: { policy: RoutingPolicy; data: AppData; refresh: () => Promise<void> }) {
  const [description, setDescription] = useState(policy.description);
  const [inputEventType, setInputEventType] = useState(policy.consumes.eventType);
  const [operationRef, setOperationRef] = useState(policy.dispatch.operation);
  const [message, setMessage] = useState("");
  const operation = findOperation(data, operationRef);

  const save = async () => {
    setMessage("");
    try {
      if (!operation) throw new Error("Select an agent with an active task.");
      await api.save("policies", routingPolicyFromSimpleDraft(policy, {
        inputEventType,
        targetOperationId: operationRef.id,
        targetOperationVersion: operationRef.version,
        description,
        active: policy.active,
        when: policy.when
      }, data));
      setMessage("Routing rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save routing rule.");
    }
  };

  return (
    <SimpleRoutingRuleEditor>
      {message ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
      <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} />
      <div className="grid gap-3 md:grid-cols-2">
        <EventSelect label="Input event" value={inputEventType} events={data.eventDefinitions.filter((event) => event.active)} onChange={setInputEventType} />
        <AgentSelect
          label="Agent"
          value={operation?.agentId ?? ""}
          agents={data.agents.filter((candidate) => candidate.enabled)}
          operations={data.operations.filter((item) => item.active)}
          onChange={(agentId) => {
            const nextOperation = operationForAgent(data.operations, agentId, operationRef);
            if (nextOperation) setOperationRef({ id: nextOperation.id, version: nextOperation.version });
          }}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={() => void save()}>
          <Save className="size-4" />
          Save routing rule
        </Button>
      </div>
    </SimpleRoutingRuleEditor>
  );
}

function AgentSelect({
  label,
  value,
  agents,
  operations,
  onChange
}: {
  label: string;
  value: string;
  agents: Agent[];
  operations: AgentOperation[];
  onChange: (agentId: string) => void;
}) {
  const selectableAgents = agents.filter((agent) => operations.some((operation) => operation.agentId === agent.id));
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-sm font-medium" htmlFor={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-agent`}>{label}</label>
      <select
        id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-agent`}
        className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose agent</option>
        {selectableAgents.map((agent) => (
          <option key={agent.id} value={agent.id}>{agent.name}</option>
        ))}
      </select>
    </div>
  );
}

const operationForAgent = (
  operations: AgentOperation[],
  agentId: string,
  current: { id: string; version: number }
): AgentOperation | undefined => {
  const activeOperations = operations.filter((operation) => operation.active && operation.agentId === agentId);
  return activeOperations.find((operation) => operation.id === current.id && operation.version === current.version) ?? activeOperations[0];
};
