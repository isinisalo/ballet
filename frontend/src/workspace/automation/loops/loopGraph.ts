import type { ProjectPolicy } from "@shared/api/workspace-contracts";
import { policyOutputEventTypes } from "@shared/policy-actions";

export type LoopOutputTarget =
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
      loopId?: string;
    };

export type LoopStepRecord = {
  policyId: string;
  index: number;
  loopId?: string;
  policy?: ProjectPolicy;
  outputEvents?: string[];
  outputTargets?: LoopOutputTarget[];
};

export type LoopActionFold = {
  actionId: string;
  canonicalRecord: LoopStepRecord;
  records: LoopStepRecord[];
};

export type LoopActionFoldModel = {
  canonicalIndexByRecordIndex: Map<number, number>;
  canonicalRecordByIndex: Map<number, LoopStepRecord>;
  recordsByCanonicalIndex: Map<number, LoopStepRecord[]>;
  folds: LoopActionFold[];
};

export type LoopGraph = {
  actionFoldModel: LoopActionFoldModel;
  childRecordsByParentEvent: Map<string, LoopStepRecord[]>;
  eventHandlerRecordsByEvent: Map<string, LoopStepRecord[]>;
  rootRecords: LoopStepRecord[];
};

export const loopTriggerLabel = (policy?: ProjectPolicy) => {
  if (!policy) return "Next trigger";
  if (policy.source === "trigger") return policy.trigger || "Missing trigger";
  return policy.event || "External event";
};

export const loopOutputEvents = (recordOrPolicy: LoopStepRecord | ProjectPolicy | undefined, continuationEvent?: string) => {
  if (!recordOrPolicy) return ["Missing policy"];
  const policy = "policyId" in recordOrPolicy ? recordOrPolicy.policy : recordOrPolicy;
  if (!policy) return ["Missing policy"];
  const events = "policyId" in recordOrPolicy
    ? recordOrPolicy.outputEvents ?? recordOrPolicy.outputTargets?.map((output) => output.eventType) ?? policyOutputEventTypes(policy)
    : policyOutputEventTypes(policy);
  return continuationEvent && !events.includes(continuationEvent) ? [continuationEvent, ...events] : events;
};

export const loopCanonicalRecord = (loopGraph: LoopGraph, record: LoopStepRecord): LoopStepRecord =>
  loopGraph.actionFoldModel.canonicalRecordByIndex.get(record.index) ?? record;

export const loopFoldedRecords = (loopGraph: LoopGraph, record: LoopStepRecord): LoopStepRecord[] =>
  loopGraph.actionFoldModel.recordsByCanonicalIndex.get(loopCanonicalRecord(loopGraph, record).index) ?? [record];

export const loopFoldedOutputTargets = (loopGraph: LoopGraph, record: LoopStepRecord): LoopOutputTarget[] => {
  const targetsByKey = new Map<string, LoopOutputTarget>();
  loopFoldedRecords(loopGraph, record).forEach((foldedRecord) => {
    const outputTargets = foldedRecord.outputTargets ?? loopOutputEvents(foldedRecord).map((eventType) => ({
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

export const buildLoopGraph = (loopStepRecords: LoopStepRecord[]): LoopGraph => {
  const actionFoldModel = buildLoopActionFoldModel(loopStepRecords);
  const childRecordsByParentEvent = new Map<string, LoopStepRecord[]>();
  const eventHandlerRecordsByEvent = new Map<string, LoopStepRecord[]>();
  const childRecordIndexes = new Set<number>();

  loopStepRecords.forEach((record) => {
    if (record.policy?.source !== "event" || !record.policy.event) return;
    eventHandlerRecordsByEvent.set(record.policy.event, [
      ...(eventHandlerRecordsByEvent.get(record.policy.event) ?? []),
      record
    ]);

    const parentRecord = loopStepRecords
      .filter((candidate) =>
        candidate.index < record.index &&
        candidate.policy &&
        loopOutputEvents(candidate).includes(record.policy?.event ?? "")
      )
      .at(-1);
    if (!parentRecord) return;
    const key = `${parentRecord.index}:${record.policy.event}`;
    childRecordsByParentEvent.set(key, [...(childRecordsByParentEvent.get(key) ?? []), record]);
    childRecordIndexes.add(record.index);
  });

  const rootRecords = loopStepRecords.filter((record) => !childRecordIndexes.has(record.index));
  return {
    actionFoldModel,
    childRecordsByParentEvent,
    eventHandlerRecordsByEvent,
    rootRecords: rootRecords.length > 0 ? rootRecords : loopStepRecords.slice(0, 1)
  };
};

function buildLoopActionFoldModel(loopStepRecords: LoopStepRecord[]): LoopActionFoldModel {
  const recordsByActionId = new Map<string, LoopStepRecord[]>();

  loopStepRecords.forEach((record) => {
    const actionId = record.policy?.action;
    if (!actionId) return;
    recordsByActionId.set(actionId, [...(recordsByActionId.get(actionId) ?? []), record]);
  });

  const canonicalIndexByRecordIndex = new Map<number, number>();
  const canonicalRecordByIndex = new Map<number, LoopStepRecord>();
  const recordsByCanonicalIndex = new Map<number, LoopStepRecord[]>();
  const folds: LoopActionFold[] = [];

  loopStepRecords.forEach((record) => {
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
