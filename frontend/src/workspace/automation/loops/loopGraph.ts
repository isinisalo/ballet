import type { ProjectAction } from "@shared/api/workspace-contracts";
import { actionOutputEventTypes } from "@shared/policy-actions";

export type LoopOutputTarget =
  {
    outputId: string;
    eventType: string;
    type: "event";
  } | {
    outputId: string;
    eventType: string;
    type: "action";
    targetLoopId: string;
    targetActionId: string;
  };

export type LoopStepRecord = {
  actionId: string;
  index: number;
  loopId?: string;
  action?: ProjectAction;
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

export const loopInputEventLabel = (action: Pick<ProjectAction, "id"> | undefined): string =>
  action?.id ?? "Missing action";

export const loopOutputEvents = (recordOrAction: LoopStepRecord | ProjectAction | undefined, continuationEvent?: string) => {
  if (!recordOrAction) return ["Missing action"];
  const action = "actionId" in recordOrAction ? recordOrAction.action : recordOrAction;
  if (!action) return ["Missing action"];
  const events = "actionId" in recordOrAction
    ? recordOrAction.outputEvents ?? recordOrAction.outputTargets?.map((output) => output.eventType) ??
      actionOutputEventTypes({ loopId: recordOrAction.loopId, actionId: recordOrAction.actionId }, [action])
    : actionOutputEventTypes({ actionId: action.id }, [action]);
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
    record.outputTargets?.forEach((target) => {
      if (target.type !== "action" || target.targetLoopId !== record.loopId) return;
      const childRecord = loopStepRecords.find((candidate) => candidate.actionId === target.targetActionId);
      if (!childRecord) return;
      eventHandlerRecordsByEvent.set(target.eventType, [
        ...(eventHandlerRecordsByEvent.get(target.eventType) ?? []),
        childRecord
      ]);
      const key = `${record.index}:${target.eventType}`;
      childRecordsByParentEvent.set(key, [...(childRecordsByParentEvent.get(key) ?? []), childRecord]);
      childRecordIndexes.add(childRecord.index);
    });
  });

  const rootRecords = loopStepRecords.length > 0
    ? [loopStepRecords[0]]
    : loopStepRecords.filter((record) => !childRecordIndexes.has(record.index));
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
    const actionId = record.actionId;
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
