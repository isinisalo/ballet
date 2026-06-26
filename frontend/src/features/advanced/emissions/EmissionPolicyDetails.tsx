import { PlayCircle, Save } from "lucide-react";
import { useState } from "react";
import type { AppData } from "backend/shared/domain";
import type { ContractDefinition } from "backend/shared/contracts";
import type { EmissionPolicy } from "backend/shared/emission-policy";
import type { AgentOperation } from "backend/shared/operations";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { api } from "@/api";
import { ConditionBuilder } from "@/components/condition-builder/ConditionBuilder";
import { conditionDraftToCondition, conditionToConditionDraft, type ConditionDraft } from "@/components/condition-builder/condition-builder-model";
import { Button } from "@/components/forms/FormControls";
import { MappingBuilder } from "@/components/mapping-builder/MappingBuilder";
import { mappingExpressionToRows, rowsToMappingExpression, type MappingBuilderPathOptions, type MappingRowDraft } from "@/components/mapping-builder/mapping-builder-model";
import { Fact, PanelHeading, ReferenceList } from "@/features/advanced/components/AdvancedPanels";
import { DataValueEditor, DryRunResultSummary, fieldValueDraftFromRecord, recordFromFieldValues, type FieldValueDraft } from "@/features/advanced/components/DryRunForms";
import {
  conditionRootForEmission,
  evidenceFieldsFromOutputContract,
  eventNameFor,
  exampleForContract,
  fieldsFromObjectSchema,
  findContract,
  findEventByType,
  findOperation,
  gateDescription,
  isRecord,
  mappingSummary,
  operationOutputExample,
  refLabel,
  resultFieldsFromOutputContract
} from "@/features/advanced/model/advanced-resource-model";

const emissionMappingPathOptions: MappingBuilderPathOptions = {
  dataRoot: "/output/result",
  subjectPath: "/output/summary",
  projectPath: "/trigger/projectId",
  tagPathPrefix: "/trigger/tags"
};

export function EmissionPolicyDetails({ policy, data, refresh }: { policy: EmissionPolicy; data: AppData; refresh: () => Promise<void> }) {
  const operation = findOperation(data, policy.observes.operation);
  const inputContract = findContract(data, operation?.inputContract);
  const outputContract = findContract(data, operation?.outputContract);
  const resultFields = resultFieldsFromOutputContract(outputContract);
  const envelopeFields = outputContract ? fieldsFromObjectSchema(outputContract.schema) : [];
  const conditionRoot = conditionRootForEmission(policy.when);
  const conditionFields = conditionRoot === "/output/result" ? resultFields : envelopeFields;
  const firstEmission = policy.emissions[0];
  const emittedEvent = firstEmission ? findEventByType(data, firstEmission.eventType) : undefined;
  const emittedContract = findContract(data, emittedEvent?.dataContract);
  const emittedFields = emittedContract ? fieldsFromObjectSchema(emittedContract.schema) : [];
  const [condition, setCondition] = useState<ConditionDraft>(() =>
    conditionToConditionDraft(policy.when, conditionRoot) ?? defaultConditionDraft(conditionFields)
  );
  const [mappingRows, setMappingRows] = useState<MappingRowDraft[]>(() =>
    mappingExpressionToRows(firstEmission?.data, emissionMappingPathOptions)
  );
  const [message, setMessage] = useState("");

  const save = async () => {
    setMessage("");
    try {
      await api.save("emissionPolicies", {
        ...policy,
        when: conditionDraftToCondition(condition, conditionRoot),
        emissions: policy.emissions.map((emission, index) => index === 0
          ? { ...emission, data: rowsToMappingExpression(mappingRows, emissionMappingPathOptions) }
          : emission),
        updatedAt: new Date().toISOString()
      });
      setMessage("Emission rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save emission rule.");
    }
  };

  return (
    <div className="grid gap-4 rounded-md border bg-background p-3">
      <PanelHeading title="Emission rule" description="Choose which operation result publishes the next business event." />
      {message ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Fact label="Observed task" value={operation?.name ?? refLabel(policy.observes.operation)} />
        <Fact label="Result behavior" value={policy.onGateFailure === "fail_run" ? "Fail run when a gate fails" : "Skip emission when a gate fails"} />
        <Fact label="Priority" value={String(policy.priority ?? 0)} />
        <Fact label="Emitted events" value={policy.emissions.length ? policy.emissions.map((emission) => eventNameFor(data, emission.eventType)).join(", ") : "No events."} />
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">Result condition</h3>
        <ConditionBuilder
          fields={conditionFields}
          value={condition}
          rootLabel={conditionRoot === "/output/result" ? "Result field" : "Output field"}
          onChange={setCondition}
        />
      </div>
      <ReferenceList
        title="Technical gates"
        items={(policy.gates ?? []).map(gateDescription)}
        emptyLabel="No technical gates are required before publishing."
      />
      <div className="grid gap-3">
        <h3 className="text-sm font-medium">Emitted events</h3>
        {policy.emissions.map((emission) => (
          <div key={emission.slot} className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm">
            <div className="font-medium">{eventNameFor(data, emission.eventType)} · {emission.slot}</div>
            <div className="grid gap-2 md:grid-cols-3">
              <Fact label="Subject source" value={mappingSummary(emission.subject) || "No subject mapping."} />
              <Fact label="Tags source" value={mappingSummary(emission.tags) || "No tag mapping."} />
              <Fact label="Deduplication" value={emission.dedupeKey?.template ?? "Run and branch scoped."} />
            </div>
          </div>
        ))}
      </div>
      {firstEmission ? (
        <MappingBuilder
          sourceFields={resultFields}
          targetFields={emittedFields}
          rows={mappingRows}
          onChange={setMappingRows}
          pathOptions={emissionMappingPathOptions}
          previewContext={{
            input: exampleForContract(inputContract),
            output: operationOutputExample(outputContract),
            trigger: {
              projectId: "Example project",
              tags: emittedEvent?.tags ?? []
            }
          }}
          labels={{
            title: `Event data mapping for ${emittedEvent?.name ?? firstEmission.eventType}`,
            sourceField: "Operation result field",
            subject: "Operation summary",
            project: "Trigger project",
            tag: "Trigger tag"
          }}
        />
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => void save()}>
          <Save className="size-4" />
          Save emission rule
        </Button>
      </div>
      <EmissionDryRunPanel policy={policy} operation={operation} inputContract={inputContract} outputContract={outputContract} />
    </div>
  );
}

function EmissionDryRunPanel({
  policy,
  operation,
  inputContract,
  outputContract
}: {
  policy: EmissionPolicy;
  operation?: AgentOperation;
  inputContract?: ContractDefinition;
  outputContract?: ContractDefinition;
}) {
  const inputFields = inputContract ? fieldsFromObjectSchema(inputContract.schema) : [];
  const outputExample = operationOutputExample(outputContract);
  const envelopeFields = outputEnvelopeFieldsFromContract(outputContract);
  const resultFields = resultFieldsFromOutputContract(outputContract);
  const evidenceFields = evidenceFieldsFromOutputContract(outputContract);
  const [operationInputValues, setOperationInputValues] = useState<FieldValueDraft>(() =>
    fieldValueDraftFromRecord(inputFields, exampleForContract(inputContract))
  );
  const [outputEnvelopeValues, setOutputEnvelopeValues] = useState<FieldValueDraft>(() =>
    fieldValueDraftFromRecord(envelopeFields, outputExample)
  );
  const [outputResultValues, setOutputResultValues] = useState<FieldValueDraft>(() =>
    fieldValueDraftFromRecord(resultFields, isRecord(outputExample.result) ? outputExample.result : {})
  );
  const [outputEvidenceValues, setOutputEvidenceValues] = useState<FieldValueDraft>(() =>
    fieldValueDraftFromRecord(evidenceFields, isRecord(outputExample.evidence) ? outputExample.evidence : {})
  );
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState("");

  const run = async () => {
    setError("");
    setResult(undefined);
    try {
      const operationInput = recordFromFieldValues(inputFields, operationInputValues, "Emission test operation input");
      const operationOutput = {
        ...recordFromFieldValues(envelopeFields, outputEnvelopeValues, "Emission test operation output"),
        result: recordFromFieldValues(resultFields, outputResultValues, "Emission test result fields"),
        ...(evidenceFields.length
          ? { evidence: recordFromFieldValues(evidenceFields, outputEvidenceValues, "Emission test evidence fields") }
          : {})
      };
      const response = await api.dryRunEmissionPolicy(policy.id, {
        operationInput,
        operationOutput
      });
      setResult(response);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to test emission rule.");
    }
  };

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <PanelHeading title="Test emission rule" description={`Run this saved rule against an example ${operation?.name ?? "operation"} result.`} />
      {error ? <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      <div className="grid gap-4">
        <DataValueEditor
          title="Operation input example"
          fields={inputFields}
          values={operationInputValues}
          onChange={setOperationInputValues}
          labelPrefix="Operation input"
          emptyLabel="This task has no input fields to test."
        />
        <DataValueEditor
          title="Operation output example"
          fields={envelopeFields}
          values={outputEnvelopeValues}
          onChange={setOutputEnvelopeValues}
          labelPrefix="Operation output"
          emptyLabel="This task has no output envelope fields to test."
        />
        <DataValueEditor
          title="Operation result example"
          fields={resultFields}
          values={outputResultValues}
          onChange={setOutputResultValues}
          labelPrefix="Operation result"
          emptyLabel="This task has no result fields to test."
        />
        {evidenceFields.length ? (
          <DataValueEditor
            title="Operation evidence example"
            fields={evidenceFields}
            values={outputEvidenceValues}
            onChange={setOutputEvidenceValues}
            labelPrefix="Operation evidence"
            emptyLabel="This task has no evidence fields to test."
          />
        ) : null}
      </div>
      <div>
        <Button type="button" onClick={() => void run()}>
          <PlayCircle className="size-4" />
          Test emission rule
        </Button>
      </div>
      <DryRunResultSummary kind="emission" result={result} />
    </div>
  );
}

const outputEnvelopeFieldsFromContract = (contract: ContractDefinition | undefined): DataShapeFieldDraft[] => {
  const fields = contract ? fieldsFromObjectSchema(contract.schema).filter((field) => field.name === "status" || field.name === "summary") : [];
  if (fields.some((field) => field.name === "status") && fields.some((field) => field.name === "summary")) return fields;
  return [
    { name: "status", label: "Status", type: "text", required: true, allowedValues: ["completed", "blocked", "needs_input", "failed"], default: "completed" },
    { name: "summary", label: "Summary", type: "text", required: true, default: "Dry-run completed" }
  ];
};

const defaultConditionDraft = (fields: DataShapeFieldDraft[]): ConditionDraft => ({
  field: fields[0]?.name ?? "",
  op: "eq",
  value: ""
});
