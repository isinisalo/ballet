import { useEffect, useState, type ReactNode } from "react";
import type { AppData } from "backend/shared/domain";
import type { FlowSettingsUpdateDraft, FlowViewModel } from "backend/shared/flow";
import { Button, TechnicalDetails, TextAreaField, TextField } from "@/components/forms/FormControls";
import { cn } from "@/lib/utils";
import {
  conditionSummary,
  fieldsFromSchema,
  isRecord,
  mappingRows,
  mappingSummary,
  optionalPositiveWholeNumberFromInput,
  resultFieldsFromSchema,
  titleFromKey,
  valueLabel,
  wholeNumberFromInput
} from "@/features/flows/model/flow-page-model";

type FlowEventNode = Extract<FlowViewModel["nodes"][number], { kind: "event" }>;
type FlowOperationNode = Extract<FlowViewModel["nodes"][number], { kind: "operation" }>;
type FlowRoutingEdge = Extract<FlowViewModel["edges"][number], { kind: "routing" }>;
type FlowEmissionEdge = Extract<FlowViewModel["edges"][number], { kind: "emission" }>;

function InspectorPanel({
  eyebrow,
  title,
  description,
  children,
  technical
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  technical?: unknown;
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="grid gap-1">
        <div className="text-xs font-semibold uppercase text-muted-foreground">{eyebrow}</div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
      {technical ? (
        <TechnicalDetails>
          <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(technical, null, 2)}</pre>
        </TechnicalDetails>
      ) : null}
    </div>
  );
}

export function EventInspector({
  event,
  definition,
  data
}: {
  event: FlowEventNode;
  definition?: AppData["eventDefinitions"][number];
  data: AppData;
}) {
  const contract = definition?.dataContract
    ? data.contracts.find((item) => item.id === definition.dataContract?.id && item.version === definition.dataContract?.version)
    : undefined;
  const fields = fieldsFromSchema(contract?.schema);
  const example = definition?.examples?.[0];
  return (
    <InspectorPanel eyebrow="Trigger inspector" title="When this happens" description={event.description} technical={{ event, definition }}>
      <PlainFact label="Event" value={event.name} />
      <FieldList title="Trigger data" fields={fields} empty="No trigger data fields are defined." />
      {isRecord(example) ? <ExampleList title="Example data" example={example} /> : null}
    </InspectorPanel>
  );
}

export function OperationInspector({
  data,
  operationNode,
  operation
}: {
  data: AppData;
  operationNode: FlowOperationNode;
  operation?: AppData["operations"][number];
}) {
  const agent = data.agents.find((item) => item.id === operationNode.agentId);
  const inputContract = data.contracts.find((item) => item.id === operationNode.inputContract.id && item.version === operationNode.inputContract.version);
  const outputContract = data.contracts.find((item) => item.id === operationNode.outputContract.id && item.version === operationNode.outputContract.version);
  return (
    <InspectorPanel eyebrow="Operation inspector" title="Ask this agent" description={operationNode.description} technical={{ operationNode, operation }}>
      <div className="grid gap-2 md:grid-cols-2">
        <PlainFact label="Agent" value={operationNode.agentName ?? agent?.name ?? operationNode.agentId} />
        <PlainFact label="Task" value={operationNode.name} />
      </div>
      {operation?.instructions ? <PlainFact label="Task instructions" value={operation.instructions} /> : null}
      <FieldList title="Required input fields" fields={fieldsFromSchema(inputContract?.schema)} empty="No required input fields are defined." />
      <FieldList title="Possible output fields" fields={resultFieldsFromSchema(outputContract?.schema)} empty="No result fields are defined." />
      <PlainFact label="Successful result continues the Flow" value={operation?.emissionRequired ? "Yes" : "No"} />
    </InspectorPanel>
  );
}

export function RoutingInspector({
  edge,
  policy,
  source,
  target
}: {
  edge: FlowRoutingEdge;
  policy?: AppData["policies"][number];
  source?: FlowViewModel["nodes"][number];
  target?: FlowViewModel["nodes"][number];
}) {
  return (
    <InspectorPanel eyebrow="Routing inspector" title="Give the agent" description={policy?.description ?? edge.policyName} technical={{ edge, policy }}>
      <div className="grid gap-2 md:grid-cols-2">
        <PlainFact label="Source trigger" value={source?.kind === "event" ? source.name : "Unknown trigger"} />
        <PlainFact label="Target task" value={target?.kind === "operation" ? target.name : "Unknown task"} />
      </div>
      <PlainFact label="Condition" value={conditionSummary(policy?.when)} />
      <MappingList title="Field mappings" rows={mappingRows(policy?.input)} />
      <div className="grid gap-2 md:grid-cols-2">
        <PlainFact label="Branch behavior" value={policy?.selection?.mode === "exclusive" ? "First matching task only" : "Fan out to all matching tasks"} />
        <PlainFact label="Invalid input behavior" value={policy?.onInvalidInput === "reject-event" ? "Reject the event" : "Skip this task"} />
      </div>
    </InspectorPanel>
  );
}

export function EmissionInspector({
  edge,
  policy,
  source,
  target
}: {
  edge: FlowEmissionEdge;
  policy?: AppData["emissionPolicies"][number];
  source?: FlowViewModel["nodes"][number];
  target?: FlowViewModel["nodes"][number];
}) {
  const emission = policy?.emissions.find((item) => item.slot === edge.slot) ?? policy?.emissions[0];
  return (
    <InspectorPanel eyebrow="Result inspector" title="When completed" description={policy?.description ?? edge.policyName} technical={{ edge, policy }}>
      <div className="grid gap-2 md:grid-cols-2">
        <PlainFact label="Observed task" value={source?.kind === "operation" ? source.name : "Unknown task"} />
        <PlainFact label="Published event" value={target?.kind === "event" ? target.name : emission?.eventType ?? "Configured event"} />
      </div>
      <PlainFact label="When" value={conditionSummary(policy?.when)} />
      <PlainFact label="Technical checks" value={policy?.gates?.length ? `${policy.gates.length} check${policy.gates.length === 1 ? "" : "s"} required` : "No extra checks"} />
      <PlainFact label="Subject source" value={mappingSummary(emission?.subject)} />
      <MappingList title="Event field mappings" rows={mappingRows(emission?.data)} />
      <PlainFact label="Gate failure behavior" value={policy?.onGateFailure === "fail_run" ? "Fail the run" : "Skip publishing"} />
    </InspectorPanel>
  );
}

export function FlowSettingsInspector({
  data,
  flow,
  onSave
}: {
  data: AppData;
  flow: FlowViewModel;
  onSave: (flow: FlowViewModel, draft: FlowSettingsUpdateDraft) => Promise<void>;
}) {
  const loop = data.loopDefinitions.find((item) => item.id === flow.id && item.version === flow.version);
  const limitExceededEvent = loop?.onLimitExceeded?.eventType
    ? data.eventDefinitions.find((event) => event.eventType === loop.onLimitExceeded?.eventType)
    : undefined;
  const limitExceededName = limitExceededEvent?.name ?? loop?.onLimitExceeded?.eventType;
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description);
  const [maxHops, setMaxHops] = useState(String(flow.safetyLimits.maxHops));
  const [maxRuns, setMaxRuns] = useState(String(flow.safetyLimits.maxRuns));
  const [maxIterationsPerStep, setMaxIterationsPerStep] = useState(String(flow.safetyLimits.maxIterationsPerStep));
  const [deadlineSeconds, setDeadlineSeconds] = useState(flow.safetyLimits.deadlineSeconds ? String(flow.safetyLimits.deadlineSeconds) : "");
  const [limitExceededBehavior, setLimitExceededBehavior] = useState<"publish" | "stop">(limitExceededName ? "publish" : "stop");
  const [limitExceededEventName, setLimitExceededEventName] = useState(limitExceededEvent?.name ?? "");
  const [limitExceededEventDescription, setLimitExceededEventDescription] = useState(limitExceededEvent?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(flow.name);
    setDescription(flow.description);
    setMaxHops(String(flow.safetyLimits.maxHops));
    setMaxRuns(String(flow.safetyLimits.maxRuns));
    setMaxIterationsPerStep(String(flow.safetyLimits.maxIterationsPerStep));
    setDeadlineSeconds(flow.safetyLimits.deadlineSeconds ? String(flow.safetyLimits.deadlineSeconds) : "");
    setLimitExceededBehavior(limitExceededName ? "publish" : "stop");
    setLimitExceededEventName(limitExceededEvent?.name ?? "");
    setLimitExceededEventDescription(limitExceededEvent?.description ?? "");
    setMessage("");
  }, [
    flow.id,
    flow.version,
    flow.name,
    flow.description,
    flow.safetyLimits.maxHops,
    flow.safetyLimits.maxRuns,
    flow.safetyLimits.maxIterationsPerStep,
    flow.safetyLimits.deadlineSeconds,
    limitExceededName,
    limitExceededEvent?.name,
    limitExceededEvent?.description
  ]);

  const saveSettings = async () => {
    if (!loop) return;
    setSaving(true);
    setMessage("");
    try {
      const draftDeadlineSeconds = optionalPositiveWholeNumberFromInput(deadlineSeconds);
      await onSave(flow, {
        name,
        description,
        safetyLimits: {
          maxHops: wholeNumberFromInput(maxHops, loop.limits.maxHops),
          maxRuns: wholeNumberFromInput(maxRuns, loop.limits.maxRuns),
          maxIterationsPerStep: wholeNumberFromInput(maxIterationsPerStep, loop.limits.maxIterationsPerStep),
          ...(draftDeadlineSeconds !== undefined ? { deadlineSeconds: draftDeadlineSeconds } : {})
        },
        limitExceeded: limitExceededBehavior === "publish"
          ? {
              enabled: true,
              name: limitExceededEventName.trim() || `${name || flow.name} limit exceeded`,
              description: limitExceededEventDescription.trim() || `Published when ${name || flow.name} stops because a safety limit is exceeded.`
            }
          : { enabled: false }
      });
      setMessage("Flow settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save Flow settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InspectorPanel eyebrow="Flow settings" title={flow.name} description={flow.description} technical={{ flow, loop }}>
      {message ? <div role={message === "Flow settings saved." ? "status" : "alert"} className={cn("rounded-md border p-3 text-sm", message === "Flow settings saved." ? "bg-muted/20 text-muted-foreground" : "border-destructive bg-destructive/10 text-destructive")}>{message}</div> : null}
      <div className="grid gap-2 md:grid-cols-2">
        <PlainFact label="State" value={flow.active ? "Active" : "Draft"} />
        <PlainFact label="Entry triggers" value={flow.entryEvents.map((event) => event.name).join(", ") || "None"} />
        <PlainFact label="Successful terminal outcomes" value={flow.terminalEvents.map((event) => event.name).join(", ") || "None"} />
        <PlainFact label="Aborted terminal outcomes" value={limitExceededName ?? "No aborted outcome event configured"} />
        <PlainFact label="Limit-exceeded behavior" value={limitExceededName ? `Publish ${limitExceededName}` : "Stop the Flow"} />
      </div>
      {loop ? (
        <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Flow name" value={name} onChange={setName} />
            <TextAreaField label="Flow description" value={description} onChange={setDescription} rows={2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Maximum steps" value={maxHops} onChange={setMaxHops} type="number" />
            <TextField label="Maximum agent runs" value={maxRuns} onChange={setMaxRuns} type="number" />
            <TextField label="Maximum repetitions of one step" value={maxIterationsPerStep} onChange={setMaxIterationsPerStep} type="number" />
            <TextField label="Maximum duration" value={deadlineSeconds} onChange={setDeadlineSeconds} type="number" placeholder="No deadline" />
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="flow-settings-limit-exceeded-behavior">Limit-exceeded behavior</label>
              <select
                id="flow-settings-limit-exceeded-behavior"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={limitExceededBehavior}
                onChange={(event) => setLimitExceededBehavior(event.target.value === "publish" ? "publish" : "stop")}
              >
                <option value="publish">Publish an aborted outcome event</option>
                <option value="stop">Stop without publishing an event</option>
              </select>
            </div>
            {limitExceededBehavior === "publish" ? (
              <>
                <TextField label="Limit-exceeded event" value={limitExceededEventName} onChange={setLimitExceededEventName} placeholder={`${name || flow.name} limit exceeded`} />
                <div>
                  <TextAreaField
                    label="Limit-exceeded event description"
                    value={limitExceededEventDescription}
                    onChange={setLimitExceededEventDescription}
                    rows={2}
                    placeholder={`Published when ${name || flow.name} stops because a safety limit is exceeded.`}
                  />
                </div>
              </>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => void saveSettings()} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Ungrouped components do not have Flow settings until they are added to a Flow.</p>
      )}
    </InspectorPanel>
  );
}

function PlainFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-muted/20 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="text-sm leading-6">{value || "None"}</div>
    </div>
  );
}

function FieldList({
  title,
  fields,
  empty
}: {
  title: string;
  fields: Array<{ name: string; description?: string; type: string; required: boolean }>;
  empty: string;
}) {
  return (
    <div className="grid gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {fields.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <div className="grid gap-2">
          {fields.map((field) => (
            <div key={field.name} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-muted/20 p-2 text-sm">
              <span>
                <span className="font-medium">{titleFromKey(field.name)}</span>
                {field.description ? <span className="text-muted-foreground"> · {field.description}</span> : null}
              </span>
              <span className="text-muted-foreground">{field.type}{field.required ? " · required" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MappingList({ title, rows }: { title: string; rows: Array<{ target: string; source: string }> }) {
  return (
    <div className="grid gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.target} className="grid gap-1 rounded-md border bg-muted/20 p-2 text-sm sm:grid-cols-[12rem_1fr]">
            <span className="font-medium">{row.target}</span>
            <span className="text-muted-foreground">{row.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExampleList({ title, example }: { title: string; example: Record<string, unknown> }) {
  return (
    <div className="grid gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="grid gap-2">
        {Object.entries(example).map(([key, value]) => (
          <div key={key} className="grid gap-1 rounded-md border bg-muted/20 p-2 text-sm sm:grid-cols-[12rem_1fr]">
            <span className="font-medium">{titleFromKey(key)}</span>
            <span className="text-muted-foreground">{valueLabel(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
