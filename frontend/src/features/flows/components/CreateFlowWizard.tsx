import { Plus, TestTube2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppData } from "backend/shared/domain";
import type {
  DataShapeFieldDraft,
  FlowAgentTaskDraft,
  FlowComposerResult,
  FlowCreateDraft,
  FlowResultEventDraft,
  FlowViewModel
} from "backend/shared/flow";
import { api } from "@/api";
import { DataShapeBuilder } from "@/components/data-shape-builder/DataShapeBuilder";
import { EmissionBuilder, defaultResultBranch, type EmissionEventOption, type ResultBranchDraft } from "@/components/emission-builder/EmissionBuilder";
import { Button, Section, TextAreaField, TextField } from "@/components/forms/FormControls";
import { MappingBuilder } from "@/components/mapping-builder/MappingBuilder";
import {
  defaultMappingRows,
  mappingExpressionToRows,
  mappingPaths,
  previewContextFromFields,
  previewForRow,
  rowsToMappingExpression,
  type MappingRowDraft
} from "@/components/mapping-builder/mapping-builder-model";
import { DraftTestPanel } from "@/features/flows/components/DraftTestPanel";
import { WizardStepper } from "@/features/flows/wizard/WizardStepper";
import {
  cloneDataShapeFields,
  dataShapeFieldsFromSchema,
  defaultFollowUpInputFields,
  defaultResultFields,
  defaultSafetyLimits,
  defaultTriggerFields,
  isRecord,
  optionalPositiveWholeNumberFromInput,
  wholeNumberFromInput
} from "@/features/flows/model/flow-page-model";

const resultBranchStateFromDraft = (
  draft: FlowResultEventDraft | undefined,
  fallback: Partial<ResultBranchDraft> = {}
): ResultBranchDraft => {
  const defaults = { ...defaultResultBranch(), ...fallback };
  return {
    ...defaults,
    eventId: draft?.eventId ?? defaults.eventId,
    eventName: draft?.name ?? defaults.eventName,
    eventDescription: draft?.description ?? defaults.eventDescription,
    fields: cloneDataShapeFields(draft?.fields?.length ? draft.fields : defaults.fields),
    subjectField: draft?.subjectField ?? defaults.subjectField,
    requireSummaryGate: draft?.requireSummaryGate ?? defaults.requireSummaryGate,
    onGateFailure: draft?.onGateFailure ?? defaults.onGateFailure
  };
};

interface FollowUpTaskState {
  taskName: string;
  agentId: string;
  instructions: string;
  inputFields: DataShapeFieldDraft[];
  resultFields: DataShapeFieldDraft[];
  mappingRows: MappingRowDraft[];
  branch: ResultBranchDraft;
}

const defaultFollowUpAgentId = (data: AppData, index: number): string =>
  data.agents[index + 1]?.id ?? data.agents[0]?.id ?? "";

const defaultFollowUpTaskName = (index: number): string =>
  index === 0 ? "Review result" : `Follow-up task ${index + 1}`;

const followUpBranchStateFromDraft = (draft: FlowResultEventDraft | undefined): ResultBranchDraft =>
  resultBranchStateFromDraft(draft, {
    eventName: "Flow completed",
    eventDescription: "Published when the follow-up task completes.",
    subjectField: "summary"
  });

const followUpTaskStateFromDraft = (
  task: FlowAgentTaskDraft | undefined,
  data: AppData,
  index: number
): FollowUpTaskState => ({
  taskName: task?.name ?? "",
  agentId: task?.agentId ?? defaultFollowUpAgentId(data, index),
  instructions: task?.instructions ?? "",
  inputFields: cloneDataShapeFields(task?.inputFields?.length ? task.inputFields : defaultFollowUpInputFields),
  resultFields: cloneDataShapeFields(task?.resultFields?.length ? task.resultFields : defaultResultFields),
  mappingRows: mappingExpressionToRows(task?.inputMapping),
  branch: followUpBranchStateFromDraft(task?.resultEvent)
});

type VersionedRef = { id: string; version: number };

const contractForRef = (data: AppData, ref: VersionedRef | undefined) =>
  ref ? data.contracts.find((contract) => contract.id === ref.id && contract.version === ref.version) : undefined;

const schemaProperties = (schema: unknown): Record<string, unknown> =>
  isRecord(schema) && isRecord(schema.properties) ? schema.properties : {};

const latestOperationForId = (data: AppData, id: string) =>
  data.operations.filter((operation) => operation.id === id).sort((left, right) => right.version - left.version)[0];

const latestOperationOptions = (data: AppData) =>
  [...new Map(
    data.operations
      .filter((operation) => operation.active)
      .sort((left, right) => right.version - left.version)
      .map((operation) => [operation.id, operation])
  ).values()].sort((left, right) => left.name.localeCompare(right.name));

const fieldsForEvent = (data: AppData, eventId: string): DataShapeFieldDraft[] => {
  const event = data.eventDefinitions.find((item) => item.id === eventId);
  return dataShapeFieldsFromSchema(contractForRef(data, event?.dataContract)?.schema);
};

const eventOptionsForPublishing = (data: AppData): EmissionEventOption[] =>
  data.eventDefinitions
    .filter((event) => event.active)
    .map((event) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      fields: fieldsForEvent(data, event.id)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

const inputFieldsForOperation = (data: AppData, operationId: string): DataShapeFieldDraft[] => {
  const operation = latestOperationForId(data, operationId);
  return dataShapeFieldsFromSchema(contractForRef(data, operation?.inputContract)?.schema);
};

const resultFieldsForOperation = (data: AppData, operationId: string): DataShapeFieldDraft[] => {
  const operation = latestOperationForId(data, operationId);
  const outputContract = contractForRef(data, operation?.outputContract);
  return dataShapeFieldsFromSchema(schemaProperties(outputContract?.schema).result);
};

const mappableSubjectField = (fields: DataShapeFieldDraft[], preferred: string) =>
  fields.find((field) => field.name === preferred && (field.type === "text" || field.type === "number" || field.type === "boolean"))?.name
    ?? fields.find((field) => field.type === "text" || field.type === "number" || field.type === "boolean")?.name
    ?? preferred;

function OperationInputPreview({
  title = "Live operation input preview",
  sourceFields,
  targetFields,
  rows
}: {
  title?: string;
  sourceFields: DataShapeFieldDraft[];
  targetFields: DataShapeFieldDraft[];
  rows: MappingRowDraft[];
}) {
  const paths = mappingPaths();
  const context = previewContextFromFields(sourceFields, paths);
  const previewRows = defaultMappingRows(targetFields, rows).map((row) => {
    const target = targetFields.find((field) => field.name === row.target);
    return {
      row,
      label: target?.label || target?.name || row.target,
      preview: previewForRow(row, context, paths)
    };
  });

  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="grid gap-2">
        {previewRows.map(({ row, label, preview }) => (
          <div key={row.target} className="grid gap-1 text-sm sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
            <div className="font-medium">{label}</div>
            <div className={preview.ok ? "break-words text-muted-foreground" : "break-words text-destructive"}>
              {preview.ok ? preview.value : preview.error}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CreateFlowWizard({
  data,
  initialDraft,
  onCancel,
  onCreated
}: {
  data: AppData;
  initialDraft?: FlowCreateDraft;
  onCancel: () => void;
  onCreated: (flow: FlowViewModel) => void;
}) {
  const editing = Boolean(initialDraft?.id);
  const initialAgentTask = initialDraft?.agentTask;
  const initialTriggerFields = initialDraft?.trigger?.fields?.length
    ? initialDraft.trigger.fields
    : initialDraft?.trigger?.eventId
      ? fieldsForEvent(data, initialDraft.trigger.eventId)
      : defaultTriggerFields;
  const initialOperationResultFields = initialAgentTask?.operationId ? resultFieldsForOperation(data, initialAgentTask.operationId) : [];
  const initialResultBranch = () => resultBranchStateFromDraft(initialDraft?.resultEvent ?? initialAgentTask?.resultEvent);
  const [name, setName] = useState(() => initialDraft?.name ?? "");
  const [purpose, setPurpose] = useState(() => initialDraft?.purpose ?? "");
  const [description, setDescription] = useState(() => initialDraft?.description ?? "");
  const [triggerEventId, setTriggerEventId] = useState(() => initialDraft?.trigger?.eventId ?? "");
  const [triggerFields, setTriggerFields] = useState<DataShapeFieldDraft[]>(() =>
    cloneDataShapeFields(initialTriggerFields.length ? initialTriggerFields : defaultTriggerFields)
  );
  const [operationId, setOperationId] = useState(() => initialAgentTask?.operationId ?? "");
  const [taskName, setTaskName] = useState(() => initialAgentTask?.name ?? "");
  const [agentId, setAgentId] = useState(() => initialAgentTask?.agentId ?? data.agents[0]?.id ?? "");
  const [instructions, setInstructions] = useState(() => initialAgentTask?.instructions ?? "");
  const [resultFields, setResultFields] = useState<DataShapeFieldDraft[]>(() =>
    cloneDataShapeFields(initialAgentTask?.resultFields?.length ? initialAgentTask.resultFields : initialOperationResultFields.length ? initialOperationResultFields : defaultResultFields)
  );
  const [mappingRows, setMappingRows] = useState<MappingRowDraft[]>(() =>
    mappingExpressionToRows(initialDraft?.inputMapping ?? initialAgentTask?.inputMapping)
  );
  const [branch, setBranch] = useState<ResultBranchDraft>(initialResultBranch);
  const [followUpTasks, setFollowUpTasks] = useState<FollowUpTaskState[]>(() =>
    initialDraft?.followUpTasks?.map((task, index) => followUpTaskStateFromDraft(task, data, index)) ?? []
  );
  const [maxHops, setMaxHops] = useState(() => String(initialDraft?.safetyLimits?.maxHops ?? defaultSafetyLimits.maxHops));
  const [maxRuns, setMaxRuns] = useState(() => String(initialDraft?.safetyLimits?.maxRuns ?? defaultSafetyLimits.maxRuns));
  const [maxIterationsPerStep, setMaxIterationsPerStep] = useState(() => String(initialDraft?.safetyLimits?.maxIterationsPerStep ?? defaultSafetyLimits.maxIterationsPerStep));
  const [deadlineSeconds, setDeadlineSeconds] = useState(() =>
    initialDraft
      ? initialDraft.safetyLimits?.deadlineSeconds === undefined ? "" : String(initialDraft.safetyLimits.deadlineSeconds)
      : defaultSafetyLimits.deadlineSeconds
  );
  const [limitExceededBehavior, setLimitExceededBehavior] = useState<"publish" | "stop">(() => initialDraft?.limitExceeded?.enabled === false ? "stop" : "publish");
  const [limitExceededEventName, setLimitExceededEventName] = useState(() => initialDraft?.limitExceeded?.name ?? "");
  const [limitExceededEventDescription, setLimitExceededEventDescription] = useState(() => initialDraft?.limitExceeded?.description ?? "");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState<FlowComposerResult | undefined>();
  const triggerOptions = useMemo(
    () => data.eventDefinitions.filter((event) => event.active).sort((left, right) => left.name.localeCompare(right.name)),
    [data.eventDefinitions]
  );
  const operationOptions = useMemo(() => latestOperationOptions(data), [data]);
  const eventOptions = useMemo(() => eventOptionsForPublishing(data), [data]);
  const selectedOperationInputFields = useMemo(
    () => operationId ? inputFieldsForOperation(data, operationId) : [],
    [data, operationId]
  );
  const taskInputFields = operationId && selectedOperationInputFields.length
    ? selectedOperationInputFields
    : triggerFields;
  const taskResultFields = resultFields;
  const branchSubjectField = mappableSubjectField(taskInputFields, branch.subjectField);

  useEffect(() => {
    if (!agentId && data.agents[0]) setAgentId(data.agents[0].id);
    if (!data.agents[0]) return;
    setFollowUpTasks((tasks) => {
      let changed = false;
      const nextTasks = tasks.map((task, index) => {
        if (task.agentId) return task;
        changed = true;
        return { ...task, agentId: defaultFollowUpAgentId(data, index) };
      });
      return changed ? nextTasks : tasks;
    });
  }, [agentId, data]);

  const chooseTriggerEvent = (eventId: string) => {
    setTriggerEventId(eventId);
    setMappingRows([]);
    if (!eventId) return;
    const fields = fieldsForEvent(data, eventId);
    if (fields.length) setTriggerFields(cloneDataShapeFields(fields));
  };

  const chooseOperation = (nextOperationId: string) => {
    setOperationId(nextOperationId);
    setMappingRows([]);
    if (!nextOperationId) return;
    const operation = latestOperationForId(data, nextOperationId);
    if (!operation) return;
    setAgentId(operation.agentId);
    setTaskName(operation.name);
    setInstructions(operation.instructions);
    const operationResultFields = resultFieldsForOperation(data, nextOperationId);
    if (operationResultFields.length) setResultFields(cloneDataShapeFields(operationResultFields));
    const nextInputFields = inputFieldsForOperation(data, nextOperationId);
    setBranch((current) => ({
      ...current,
      subjectField: mappableSubjectField(nextInputFields.length ? nextInputFields : triggerFields, current.subjectField)
    }));
  };

  const updateFollowUpTask = (index: number, update: (task: FollowUpTaskState) => FollowUpTaskState) => {
    setFollowUpTasks((tasks) => tasks.map((task, taskIndex) => taskIndex === index ? update(task) : task));
  };

  const addFollowUpTask = () => {
    setFollowUpTasks((tasks) => [...tasks, followUpTaskStateFromDraft(undefined, data, tasks.length)]);
  };

  const removeFollowUpTask = (index: number) => {
    setFollowUpTasks((tasks) => tasks.filter((_, taskIndex) => taskIndex !== index));
  };

  const draftDeadlineSeconds = optionalPositiveWholeNumberFromInput(deadlineSeconds);
  const draft: FlowCreateDraft = {
    ...(initialDraft?.id ? { id: initialDraft.id } : {}),
    name,
    purpose,
    description,
    trigger: {
      ...(triggerEventId ? { eventId: triggerEventId } : {}),
      name: `${name || "Flow"} started`,
      description: "Starts the Flow.",
      fields: triggerFields
    },
    agentTask: operationId
      ? {
          operationId,
          agentId,
          name: taskName || name,
          instructions: instructions || purpose,
          inputFields: taskInputFields,
          resultFields: taskResultFields
        }
      : {
          agentId,
          name: taskName || name,
          instructions: instructions || purpose,
          inputFields: taskInputFields,
          resultFields: taskResultFields
        },
    inputMapping: rowsToMappingExpression(mappingRows.length ? mappingRows : taskInputFields.map((field) => ({ target: field.name, sourceKind: field.name === "subject" ? "trigger-subject" : "trigger-field", sourceField: field.name }))),
    resultEvent: {
      ...(branch.eventId ? { eventId: branch.eventId } : {}),
      name: branch.eventName,
      description: branch.eventDescription,
      fields: branch.fields,
      subjectField: branchSubjectField,
      requireSummaryGate: branch.requireSummaryGate,
      onGateFailure: branch.onGateFailure
    },
    followUpTasks: followUpTasks.length ? followUpTasks.map((task, index) => ({
      agentId: task.agentId || agentId,
      name: task.taskName || defaultFollowUpTaskName(index),
      instructions: task.instructions || "Review the previous task result and decide the next outcome.",
      inputFields: task.inputFields,
      resultFields: task.resultFields,
      inputMapping: rowsToMappingExpression(task.mappingRows.length ? task.mappingRows : task.inputFields.map((field) => ({ target: field.name, sourceKind: "trigger-field", sourceField: field.name }))),
      resultEvent: {
        ...(task.branch.eventId ? { eventId: task.branch.eventId } : {}),
        name: task.branch.eventName,
        description: task.branch.eventDescription,
        fields: task.branch.fields,
        subjectField: task.branch.subjectField,
        requireSummaryGate: task.branch.requireSummaryGate,
        onGateFailure: task.branch.onGateFailure
      }
    })) : undefined,
    safetyLimits: {
      maxHops: wholeNumberFromInput(maxHops, 20),
      maxRuns: wholeNumberFromInput(maxRuns, 20),
      maxIterationsPerStep: wholeNumberFromInput(maxIterationsPerStep, 3),
      ...(draftDeadlineSeconds !== undefined ? { deadlineSeconds: draftDeadlineSeconds } : {})
    },
    limitExceeded: limitExceededBehavior === "publish"
      ? {
          enabled: true,
          name: limitExceededEventName.trim() || `${name || "Flow"} limit exceeded`,
          description: limitExceededEventDescription.trim() || `Published when ${name || "this Flow"} stops because a safety limit is exceeded.`
        }
      : { enabled: false },
    active: false
  };

  const submit = async () => {
    setError("");
    try {
      if (!name.trim()) throw new Error("Flow name is required.");
      if (!purpose.trim()) throw new Error("Purpose is required.");
      if (!operationId && !agentId) throw new Error("Choose an agent.");
      const flow = await api.createFlow(draft);
      onCreated(flow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create Flow.");
    }
  };

  const test = async () => {
    setError("");
    try {
      const result = await api.validateFlow(draft);
      setTesting(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to test Flow.");
    }
  };

  return (
    <div data-testid="create-flow-wizard">
      <Section title={editing ? "Edit Flow" : "Create Flow"} description="Create a representative Flow with guided fields, mappings, and result behavior." className="border-white/10 bg-card/80">
        {error ? <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
        <div className="grid gap-5">
          <WizardStepper steps={["Intent", "Trigger", "Agent", "Mapping", "Results", "Safety"]} current={testing ? 5 : branch.eventName ? 4 : mappingRows.length ? 3 : taskName || operationId ? 2 : triggerFields.length ? 1 : 0} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Flow name" value={name} onChange={setName} required />
              <TextAreaField label="Purpose" value={purpose} onChange={setPurpose} rows={2} required />
              <div className="md:col-span-2">
                <TextAreaField label="Description" value={description} onChange={setDescription} rows={2} />
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-[0.68rem] font-semibold uppercase text-cyan-200">Visual preview</div>
              <div className="mt-3 grid gap-2 font-mono text-xs">
                <PreviewStep label="EVENT" value={name ? `${name} started` : "New trigger"} />
                <PreviewStep label="ROUTE" value={`${taskInputFields.length} mapped field${taskInputFields.length === 1 ? "" : "s"}`} />
                <PreviewStep label="AGENT" value={taskName || data.agents.find((agent) => agent.id === agentId)?.name || "Agent task"} />
                <PreviewStep label="EMIT" value={branch.eventName || "Completed"} />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="flow-trigger-source">Trigger</label>
            <select
              id="flow-trigger-source"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={triggerEventId}
              onChange={(event) => chooseTriggerEvent(event.target.value)}
            >
              <option value="">Create a new trigger</option>
              {triggerOptions.map((event) => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>
          <DataShapeBuilder title="Trigger data" fields={triggerFields} onChange={setTriggerFields} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="flow-operation-source">Agent task</label>
              <select
                id="flow-operation-source"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={operationId}
                onChange={(event) => chooseOperation(event.target.value)}
              >
                <option value="">Create a new task</option>
                {operationOptions.map((operation) => (
                  <option key={`${operation.id}@${operation.version}`} value={operation.id}>
                    {operation.name} v{operation.version}
                  </option>
                ))}
              </select>
            </div>
            <TextField label="Task name" value={taskName} onChange={setTaskName} />
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="flow-agent">Agent</label>
              <select id="flow-agent" className="h-10 rounded-md border bg-background px-3 text-sm" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                {data.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <TextAreaField label="Task instructions" value={instructions} onChange={setInstructions} rows={3} />
            </div>
          </div>
          <DataShapeBuilder title="Task result fields" fields={taskResultFields} onChange={setResultFields} />
          <MappingBuilder sourceFields={triggerFields} targetFields={taskInputFields} rows={mappingRows} onChange={setMappingRows} />
          <OperationInputPreview sourceFields={triggerFields} targetFields={taskInputFields} rows={mappingRows} />
          <EmissionBuilder branch={{ ...branch, subjectField: branchSubjectField }} eventOptions={eventOptions} inputFields={taskInputFields} resultFields={taskResultFields} onChange={setBranch} />
          <div className="grid gap-4 rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <h3 className="text-sm font-medium">Next agent tasks</h3>
                <p className="text-sm leading-6 text-muted-foreground">Continue the Flow after the first result event without editing routing or emission resources directly.</p>
              </div>
              <Button type="button" variant="outline" onClick={addFollowUpTask}>
                <Plus className="size-4" />
                Add next agent task
              </Button>
            </div>
            {followUpTasks.map((followUpTask, index) => {
              const previousEventFields = index === 0 ? branch.fields : followUpTasks[index - 1]?.branch.fields ?? branch.fields;
              return (
                <div key={index} className="grid gap-4 rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Next task {index + 1}</h4>
                    <Button type="button" variant="outline" onClick={() => removeFollowUpTask(index)}>
                      Remove next task
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField label="Next task name" value={followUpTask.taskName} onChange={(value) => updateFollowUpTask(index, (task) => ({ ...task, taskName: value }))} />
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium" htmlFor={`flow-follow-up-agent-${index}`}>Next agent</label>
                      <select
                        id={`flow-follow-up-agent-${index}`}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={followUpTask.agentId}
                        onChange={(event) => updateFollowUpTask(index, (task) => ({ ...task, agentId: event.target.value }))}
                      >
                        {data.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <TextAreaField label="Next task instructions" value={followUpTask.instructions} onChange={(value) => updateFollowUpTask(index, (task) => ({ ...task, instructions: value }))} rows={3} />
                    </div>
                  </div>
                  <DataShapeBuilder title="Next task input" fields={followUpTask.inputFields} onChange={(fields) => updateFollowUpTask(index, (task) => ({ ...task, inputFields: fields }))} />
                  <DataShapeBuilder title="Next task result fields" fields={followUpTask.resultFields} onChange={(fields) => updateFollowUpTask(index, (task) => ({ ...task, resultFields: fields }))} />
                  <MappingBuilder
                    sourceFields={previousEventFields}
                    targetFields={followUpTask.inputFields}
                    rows={followUpTask.mappingRows}
                    onChange={(rows) => updateFollowUpTask(index, (task) => ({ ...task, mappingRows: rows }))}
                    labels={{ title: "Next input mapping", sourceField: "Previous event data field" }}
                  />
                  <OperationInputPreview title="Live next task input preview" sourceFields={previousEventFields} targetFields={followUpTask.inputFields} rows={followUpTask.mappingRows} />
                  <EmissionBuilder
                    branch={followUpTask.branch}
                    eventOptions={eventOptions}
                    inputFields={followUpTask.inputFields}
                    resultFields={followUpTask.resultFields}
                    onChange={(nextBranch) => updateFollowUpTask(index, (task) => ({ ...task, branch: nextBranch }))}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 rounded-md border bg-background p-3">
            <div className="grid gap-1">
              <h3 className="text-sm font-medium">Safety limits</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <TextField label="Maximum steps" value={maxHops} onChange={setMaxHops} type="number" />
              <TextField label="Maximum agent runs" value={maxRuns} onChange={setMaxRuns} type="number" />
              <TextField label="Maximum repetitions of one step" value={maxIterationsPerStep} onChange={setMaxIterationsPerStep} type="number" />
              <TextField label="Maximum duration" value={deadlineSeconds} onChange={setDeadlineSeconds} type="number" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="flow-limit-exceeded-behavior">Limit-exceeded behavior</label>
                <select
                  id="flow-limit-exceeded-behavior"
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
                  <TextField label="Limit-exceeded event" value={limitExceededEventName} onChange={setLimitExceededEventName} placeholder={`${name || "Flow"} limit exceeded`} />
                  <div className="md:col-span-2">
                    <TextAreaField
                      label="Limit-exceeded event description"
                      value={limitExceededEventDescription}
                      onChange={setLimitExceededEventDescription}
                      rows={2}
                      placeholder={`Published when ${name || "this Flow"} stops because a safety limit is exceeded.`}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
          {testing ? <DraftTestPanel result={testing} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="button" variant="outline" onClick={() => void test()}><TestTube2 className="size-4" />Test</Button>
            <Button type="button" onClick={() => void submit()}>Save Flow</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function PreviewStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-2">
      <div className="text-[0.62rem] text-muted-foreground">{label}</div>
      <div className="truncate text-slate-100">{value}</div>
    </div>
  );
}
