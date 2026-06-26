import { PlayCircle, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppData, EventDefinition } from "backend/shared/domain";
import type { ContractDefinition } from "backend/shared/contracts";
import type { RoutingPolicy } from "backend/shared/routing-policy";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import type { Condition } from "backend/shared/conditions";
import { api } from "@/api";
import { ConditionBuilder } from "@/components/condition-builder/ConditionBuilder";
import { conditionDraftToCondition, conditionToConditionDraft, type ConditionDraft } from "@/components/condition-builder/condition-builder-model";
import { Button, TextAreaField, TextField } from "@/components/forms/FormControls";
import { MappingBuilder } from "@/components/mapping-builder/MappingBuilder";
import { mappingExpressionToRows, rowsToMappingExpression, type MappingRowDraft } from "@/components/mapping-builder/mapping-builder-model";
import { AutoMappingSummary } from "@/components/simple-rules/AutoMappingSummary";
import { EventSelect } from "@/components/simple-rules/EventSelect";
import { OperationSelect } from "@/components/simple-rules/OperationSelect";
import { SimpleConditionSentence, type SimpleConditionOperator } from "@/components/simple-rules/SimpleConditionSentence";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Fact, PanelHeading } from "@/features/advanced/components/AdvancedPanels";
import { DataValueEditor, DryRunResultSummary, fieldValueDraftFromRecord, recordFromFieldValues, type FieldValueDraft } from "@/features/advanced/components/DryRunForms";
import { exampleForContract, fieldsFromObjectSchema, findContract, findEventByType, findOperation, isRecord, refLabel } from "@/features/advanced/model/advanced-resource-model";
import { RoutingRuleAdvancedDetails } from "@/features/advanced/routing/RoutingRuleAdvancedDetails";
import { SimpleRoutingRuleCard } from "@/features/advanced/routing/SimpleRoutingRuleCard";
import { SimpleRoutingRuleEditor } from "@/features/advanced/routing/SimpleRoutingRuleEditor";
import {
  autoMapEventToOperationInput,
  routingPolicyFromSimpleDraft,
  simpleRoutingRuleFromPolicy,
  summarizeRoutingCondition
} from "@/features/advanced/routing/routing-rule-view-model";

export function RoutingPolicyDetails({ policy, data, refresh }: { policy: RoutingPolicy; data: AppData; refresh: () => Promise<void> }) {
  const [inputEventType, setInputEventType] = useState(policy.consumes.eventType);
  const [operationRef, setOperationRef] = useState(policy.dispatch.operation);
  const [description, setDescription] = useState(policy.description);
  const [active, setActive] = useState(policy.active);
  const sourceEvent = findEventByType(data, inputEventType);
  const operation = findOperation(data, operationRef);
  const agent = operation ? data.agents.find((candidate) => candidate.id === operation.agentId) : undefined;
  const sourceContract = findContract(data, sourceEvent?.dataContract);
  const targetContract = findContract(data, operation?.inputContract);
  const sourceFields = sourceContract ? fieldsFromObjectSchema(sourceContract.schema) : [];
  const targetFields = targetContract ? fieldsFromObjectSchema(targetContract.schema) : [];
  const [simpleCondition, setSimpleCondition] = useState<Condition | undefined>(policy.when);
  const [advancedCondition, setAdvancedCondition] = useState<ConditionDraft>(() =>
    conditionToConditionDraft(policy.when, "/event/data") ?? defaultConditionDraft(sourceFields)
  );
  const [mappingRows, setMappingRows] = useState<MappingRowDraft[]>(() => mappingExpressionToRows(policy.input));
  const [message, setMessage] = useState("");
  const viewModel = simpleRoutingRuleFromPolicy(policy, data);
  const autoMapping = useMemo(
    () => autoMapEventToOperationInput(sourceEvent, sourceContract, operation, targetContract),
    [sourceEvent, sourceContract, operation, targetContract]
  );
  const simpleConditionLeaf = simpleCondition && "path" in simpleCondition ? simpleCondition : undefined;
  const conditionField = simpleConditionLeaf?.path.startsWith("/event/data/") ? simpleConditionLeaf.path.slice("/event/data/".length) : sourceFields[0]?.name ?? "";
  const conditionOperator = (simpleConditionLeaf?.op === "neq" || simpleConditionLeaf?.op === "exists" || simpleConditionLeaf?.op === "contains" || simpleConditionLeaf?.op === "gt" || simpleConditionLeaf?.op === "lt" ? simpleConditionLeaf.op : "eq") as SimpleConditionOperator;
  const conditionValue = simpleConditionLeaf?.value === undefined ? "" : String(simpleConditionLeaf.value);

  const setSimpleConditionField = (field: string, operator = conditionOperator, value = conditionValue) => {
    setSimpleCondition({ path: `/event/data/${field}`, op: operator, ...(operator === "exists" ? { value: true } : { value }) });
  };

  const save = async () => {
    setMessage("");
    try {
      await api.save("policies", routingPolicyFromSimpleDraft(policy, {
        inputEventType,
        targetOperationId: operationRef.id,
        targetOperationVersion: operationRef.version,
        description,
        active,
        when: simpleCondition
      }, data));
      setMessage("Routing rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save routing rule.");
    }
  };

  const saveAdvanced = async () => {
    setMessage("");
    try {
      await api.save("policies", {
        ...policy,
        active,
        consumes: { eventType: inputEventType },
        dispatch: { operation: operationRef },
        description,
        when: conditionDraftToCondition(advancedCondition, "/event/data"),
        input: rowsToMappingExpression(mappingRows),
        updatedAt: new Date().toISOString()
      });
      setMessage("Advanced routing rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save routing rule.");
    }
  };

  return (
    <SimpleRoutingRuleEditor>
      <SimpleRoutingRuleCard rule={viewModel} />
      <PanelHeading title="Routing rule" description="When this event happens, choose which agent task should start." />
      {message ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <EventSelect label="Input event" value={inputEventType} events={data.eventDefinitions.filter((event) => event.active)} onChange={setInputEventType} />
        <OperationSelect
          label="Send to agent task"
          value={`${operationRef.id}@@${operationRef.version}`}
          operations={data.operations.filter((item) => item.active)}
          agents={data.agents}
          onChange={(id, version) => setOperationRef({ id, version })}
        />
      </div>
      <TextAreaField label="Description" value={description} onChange={setDescription} rows={2} />
      <div className="flex items-center gap-2">
        <Switch id={`routing-enabled-${policy.id}`} checked={active} onCheckedChange={setActive} />
        <Label htmlFor={`routing-enabled-${policy.id}`}>Enabled</Label>
      </div>
      <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
        <h3 className="text-sm font-medium">Condition</h3>
        <div className="text-sm text-muted-foreground">{summarizeRoutingCondition(simpleCondition)}</div>
        {!simpleCondition ? (
          <div>
            <Button type="button" variant="outline" onClick={() => setSimpleConditionField(sourceFields[0]?.name ?? "")}>Add condition</Button>
          </div>
        ) : (
          <SimpleConditionSentence
            rootLabel="Event"
            fields={sourceFields}
            field={conditionField}
            operator={conditionOperator}
            value={conditionValue}
            onFieldChange={(field) => setSimpleConditionField(field)}
            onOperatorChange={(operator) => setSimpleConditionField(conditionField, operator)}
            onValueChange={(value) => setSimpleConditionField(conditionField, conditionOperator, value)}
          />
        )}
      </div>
      <AutoMappingSummary title="Agent input preview" rows={autoMapping.summary} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={() => void save()}>
          <Save className="size-4" />
          Save routing rule
        </Button>
      </div>
      <RoutingRuleAdvancedDetails>
        <div className="grid gap-3 md:grid-cols-4">
          <Fact label="Source event" value={sourceEvent?.name ?? inputEventType} />
          <Fact label="Target task" value={operation?.name ?? refLabel(operationRef)} />
          <Fact label="Agent" value={agent?.name ?? operation?.agentId ?? "Missing agent."} />
          <Fact label="Selection" value={policy.selection?.mode === "exclusive" ? `Exclusive${policy.selection.group ? ` · ${policy.selection.group}` : ""}` : "Fan-out"} />
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Condition builder</h3>
          <ConditionBuilder fields={sourceFields} value={advancedCondition} rootLabel="Trigger field" onChange={setAdvancedCondition} />
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
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => void saveAdvanced()}><Save className="size-4" />Save advanced details</Button>
        </div>
        <RoutingDryRunPanel policy={{ ...policy, consumes: { eventType: inputEventType } }} sourceEvent={sourceEvent} sourceContract={sourceContract} />
      </RoutingRuleAdvancedDetails>
    </SimpleRoutingRuleEditor>
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
