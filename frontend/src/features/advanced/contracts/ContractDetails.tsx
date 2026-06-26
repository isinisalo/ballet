import type { ContractDefinition } from "backend/shared/contracts";
import type { WorkspaceDiagnostic } from "backend/shared/flow";
import { Fact, FieldList, PanelHeading } from "@/features/advanced/components/AdvancedPanels";
import {
  evidenceFieldsFromOutputContract,
  fieldsFromObjectSchema,
  resultFieldsFromOutputContract
} from "@/features/advanced/model/advanced-resource-model";

export function ContractDetails({
  contract,
  diagnostics
}: {
  contract: ContractDefinition;
  diagnostics: WorkspaceDiagnostic[];
}) {
  const isAgentOutput = contract.kind === "agent-output";
  const rootFields = fieldsFromObjectSchema(contract.schema);
  const envelopeFields = rootFields.filter((field) => field.name === "status" || field.name === "summary");
  const resultFields = resultFieldsFromOutputContract(contract);
  const evidenceFields = evidenceFieldsFromOutputContract(contract);
  const visibleFields = isAgentOutput ? resultFields : rootFields;
  const exampleDiagnostics = diagnostics.filter((diagnostic) => diagnostic.title.toLowerCase().includes("example"));

  return (
    <div className="grid gap-4 rounded-md border bg-background p-3">
      <PanelHeading title="Data shape" description="Current published shape for this version. Create the next version to change fields." />
      <div className="grid gap-3 text-sm md:grid-cols-4">
        <Fact label="Kind" value={kindLabel(contract.kind)} />
        <Fact label="Root shape" value={contract.schema.type === "object" ? "Object" : "Advanced schema"} />
        <Fact label="Additional fields" value={contract.schema.additionalProperties === false ? "Blocked" : "Allowed"} />
        <Fact label="Required fields" value={requiredFields(contract).join(", ") || "None"} />
      </div>
      {isAgentOutput ? (
        <div className="grid gap-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">Protected output envelope</h3>
            <FieldList fields={envelopeFields} emptyLabel="Status and summary are required by the runtime." />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Result fields</h3>
            <FieldList fields={resultFields} emptyLabel="No business result fields are defined." />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Evidence fields</h3>
            <FieldList fields={evidenceFields} emptyLabel="No evidence fields are defined." />
          </div>
        </div>
      ) : (
        <div>
          <h3 className="mb-2 text-sm font-medium">Fields</h3>
          <FieldList fields={visibleFields} emptyLabel="This data type has no visual fields." />
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <div className="font-medium">Schema preview</div>
          <div className="mt-2 grid gap-1 text-muted-foreground">
            <div>{isAgentOutput ? "Runtime envelope with editable result and evidence objects." : `${visibleFields.length} visual fields in an object schema.`}</div>
            <div>{contract.schema.additionalProperties === false ? "Unexpected fields are rejected." : "Unexpected fields are accepted."}</div>
          </div>
        </div>
        <div className={exampleDiagnostics.length ? "rounded-md border border-destructive bg-destructive/10 p-3 text-sm" : "rounded-md border bg-muted/20 p-3 text-sm"}>
          <div className="font-medium">Example validation</div>
          <div className="mt-2 text-muted-foreground">{exampleValidationSummary(contract, exampleDiagnostics)}</div>
        </div>
      </div>
    </div>
  );
}

const kindLabel = (kind: ContractDefinition["kind"]): string => {
  if (kind === "event-data") return "Event data";
  if (kind === "agent-input") return "Agent input";
  return "Agent output";
};

const requiredFields = (contract: ContractDefinition): string[] =>
  Array.isArray(contract.schema.required) ? contract.schema.required.map(String) : [];

const exampleValidationSummary = (contract: ContractDefinition, diagnostics: WorkspaceDiagnostic[]): string => {
  if (contract.examples.length === 0) return "No examples are configured for this data shape.";
  if (diagnostics.length === 1) return diagnostics[0]?.explanation ?? "One example needs a fix.";
  if (diagnostics.length > 1) return `${diagnostics.length} examples need fixes before this data shape is ready.`;
  if (contract.examples.length === 1) return "1 example matches this data shape.";
  return `${contract.examples.length} examples match this data shape.`;
};
