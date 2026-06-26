import { PlayCircle, Save } from "lucide-react";
import { useState } from "react";
import type { AppData, EventDefinition } from "backend/shared/domain";
import type { ContractDefinition } from "backend/shared/contracts";
import type { RoutingPolicy } from "backend/shared/routing-policy";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { api } from "@/api";
import { ConditionBuilder } from "@/components/condition-builder/ConditionBuilder";
import { conditionDraftToCondition, conditionToConditionDraft, type ConditionDraft } from "@/components/condition-builder/condition-builder-model";
import { Button, TextField } from "@/components/forms/FormControls";
import { MappingBuilder } from "@/components/mapping-builder/MappingBuilder";
import { mappingExpressionToRows, rowsToMappingExpression, type MappingRowDraft } from "@/components/mapping-builder/mapping-builder-model";
import { Fact, PanelHeading } from "@/features/advanced/components/AdvancedPanels";
import { DataValueEditor, DryRunResultSummary, fieldValueDraftFromRecord, recordFromFieldValues, type FieldValueDraft } from "@/features/advanced/components/DryRunForms";
import { exampleForContract, fieldsFromObjectSchema, findContract, findEventByType, findOperation, isRecord, refLabel } from "@/features/advanced/model/advanced-resource-model";

export function RoutingPolicyDetails({ policy, data, refresh }: { policy: RoutingPolicy; data: AppData; refresh: () => Promise<void> }) {
  const sourceEvent = findEventByType(data, policy.consumes.eventType);
  const operation = findOperation(data, policy.dispatch.operation);
  const agent = operation ? data.agents.find((candidate) => candidate.id === operation.agentId) : undefined;
  const sourceContract = findContract(data, sourceEvent?.dataContract);
  const targetContract = findContract(data, operation?.inputContract);
  const sourceFields = sourceContract ? fieldsFromObjectSchema(sourceContract.schema) : [];
  const targetFields = targetContract ? fieldsFromObjectSchema(targetContract.schema) : [];
  const [condition, setCondition] = useState<ConditionDraft>(() =>
    conditionToConditionDraft(policy.when, "/event/data") ?? defaultConditionDraft(sourceFields)
  );
  const [mappingRows, setMappingRows] = useState<MappingRowDraft[]>(() => mappingExpressionToRows(policy.input));
  const [message, setMessage] = useState("");

  const save = async () => {
    setMessage("");
    try {
      await api.save("policies", {
        ...policy,
        when: conditionDraftToCondition(condition, "/event/data"),
        input: rowsToMappingExpression(mappingRows),
        updatedAt: new Date().toISOString()
      });
      setMessage("Routing rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save routing rule.");
    }
  };

  return (
    <div className="grid gap-4 rounded-md border bg-background p-3">
      <PanelHeading title="Routing rule" description="Choose when an event should ask an agent to perform a task." />
      {message ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Fact label="Source event" value={sourceEvent?.name ?? policy.consumes.eventType} />
        <Fact label="Target task" value={operation?.name ?? refLabel(policy.dispatch.operation)} />
        <Fact label="Agent" value={agent?.name ?? operation?.agentId ?? "Missing agent."} />
        <Fact label="Selection" value={policy.selection?.mode === "exclusive" ? `Exclusive${policy.selection.group ? ` · ${policy.selection.group}` : ""}` : "Fan-out"} />
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">Condition</h3>
        <ConditionBuilder
          fields={sourceFields}
          value={condition}
          rootLabel="Trigger field"
          onChange={setCondition}
        />
      </div>
      <MappingBuilder
        sourceFields={sourceFields}
        targetFields={targetFields}
        rows={mappingRows}
        onChange={setMappingRows}
        previewContext={{
          event: {
            subject: "Example subject",
            projectId: "Example project",
            tags: sourceEvent?.tags ?? [],
            data: sourceEvent?.examples[0] ?? sourceContract?.examples[0] ?? exampleForContract(sourceContract)
          }
        }}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Fact label="Invalid input behavior" value={policy.onInvalidInput === "reject-event" ? "Reject the event" : "Skip this rule"} />
        <Fact label="Priority" value={String(policy.priority ?? 0)} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => void save()}>
          <Save className="size-4" />
          Save routing rule
        </Button>
      </div>
      <RoutingDryRunPanel policy={policy} sourceEvent={sourceEvent} sourceContract={sourceContract} />
    </div>
  );
}

function RoutingDryRunPanel({
  policy,
  sourceEvent,
  sourceContract
}: {
  policy: RoutingPolicy;
  sourceEvent?: EventDefinition;
  sourceContract?: ContractDefinition;
}) {
  const sourceFields = sourceContract ? fieldsFromObjectSchema(sourceContract.schema) : [];
  const exampleData = sourceEvent?.examples[0] ?? sourceContract?.examples[0] ?? exampleForContract(sourceContract);
  const [subject, setSubject] = useState("dry-run-subject");
  const [payloadValues, setPayloadValues] = useState<FieldValueDraft>(() =>
    fieldValueDraftFromRecord(sourceFields, isRecord(exampleData) ? exampleData : {})
  );
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState("");

  const run = async () => {
    setError("");
    setResult(undefined);
    try {
      const payload = recordFromFieldValues(sourceFields, payloadValues, "Routing test event data");
      const response = await api.dryRunRoutingPolicy(policy.id, {
        eventType: policy.consumes.eventType,
        subject,
        tags: sourceEvent?.tags ?? [],
        payload
      });
      setResult(response);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to test routing rule.");
    }
  };

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <PanelHeading title="Test routing rule" description="Run this saved rule against example trigger data." />
      {error ? <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      <div className="grid gap-3">
        <TextField label="Routing test subject" value={subject} onChange={setSubject} />
        <DataValueEditor
          title="Trigger data example"
          fields={sourceFields}
          values={payloadValues}
          onChange={setPayloadValues}
          labelPrefix="Routing test"
          emptyLabel="This trigger has no data fields to test."
        />
      </div>
      <div>
        <Button type="button" onClick={() => void run()}>
          <PlayCircle className="size-4" />
          Test routing rule
        </Button>
      </div>
      <DryRunResultSummary kind="routing" result={result} />
    </div>
  );
}

const defaultConditionDraft = (fields: DataShapeFieldDraft[]): ConditionDraft => ({
  field: fields[0]?.name ?? "",
  op: "eq",
  value: ""
});
