import { PlayCircle, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppData } from "backend/shared/domain";
import type { ContractDefinition } from "backend/shared/contracts";
import type { EmissionPolicy } from "backend/shared/emission-policy";
import type { AgentOperation } from "backend/shared/operations";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { api } from "@/api";
import { ConditionBuilder } from "@/components/condition-builder/ConditionBuilder";
import { conditionDraftToCondition, conditionToConditionDraft, type ConditionDraft } from "@/components/condition-builder/condition-builder-model";
import { Button, TextAreaField } from "@/components/forms/FormControls";
import { MappingBuilder } from "@/components/mapping-builder/MappingBuilder";
import { mappingExpressionToRows, rowsToMappingExpression, type MappingBuilderPathOptions, type MappingRowDraft } from "@/components/mapping-builder/mapping-builder-model";
import { AutoMappingSummary } from "@/components/simple-rules/AutoMappingSummary";
import { EventSelect } from "@/components/simple-rules/EventSelect";
import { OperationSelect } from "@/components/simple-rules/OperationSelect";
import { SimpleGateChecklist } from "@/components/simple-rules/SimpleGateChecklist";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Fact, PanelHeading, ReferenceList } from "@/features/advanced/components/AdvancedPanels";
import { DataValueEditor, DryRunResultSummary, fieldValueDraftFromRecord, recordFromFieldValues, type FieldValueDraft } from "@/features/advanced/components/DryRunForms";
import { EmissionRuleAdvancedDetails } from "@/features/advanced/emissions/EmissionRuleAdvancedDetails";
import { SimpleEmissionRuleCard } from "@/features/advanced/emissions/SimpleEmissionRuleCard";
import { SimpleEmissionRuleEditor } from "@/features/advanced/emissions/SimpleEmissionRuleEditor";
import {
  autoMapOperationOutputToEventData,
  emissionPolicyFromSimpleDraft,
  emissionPresetCondition,
  simpleEmissionRuleFromPolicy
} from "@/features/advanced/emissions/emission-rule-view-model";
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
  const [operationRef, setOperationRef] = useState(policy.observes.operation);
  const [emittedEventType, setEmittedEventType] = useState(policy.emissions[0]?.eventType ?? "");
  const [description, setDescription] = useState(policy.description);
  const [active, setActive] = useState(policy.active);
  const [simpleCondition, setSimpleCondition] = useState(policy.when ?? emissionPresetCondition("completed"));
  const [conditionPreset, setConditionPreset] = useState("completed");
  const [gates, setGates] = useState(policy.gates ?? []);
  const operation = findOperation(data, operationRef);
  const inputContract = findContract(data, operation?.inputContract);
  const outputContract = findContract(data, operation?.outputContract);
  const resultFields = resultFieldsFromOutputContract(outputContract);
  const envelopeFields = outputContract ? fieldsFromObjectSchema(outputContract.schema) : [];
  const conditionRoot = conditionRootForEmission(policy.when);
  const conditionFields = conditionRoot === "/output/result" ? resultFields : envelopeFields;
  const firstEmission = policy.emissions[0];
  const emittedEvent = findEventByType(data, emittedEventType);
  const emittedContract = findContract(data, emittedEvent?.dataContract);
  const emittedFields = emittedContract ? fieldsFromObjectSchema(emittedContract.schema) : [];
  const [condition, setCondition] = useState<ConditionDraft>(() =>
    conditionToConditionDraft(policy.when, conditionRoot) ?? defaultConditionDraft(conditionFields)
  );
  const [mappingRows, setMappingRows] = useState<MappingRowDraft[]>(() =>
    mappingExpressionToRows(firstEmission?.data, emissionMappingPathOptions)
  );
  const [message, setMessage] = useState("");
  const viewModel = simpleEmissionRuleFromPolicy(policy, data);
  const autoMapping = useMemo(
    () => autoMapOperationOutputToEventData(operation, outputContract, emittedEvent, emittedContract),
    [operation, outputContract, emittedEvent, emittedContract]
  );
  const gitCommitFields = resultFields.map((field) => field.name);
  const gitCommitPath = gates.find((gate) => gate.type === "git_commit_exists")?.path ?? (gitCommitFields.includes("gitSha") ? "/output/result/gitSha" : gitCommitFields.includes("git_sha") ? "/output/result/git_sha" : gitCommitFields[0] ? `/output/result/${gitCommitFields[0]}` : "/output/result/gitSha");

  const save = async () => {
    setMessage("");
    try {
      await api.save("emissionPolicies", emissionPolicyFromSimpleDraft(policy, {
        operationId: operationRef.id,
        operationVersion: operationRef.version,
        condition: simpleCondition,
        emittedEventType,
        description,
        active,
        gates
      }, data));
      setMessage("Emission rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save emission rule.");
    }
  };

  const saveAdvanced = async () => {
    setMessage("");
    try {
      await api.save("emissionPolicies", {
        ...policy,
        active,
        description,
        observes: { operation: operationRef },
        when: conditionDraftToCondition(condition, conditionRoot),
        gates,
        emissions: policy.emissions.map((emission, index) => index === 0
          ? { ...emission, eventType: emittedEventType, data: rowsToMappingExpression(mappingRows, emissionMappingPathOptions) }
          : emission),
        updatedAt: new Date().toISOString()
      });
      setMessage("Advanced emission rule saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save emission rule.");
    }
  };

  return (
    <SimpleEmissionRuleEditor>
      <SimpleEmissionRuleCard rule={viewModel} />
      <PanelHeading title="Emission rule" description="When this agent task returns a result, choose which event should be published." />
      {message ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
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
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor={`emission-condition-${policy.id}`}>And output is</label>
        <select
          id={`emission-condition-${policy.id}`}
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={conditionPreset}
          onChange={(event) => {
            setConditionPreset(event.target.value);
            setSimpleCondition(emissionPresetCondition(event.target.value));
          }}
        >
          <option value="completed">Task completed</option>
          <option value="blocked">Task blocked</option>
          <option value="needs_input">Task needs input</option>
          <option value="approved">Decision approved</option>
          <option value="changes_requested">Changes requested</option>
        </select>
      </div>
      <TextAreaField label="Description" value={description} onChange={setDescription} rows={2} />
      <div className="flex items-center gap-2">
        <Switch id={`emission-enabled-${policy.id}`} checked={active} onCheckedChange={setActive} />
        <Label htmlFor={`emission-enabled-${policy.id}`}>Enabled</Label>
      </div>
      <AutoMappingSummary title="Event data preview" rows={autoMapping.summary} />
      <SimpleGateChecklist
        gates={gates}
        gitCommitField={gitCommitPath}
        gitCommitFields={gitCommitFields}
        onChange={setGates}
        onGitCommitFieldChange={(path) => setGates((current) => current.map((gate) => gate.type === "git_commit_exists" ? { ...gate, path } : gate))}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={() => void save()}>
          <Save className="size-4" />
          Save emission rule
        </Button>
      </div>
      <EmissionRuleAdvancedDetails>
        <div className="grid gap-3 md:grid-cols-4">
          <Fact label="Observed task" value={operation?.name ?? refLabel(operationRef)} />
          <Fact label="Result behavior" value={policy.onGateFailure === "fail_run" ? "Fail run when a gate fails" : "Skip emission when a gate fails"} />
          <Fact label="Priority" value={String(policy.priority ?? 0)} />
          <Fact label="Emitted events" value={policy.emissions.length ? policy.emissions.map((emission) => eventNameFor(data, emission.eventType)).join(", ") : "No events."} />
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Result condition</h3>
          <ConditionBuilder fields={conditionFields} value={condition} rootLabel={conditionRoot === "/output/result" ? "Result field" : "Output field"} onChange={setCondition} />
        </div>
        <ReferenceList title="Technical gates" items={gates.map(gateDescription)} emptyLabel="No technical gates are required before publishing." />
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
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => void saveAdvanced()}><Save className="size-4" />Save advanced details</Button>
        </div>
        <EmissionDryRunPanel policy={policy} operation={operation} inputContract={inputContract} outputContract={outputContract} />
      </EmissionRuleAdvancedDetails>
    </SimpleEmissionRuleEditor>
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
