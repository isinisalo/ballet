import { Save } from "lucide-react";
import { useState } from "react";
import type { Condition } from "backend/shared/conditions";
import type { AppData } from "backend/shared/domain";
import type { EmissionPolicy } from "backend/shared/emission-policy";
import { api } from "@/api";
import { Button, TextAreaField } from "@/components/forms/FormControls";
import { EventSelect } from "@/components/simple-rules/EventSelect";
import { OperationSelect } from "@/components/simple-rules/OperationSelect";
import { SimpleEmissionRuleEditor } from "@/features/advanced/emissions/SimpleEmissionRuleEditor";
import { emissionPolicyFromSimpleDraft, emissionPresetCondition } from "@/features/advanced/emissions/emission-rule-view-model";

const conditionOptions = [
  { value: "completed", label: "Task completed" },
  { value: "blocked", label: "Task blocked" },
  { value: "needs_input", label: "Task needs input" },
  { value: "approved", label: "Decision approved" },
  { value: "changes_requested", label: "Changes requested" }
];

export function EmissionPolicyDetails({ policy, data, refresh }: { policy: EmissionPolicy; data: AppData; refresh: () => Promise<void> }) {
  const [description, setDescription] = useState(policy.description);
  const [operationRef, setOperationRef] = useState(policy.observes.operation);
  const [emittedEventType, setEmittedEventType] = useState(policy.emissions[0]?.eventType ?? "");
  const [conditionPreset, setConditionPreset] = useState(() => conditionPresetFromCondition(policy.when));
  const [message, setMessage] = useState("");

  const save = async () => {
    setMessage("");
    try {
      await api.save("emissionPolicies", emissionPolicyFromSimpleDraft(policy, {
        operationId: operationRef.id,
        operationVersion: operationRef.version,
        condition: conditionPreset === "custom" ? policy.when ?? emissionPresetCondition("completed") : emissionPresetCondition(conditionPreset),
        emittedEventType,
        description,
        active: policy.active,
        gates: policy.gates ?? []
      }, data));
      setMessage("Emission rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save emission rule.");
    }
  };

  return (
    <SimpleEmissionRuleEditor>
      {message ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
      <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} />
      <div className="grid gap-3 md:grid-cols-2">
        <OperationSelect
          label="When this agent task finishes"
          value={`${operationRef.id}@@${operationRef.version}`}
          operations={data.operations.filter((item) => item.active)}
          agents={data.agents}
          onChange={(id, version) => setOperationRef({ id, version })}
        />
        <EventSelect label="Publish this event" value={emittedEventType} events={data.eventDefinitions.filter((event) => event.active)} onChange={setEmittedEventType} />
      </div>
      <div className="grid min-w-0 gap-1.5">
        <label className="text-sm font-medium" htmlFor={`emission-condition-${policy.id}`}>And output is</label>
        <select
          id={`emission-condition-${policy.id}`}
          className="h-8 w-full min-w-0 rounded-md border border-border bg-[color:var(--input)] px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
          value={conditionPreset}
          onChange={(event) => setConditionPreset(event.target.value)}
        >
          {conditionPreset === "custom" ? <option value="custom">Current rule condition</option> : null}
          {conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={() => void save()}>
          <Save className="size-4" />
          Save emission rule
        </Button>
      </div>
    </SimpleEmissionRuleEditor>
  );
}

const conditionPresetFromCondition = (condition: Condition | undefined): string => {
  if (!condition) return "completed";
  if ("path" in condition && condition.path === "/output/status" && condition.op === "eq") {
    if (condition.value === "blocked") return "blocked";
    if (condition.value === "needs_input") return "needs_input";
    if (condition.value === "completed") return "completed";
  }
  if ("all" in condition) {
    const completed = condition.all.some((item) => "path" in item && item.path === "/output/status" && item.op === "eq" && item.value === "completed");
    const decision = condition.all.find((item) => "path" in item && item.path === "/output/result/decision" && item.op === "eq");
    if (completed && decision && "value" in decision) {
      if (decision.value === "approved") return "approved";
      if (decision.value === "changes_requested") return "changes_requested";
    }
  }
  return "custom";
};
