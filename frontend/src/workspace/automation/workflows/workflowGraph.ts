import type { ProjectPolicy } from "@shared/api/workspace-contracts";
import { policyOutputEventTypes } from "@shared/policy-actions";

export type WorkflowOutputTarget =
  | {
      outputId: string;
      eventType: string;
      type: "event";
    }
  | {
      outputId: string;
      eventType: string;
      type: "trigger";
      trigger: string;
      workflowId?: string;
    };

export type WorkflowStepRecord = {
  policyId: string;
  index: number;
  workflowId?: string;
  policy?: ProjectPolicy;
  outputEvents?: string[];
  outputTargets?: WorkflowOutputTarget[];
};

export type WorkflowActionFold = {
  actionId: string;
  canonicalRecord: WorkflowStepRecord;
  records: WorkflowStepRecord[];
};

export type WorkflowActionFoldModel = {
  canonicalIndexByRecordIndex: Map<number, number>;
  canonicalRecordByIndex: Map<number, WorkflowStepRecord>;
  recordsByCanonicalIndex: Map<number, WorkflowStepRecord[]>;
  folds: WorkflowActionFold[];
};

export type WorkflowGraph = {
  actionFoldModel: WorkflowActionFoldModel;
  childRecordsByParentEvent: Map<string, WorkflowStepRecord[]>;
  eventHandlerRecordsByEvent: Map<string, WorkflowStepRecord[]>;
  rootRecords: WorkflowStepRecord[];
};

export const workflowTriggerLabel = (policy?: ProjectPolicy) => {
  if (!policy) return "Next trigger";
  if (policy.source === "trigger") return policy.trigger || "Missing trigger";
  return policy.event || "External event";
};

export const workflowOutputEvents = (recordOrPolicy: WorkflowStepRecord | ProjectPolicy | undefined, continuationEvent?: string) => {
  if (!recordOrPolicy) return ["Missing policy"];
  const policy = "policyId" in recordOrPolicy ? recordOrPolicy.policy : recordOrPolicy;
  if (!policy) return ["Missing policy"];
  const events = "policyId" in recordOrPolicy
    ? recordOrPolicy.outputEvents ?? recordOrPolicy.outputTargets?.map((output) => output.eventType) ?? policyOutputEventTypes(policy)
    : policyOutputEventTypes(policy);
  return continuationEvent && !events.includes(continuationEvent) ? [continuationEvent, ...events] : events;
};

export const workflowCanonicalRecord = (workflowGraph: WorkflowGraph, record: WorkflowStepRecord): WorkflowStepRecord =>
  workflowGraph.actionFoldModel.canonicalRecordByIndex.get(record.index) ?? record;

export const workflowFoldedRecords = (workflowGraph: WorkflowGraph, record: WorkflowStepRecord): WorkflowStepRecord[] =>
  workflowGraph.actionFoldModel.recordsByCanonicalIndex.get(workflowCanonicalRecord(workflowGraph, record).index) ?? [record];

export const workflowFoldedOutputTargets = (workflowGraph: WorkflowGraph, record: WorkflowStepRecord): WorkflowOutputTarget[] => {
  const targetsByKey = new Map<string, WorkflowOutputTarget>();
  workflowFoldedRecords(workflowGraph, record).forEach((foldedRecord) => {
    const outputTargets = foldedRecord.outputTargets ?? workflowOutputEvents(foldedRecord).map((eventType) => ({
      outputId: eventType,
      eventType,
      type: "event" as const
    }));

    outputTargets.forEach((output) => {
      const key = `${output.outputId}:${output.eventType}:${output.type}`;
      if (!targetsByKey.has(key)) targetsByKey.set(key, output);
    });
  });

  return [...targetsByKey.values()];
};

export const buildWorkflowGraph = (workflowStepRecords: WorkflowStepRecord[]): WorkflowGraph => {
  const actionFoldModel = buildWorkflowActionFoldModel(workflowStepRecords);
  const childRecordsByParentEvent = new Map<string, WorkflowStepRecord[]>();
  const eventHandlerRecordsByEvent = new Map<string, WorkflowStepRecord[]>();
  const childRecordIndexes = new Set<number>();

  workflowStepRecords.forEach((record) => {
    if (record.policy?.source !== "event" || !record.policy.event) return;
    eventHandlerRecordsByEvent.set(record.policy.event, [
      ...(eventHandlerRecordsByEvent.get(record.policy.event) ?? []),
      record
    ]);

    const parentRecord = workflowStepRecords
      .filter((candidate) =>
        candidate.index < record.index &&
        candidate.policy &&
        workflowOutputEvents(candidate).includes(record.policy?.event ?? "")
      )
      .at(-1);
    if (!parentRecord) return;
    const key = `${parentRecord.index}:${record.policy.event}`;
    childRecordsByParentEvent.set(key, [...(childRecordsByParentEvent.get(key) ?? []), record]);
    childRecordIndexes.add(record.index);
  });

  const rootRecords = workflowStepRecords.filter((record) => !childRecordIndexes.has(record.index));
  return {
    actionFoldModel,
    childRecordsByParentEvent,
    eventHandlerRecordsByEvent,
    rootRecords: rootRecords.length > 0 ? rootRecords : workflowStepRecords.slice(0, 1)
  };
};

function buildWorkflowActionFoldModel(workflowStepRecords: WorkflowStepRecord[]): WorkflowActionFoldModel {
  const recordsByActionId = new Map<string, WorkflowStepRecord[]>();

  workflowStepRecords.forEach((record) => {
    const actionId = record.policy?.action;
    if (!actionId) return;
    recordsByActionId.set(actionId, [...(recordsByActionId.get(actionId) ?? []), record]);
  });

  const canonicalIndexByRecordIndex = new Map<number, number>();
  const canonicalRecordByIndex = new Map<number, WorkflowStepRecord>();
  const recordsByCanonicalIndex = new Map<number, WorkflowStepRecord[]>();
  const folds: WorkflowActionFold[] = [];

  workflowStepRecords.forEach((record) => {
    canonicalIndexByRecordIndex.set(record.index, record.index);
    canonicalRecordByIndex.set(record.index, record);
    recordsByCanonicalIndex.set(record.index, [record]);
  });

  recordsByActionId.forEach((records, actionId) => {
    const canonicalRecord = records[0];
    if (!canonicalRecord) return;
    folds.push({ actionId, canonicalRecord, records });
    recordsByCanonicalIndex.set(canonicalRecord.index, records);
    records.forEach((record) => {
      canonicalIndexByRecordIndex.set(record.index, canonicalRecord.index);
      canonicalRecordByIndex.set(record.index, canonicalRecord);
      recordsByCanonicalIndex.set(record.index, records);
    });
  });

  return {
    canonicalIndexByRecordIndex,
    canonicalRecordByIndex,
    recordsByCanonicalIndex,
    folds
  };
}
