import type { ProjectPolicy } from "../../../../../shared/domain/automation";
import { policyOutputEventTypes } from "../../../../../shared/policy-actions";

export type WorkflowStepRecord = {
  policyId: string;
  index: number;
  policy?: ProjectPolicy;
};

export type WorkflowGraph = {
  childRecordsByParentEvent: Map<string, WorkflowStepRecord[]>;
  rootRecords: WorkflowStepRecord[];
};

export const workflowTriggerLabel = (policy?: ProjectPolicy) => {
  if (!policy) return "Next trigger";
  if (policy.source === "trigger") return policy.trigger || "Missing trigger";
  return policy.event || "External event";
};

export const workflowOutputEvents = (policy: ProjectPolicy | undefined, continuationEvent?: string) => {
  if (!policy) return ["Missing policy"];
  const events = policyOutputEventTypes(policy);
  return continuationEvent && !events.includes(continuationEvent) ? [continuationEvent, ...events] : events;
};

export const buildWorkflowGraph = (workflowStepRecords: WorkflowStepRecord[]): WorkflowGraph => {
  const childRecordsByParentEvent = new Map<string, WorkflowStepRecord[]>();
  const childRecordIndexes = new Set<number>();

  workflowStepRecords.forEach((record) => {
    if (record.policy?.source !== "event" || !record.policy.event) return;
    const parentRecord = workflowStepRecords
      .filter((candidate) =>
        candidate.index < record.index &&
        candidate.policy &&
        policyOutputEventTypes(candidate.policy).includes(record.policy?.event ?? "")
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
    rootRecords: rootRecords.length > 0 ? rootRecords : workflowStepRecords.slice(0, 1)
  };
};
