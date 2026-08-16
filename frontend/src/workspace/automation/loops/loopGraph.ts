import type { LoopVisualNode } from "./loopVisualProjection";

export type LoopOutputTarget =
  {
    outputId: string;
    eventType: string;
    type: "node";
    targetLoopId: string;
    targetNodeKey: string;
  };

export type LoopNodeRecord = {
  nodeKey: string;
  index: number;
  loopId?: string;
  node?: LoopVisualNode;
  outputTargets?: LoopOutputTarget[];
};

export type LoopNodeFold = {
  nodeKey: string;
  canonicalRecord: LoopNodeRecord;
  records: LoopNodeRecord[];
};

export type LoopNodeFoldModel = {
  canonicalIndexByRecordIndex: Map<number, number>;
  canonicalRecordByIndex: Map<number, LoopNodeRecord>;
  recordsByCanonicalIndex: Map<number, LoopNodeRecord[]>;
  folds: LoopNodeFold[];
};

export type LoopGraph = {
  nodeFoldModel: LoopNodeFoldModel;
  childRecordsByParentEvent: Map<string, LoopNodeRecord[]>;
  eventHandlerRecordsByEvent: Map<string, LoopNodeRecord[]>;
  rootRecords: LoopNodeRecord[];
};

export const loopCanonicalRecord = (loopGraph: LoopGraph, record: LoopNodeRecord): LoopNodeRecord =>
  loopGraph.nodeFoldModel.canonicalRecordByIndex.get(record.index) ?? record;

export const loopFoldedRecords = (loopGraph: LoopGraph, record: LoopNodeRecord): LoopNodeRecord[] =>
  loopGraph.nodeFoldModel.recordsByCanonicalIndex.get(loopCanonicalRecord(loopGraph, record).index) ?? [record];

export const loopFoldedOutputTargets = (loopGraph: LoopGraph, record: LoopNodeRecord): LoopOutputTarget[] => {
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

export const buildLoopGraph = (loopNodeRecords: LoopNodeRecord[]): LoopGraph => {
  const nodeFoldModel = buildLoopNodeFoldModel(loopNodeRecords);
  const childRecordsByParentEvent = new Map<string, LoopNodeRecord[]>();
  const eventHandlerRecordsByEvent = new Map<string, LoopNodeRecord[]>();
  const childRecordIndexes = new Set<number>();

  loopNodeRecords.forEach((record) => {
    record.outputTargets?.forEach((target) => {
      if (target.type !== "node" || target.targetLoopId !== record.loopId) return;
      const childRecord = loopNodeRecords.find((candidate) => candidate.nodeKey === target.targetNodeKey);
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

  const rootRecords = loopNodeRecords.length > 0
    ? [loopNodeRecords[0]]
    : loopNodeRecords.filter((record) => !childRecordIndexes.has(record.index));
  return {
    nodeFoldModel,
    childRecordsByParentEvent,
    eventHandlerRecordsByEvent,
    rootRecords: rootRecords.length > 0 ? rootRecords : loopNodeRecords.slice(0, 1)
  };
};

function buildLoopNodeFoldModel(loopNodeRecords: LoopNodeRecord[]): LoopNodeFoldModel {
  const recordsByNodeKey = new Map<string, LoopNodeRecord[]>();

  loopNodeRecords.forEach((record) => {
    const nodeKey = record.nodeKey;
    if (!nodeKey) return;
    recordsByNodeKey.set(nodeKey, [...(recordsByNodeKey.get(nodeKey) ?? []), record]);
  });

  const canonicalIndexByRecordIndex = new Map<number, number>();
  const canonicalRecordByIndex = new Map<number, LoopNodeRecord>();
  const recordsByCanonicalIndex = new Map<number, LoopNodeRecord[]>();
  const folds: LoopNodeFold[] = [];

  loopNodeRecords.forEach((record) => {
    canonicalIndexByRecordIndex.set(record.index, record.index);
    canonicalRecordByIndex.set(record.index, record);
    recordsByCanonicalIndex.set(record.index, [record]);
  });

  recordsByNodeKey.forEach((records, nodeKey) => {
    const canonicalRecord = records[0];
    if (!canonicalRecord) return;
    folds.push({ nodeKey, canonicalRecord, records });
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
