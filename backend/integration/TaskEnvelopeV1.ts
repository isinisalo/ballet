import type { StepOutcome, StepRun } from "../../shared/domain/runtime.js";

export interface TaskEnvelopeOutcomeV1 {
  state: StepOutcome["state"];
  result?: "approved" | "rejected";
  summary: string;
  checks?: Array<{
    name: string;
    status: StepOutcome["checks"][number]["status"];
    details?: string;
  }>;
  artifactRefs?: Record<string, string | string[]>;
}

export interface TaskEnvelopeRecentStepV1 {
  loopId: string;
  stepId: string;
  type: StepRun["type"];
  status: StepRun["status"];
  result?: StepRun["result"];
  humanResponse?: string;
  outcome?: TaskEnvelopeOutcomeV1;
  error?: string;
}

export interface TaskEnvelopeV1 {
  version: 1;
  loopId: string;
  stepId: string;
  task: string;
  runInput: string;
  recentSteps: TaskEnvelopeRecentStepV1[];
  resume?: { question: string; context: string; response: string };
}

/** V1 has an explicit byte contract; changing field order requires a new envelope version. */
export const serializeTaskEnvelopeV1 = (envelope: TaskEnvelopeV1): string =>
  `{"version":1,"loopId":${string(envelope.loopId)},"stepId":${string(envelope.stepId)},"task":${string(envelope.task)},"runInput":${string(envelope.runInput)},"recentSteps":[${envelope.recentSteps.map(serializeTaskEnvelopeRecentStepV1).join(",")}]${envelope.resume ? `,"resume":${serializeResume(envelope.resume)}` : ""}}`;

export const serializeTaskEnvelopeRecentStepV1 = (step: TaskEnvelopeRecentStepV1): string =>
  `{"loopId":${string(step.loopId)},"stepId":${string(step.stepId)},"type":${string(step.type)},"status":${string(step.status)}${step.result ? `,"result":${string(step.result)}` : ""}${step.humanResponse ? `,"humanResponse":${string(step.humanResponse)}` : ""}${step.outcome ? `,"outcome":${serializeOutcome(step.outcome)}` : ""}${step.error ? `,"error":${string(step.error)}` : ""}}`;

const serializeOutcome = (outcome: TaskEnvelopeOutcomeV1): string =>
  `{"state":${string(outcome.state)}${outcome.result ? `,"result":${string(outcome.result)}` : ""},"summary":${string(outcome.summary)}${outcome.checks ? `,"checks":[${outcome.checks.map(serializeCheck).join(",")}]` : ""}${outcome.artifactRefs ? `,"artifactRefs":${serializeArtifactRefs(outcome.artifactRefs)}` : ""}}`;

const serializeCheck = (check: NonNullable<TaskEnvelopeOutcomeV1["checks"]>[number]): string =>
  `{"name":${string(check.name)},"status":${string(check.status)}${check.details ? `,"details":${string(check.details)}` : ""}}`;

const serializeArtifactRefs = (references: Record<string, string | string[]>): string => {
  const fields = Object.keys(references).sort(compareText).map((key) => {
    const value = references[key]!;
    return `${string(key)}:${typeof value === "string" ? string(value) : `[${value.map(string).join(",")}]`}`;
  });
  return `{${fields.join(",")}}`;
};

const serializeResume = (resume: NonNullable<TaskEnvelopeV1["resume"]>): string =>
  `{"question":${string(resume.question)},"context":${string(resume.context)},"response":${string(resume.response)}}`;

const string = (value: string): string => JSON.stringify(value);
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
