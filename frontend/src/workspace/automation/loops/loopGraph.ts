import type { LoopVisualStep } from "./loopVisualProjection";

export type LoopOutputTarget =
  {
    outputId: string;
    eventType: string;
    type: "step";
    targetLoopId: string;
    targetStepKey: string;
  };

export type LoopStepRecord = {
  stepKey: string;
  index: number;
  loopId?: string;
  step?: LoopVisualStep;
  outputTargets?: LoopOutputTarget[];
};

export type LoopStepFold = {
  stepKey: string;
  canonicalRecord: LoopStepRecord;
  records: LoopStepRecord[];
};

export type LoopStepFoldModel = {
  canonicalIndexByRecordIndex: Map<number, number>;
  canonicalRecordByIndex: Map<number, LoopStepRecord>;
  recordsByCanonicalIndex: Map<number, LoopStepRecord[]>;
  folds: LoopStepFold[];
};

export type LoopGraph = {
  stepFoldModel: LoopStepFoldModel;
  childRecordsByParentEvent: Map<string, LoopStepRecord[]>;
  eventHandlerRecordsByEvent: Map<string, LoopStepRecord[]>;
  rootRecords: LoopStepRecord[];
};

export const loopCanonicalRecord = (loopGraph: LoopGraph, record: LoopStepRecord): LoopStepRecord =>
  loopGraph.stepFoldModel.canonicalRecordByIndex.get(record.index) ?? record;

export const loopFoldedRecords = (loopGraph: LoopGraph, record: LoopStepRecord): LoopStepRecord[] =>
  loopGraph.stepFoldModel.recordsByCanonicalIndex.get(loopCanonicalRecord(loopGraph, record).index) ?? [record];

export const loopFoldedOutputTargets = (loopGraph: LoopGraph, record: LoopStepRecord): LoopOutputTarget[] => {
  const targetsByKey = new Map<string, LoopOutputTarget>();
  loopFoldedRecords(loopGraph, record).forEach((foldedRecord) => {
    const outputTargets = foldedRecord.outputTargets ?? [];

    outputTargets.forEach((output) => {
      const key = `${output.outputId}:${output.eventType}:${output.type}`;
      if (!targetsByKey.has(key)) targetsByKey.set(key, output);
    });
  });

  return [...targetsByKey.values()];
};

export const buildLoopGraph = (loopStepRecords: LoopStepRecord[]): LoopGraph => {
  const stepFoldModel = buildLoopStepFoldModel(loopStepRecords);
  const childRecordsByParentEvent = new Map<string, LoopStepRecord[]>();
  const eventHandlerRecordsByEvent = new Map<string, LoopStepRecord[]>();
  const childRecordIndexes = new Set<number>();

  loopStepRecords.forEach((record) => {
    record.outputTargets?.forEach((target) => {
      if (target.type !== "step" || target.targetLoopId !== record.loopId) return;
      const childRecord = loopStepRecords.find((candidate) => candidate.stepKey === target.targetStepKey);
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
    stepFoldModel,
    childRecordsByParentEvent,
    eventHandlerRecordsByEvent,
    rootRecords: rootRecords.length > 0 ? rootRecords : loopStepRecords.slice(0, 1)
  };
};

function buildLoopStepFoldModel(loopStepRecords: LoopStepRecord[]): LoopStepFoldModel {
  const recordsByStepKey = new Map<string, LoopStepRecord[]>();

  loopStepRecords.forEach((record) => {
    const stepKey = record.stepKey;
    if (!stepKey) return;
    recordsByStepKey.set(stepKey, [...(recordsByStepKey.get(stepKey) ?? []), record]);
  });

  const canonicalIndexByRecordIndex = new Map<number, number>();
  const canonicalRecordByIndex = new Map<number, LoopStepRecord>();
  const recordsByCanonicalIndex = new Map<number, LoopStepRecord[]>();
  const folds: LoopStepFold[] = [];

  loopStepRecords.forEach((record) => {
    canonicalIndexByRecordIndex.set(record.index, record.index);
    canonicalRecordByIndex.set(record.index, record);
    recordsByCanonicalIndex.set(record.index, [record]);
  });

  recordsByStepKey.forEach((records, stepKey) => {
    const canonicalRecord = records[0];
    if (!canonicalRecord) return;
    folds.push({ stepKey, canonicalRecord, records });
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
