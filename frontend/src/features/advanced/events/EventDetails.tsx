import type { AppData, EventDefinition } from "backend/shared/domain";
import type { DataShapeFieldDraft, WorkspaceDiagnostic } from "backend/shared/flow";
import { Fact, FieldList, PanelHeading, ReferenceList } from "@/features/advanced/components/AdvancedPanels";
import { fieldsFromObjectSchema, findContract, isRecord } from "@/features/advanced/model/advanced-resource-model";

export function EventDetails({
  eventDefinition,
  data,
  diagnostics
}: {
  eventDefinition: EventDefinition;
  data: AppData;
  diagnostics: WorkspaceDiagnostic[];
}) {
  const contract = findContract(data, eventDefinition.dataContract);
  const fields = contract ? fieldsFromObjectSchema(contract.schema) : [];
  const example = eventDefinition.examples[0] ?? contract?.examples[0];
  const exampleSource = eventDefinition.examples[0] ? "Event example" : "Data type example";
  const exampleDiagnostics = diagnostics.filter((diagnostic) => diagnostic.title.toLowerCase().includes("example"));
  const incomingEmissions = data.emissionPolicies
    .flatMap((policy) => policy.emissions
      .filter((emission) => emission.eventType === eventDefinition.eventType)
      .map((emission) => `${policy.name} · ${emission.slot}`));
  const outgoingRouting = data.policies
    .filter((policy) => policy.consumes.eventType === eventDefinition.eventType)
    .map((policy) => policy.name);

  return (
    <div className="grid gap-4 rounded-md border bg-background p-3">
      <PanelHeading title="Event shape" description="The business data this event carries when it enters or continues a Flow." />
      <div className="grid gap-3 md:grid-cols-3">
        <Fact label="Event type" value={eventDefinition.eventType} mono />
        <Fact label="Data type" value={contract ? `${contract.name} v${contract.version}` : "No data type selected."} />
        <Fact label="Default tags" value={eventDefinition.tags.length ? eventDefinition.tags.join(", ") : "No default tags."} />
      </div>
      <FieldList fields={fields} emptyLabel="This event has no structured data fields." />
      <EventExamplePreview
        fields={fields}
        example={example}
        source={exampleSource}
        eventExampleCount={eventDefinition.examples.length}
        diagnostics={exampleDiagnostics}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <ReferenceList title="Incoming emission rules" items={incomingEmissions} emptyLabel="No emission rules publish this event." />
        <ReferenceList title="Outgoing routing rules" items={outgoingRouting} emptyLabel="No routing rules start from this event." />
      </div>
    </div>
  );
}

function EventExamplePreview({
  fields,
  example,
  source,
  eventExampleCount,
  diagnostics
}: {
  fields: DataShapeFieldDraft[];
  example: unknown;
  source: string;
  eventExampleCount: number;
  diagnostics: WorkspaceDiagnostic[];
}) {
  const exampleRecord = isRecord(example) ? example : {};

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <PanelHeading title="Example data" description="Representative event data shown with the event fields instead of raw JSON." />
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <Fact label="Example source" value={example ? source : "No example configured."} />
        <Fact label="Example validation" value={exampleValidationSummary(eventExampleCount, diagnostics)} />
      </div>
      {example ? (
        <div className="grid gap-2">
          {fields.length ? fields.map((field) => (
            <div key={field.name} className="grid gap-2 rounded-md border bg-background p-3 text-sm md:grid-cols-[1fr_1.5fr]">
              <div>
                <div className="font-medium">{field.label || field.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{field.name}</div>
              </div>
              <div>{valuePreview(exampleRecord[field.name]) || "Not provided"}</div>
            </div>
          )) : <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">This event has no fields to preview.</div>}
        </div>
      ) : null}
    </div>
  );
}

const exampleValidationSummary = (eventExampleCount: number, diagnostics: WorkspaceDiagnostic[]): string => {
  if (diagnostics.length === 1) return diagnostics[0]?.explanation ?? "One example needs a fix.";
  if (diagnostics.length > 1) return `${diagnostics.length} examples need fixes.`;
  if (eventExampleCount === 1) return "1 event example matches the data shape.";
  if (eventExampleCount > 1) return `${eventExampleCount} event examples match the data shape.`;
  return "No event examples are configured.";
};

const valuePreview = (value: unknown): string => {
  if (value === undefined) return "";
  if (value === null) return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "Empty list";
    if (value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
      return value.map(String).join(", ");
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (isRecord(value)) return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`;
  return "Configured value";
};
