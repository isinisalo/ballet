import type { ProjectPolicy } from "@shared/api/workspace-contracts";
import { policyOutputEventTypes } from "@shared/policy-actions";

export type WorkflowOutputTarget = {
  outputId: string;
  eventType: string;
  type: "event";
};

export type WorkflowStepRecord = {
  policyId: string;
  index: number;
  policy?: ProjectPolicy;
  outputEvents?: string[];
  outputTargets?: WorkflowOutputTarget[];
};

export type WorkflowGraph = {
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
    ? recordOrPolicy.outputEvents ?? policyOutputEventTypes(policy)
    : policyOutputEventTypes(policy);
  return continuationEvent && !events.includes(continuationEvent) ? [continuationEvent, ...events] : events;
};

export const buildWorkflowGraph = (workflowStepRecords: WorkflowStepRecord[]): WorkflowGraph => {
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
    childRecordsByParentEvent,
    eventHandlerRecordsByEvent,
    rootRecords: rootRecords.length > 0 ? rootRecords : workflowStepRecords.slice(0, 1)
  };
};
