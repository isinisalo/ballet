import type {
  LoopRunDetails,
  RootExecutionSnapshot,
  StepOutcome,
  StepRun
} from "../../shared/domain/runtime.js";
import {
  serializeTaskEnvelopeRecentStepV1,
  serializeTaskEnvelopeV1,
  type TaskEnvelopeOutcomeV1,
  type TaskEnvelopeRecentStepV1,
  type TaskEnvelopeV1
} from "./TaskEnvelopeV1.js";

export { serializeTaskEnvelopeV1 } from "./TaskEnvelopeV1.js";
export type { TaskEnvelopeRecentStepV1, TaskEnvelopeV1 } from "./TaskEnvelopeV1.js";

export const MAX_LOOP_RUN_INPUT_CHARS = 20_000;
export const MAX_LOOP_STEP_HISTORY_BYTES = 8 * 1024;
export const MAX_LOOP_STEP_HISTORY_ENTRIES = 3;

const RUN_INPUT_TRUNCATION_MARKER = "\n[... RUN_INPUT TRUNCATED ...]\n";
const TEXT_TRUNCATION_MARKER = " [... TRUNCATED ...] ";
const terminalStepStatuses = new Set<StepRun["status"]>(["completed", "blocked", "failed", "cancelled"]);
const shaArtifactKey = /^(git_sha|commit_sha)$/;
const branchArtifactKey = /^branch$/;
const pathArtifactKey = /^(changed_files|artifact_path|file|files|file_path|path|paths|document|document_path|report|report_path|task|tasks|design|design_path)$/;
const safePathCharacters = /^[\p{L}\p{N}._@+/-]+$/u;

/** Builds the attempt envelope only from immutable Loop snapshots and persisted Run data. */
export const taskEnvelopeForStep = (
  snapshot: RootExecutionSnapshot,
  runs: readonly LoopRunDetails[],
  currentRun: LoopRunDetails,
  currentStep: StepRun
): TaskEnvelopeV1 => {
  const snapshotStep = snapshot.loops.find((loop) => loop.id === currentRun.loopId)?.nodes
    .find((step) => step.id === currentStep.stepId);
  if (!snapshotStep || !("description" in snapshotStep)) {
    throw new Error(`Loop step snapshot is missing ${currentRun.loopId}:${currentStep.stepId}.`);
  }
  if (!snapshotStep.description.trim()) {
    throw new Error(`Loop step task is empty for ${currentRun.loopId}:${currentStep.stepId}.`);
  }
  return {
    version: 1,
    loopId: currentRun.loopId,
    stepId: currentStep.stepId,
    task: snapshotStep.description,
    runInput: truncateMiddle(
      currentStep.input ?? currentRun.input ?? "",
      MAX_LOOP_RUN_INPUT_CHARS,
      RUN_INPUT_TRUNCATION_MARKER
    ),
    recentSteps: recentHistory(runs, currentStep.stepRunId),
    ...(currentStep.outcome?.state === "needs_input" && currentStep.responseInput ? {
      resume: {
        question: currentStep.outcome.question,
        context: currentStep.outcome.context,
        response: currentStep.responseInput
      }
    } : {})
  };
};

export const renderStepTaskEnvelope = (
  snapshot: RootExecutionSnapshot,
  runs: readonly LoopRunDetails[],
  currentRun: LoopRunDetails,
  currentStep: StepRun
): string => serializeTaskEnvelopeV1(taskEnvelopeForStep(snapshot, runs, currentRun, currentStep));

const recentHistory = (
  runs: readonly LoopRunDetails[],
  currentStepRunId: string
): TaskEnvelopeRecentStepV1[] => {
  const candidates = runs
    .flatMap((run, runIndex) => run.stepRuns.map((step, stepIndex) => ({ step, runIndex, stepIndex })))
    .filter(({ step }) => step.stepRunId !== currentStepRunId
      && terminalStepStatuses.has(step.status)
      && Boolean(step.completedAt))
    .sort((left, right) => {
      const timestampDifference = Date.parse(right.step.completedAt!) - Date.parse(left.step.completedAt!);
      return timestampDifference || right.runIndex - left.runIndex || right.stepIndex - left.stepIndex;
    })
    .slice(0, MAX_LOOP_STEP_HISTORY_ENTRIES)
    .map(({ step }) => historyEntry(step));

  const retained: TaskEnvelopeRecentStepV1[] = [];
  for (const candidate of candidates) {
    if (utf8Bytes(`[${[...retained, candidate].map(serializeTaskEnvelopeRecentStepV1).join(",")}]`)
      > MAX_LOOP_STEP_HISTORY_BYTES) break;
    retained.push(candidate);
  }
  return retained;
};

const historyEntry = (step: StepRun): TaskEnvelopeRecentStepV1 => ({
  loopId: step.loopId,
  stepId: step.stepId,
  type: step.type,
  status: step.status,
  ...(step.result ? { result: step.result } : {}),
  ...(step.type === "human" && step.responseInput
    ? { humanResponse: compactText(step.responseInput, 180) }
    : {}),
  ...(step.outcome ? { outcome: compactOutcome(step.outcome) } : {}),
  ...(step.error ? { error: compactText(step.error, 180) } : {})
});

const compactOutcome = (outcome: StepOutcome): TaskEnvelopeOutcomeV1 => {
  const checks = [...outcome.checks]
    .sort((left, right) => checkPriority(left.status) - checkPriority(right.status))
    .slice(0, 3)
    .map((check) => ({
      name: compactText(check.name, 60),
      status: check.status,
      ...(check.details ? { details: compactText(check.details, 100) } : {})
    }));
  const artifactRefs = safeArtifactRefs(outcome.artifacts);
  return {
    state: outcome.state,
    ...(outcome.state === "completed" ? { result: outcome.result } : {}),
    summary: compactText(outcome.summary, 180),
    ...(checks.length > 0 ? { checks } : {}),
    ...(artifactRefs && Object.keys(artifactRefs).length > 0 ? { artifactRefs } : {})
  };
};

const checkPriority = (status: StepOutcome["checks"][number]["status"]): number => {
  if (status === "failed") return 0;
  if (status === "skipped") return 1;
  return 2;
};

const safeArtifactRefs = (artifacts: StepOutcome["artifacts"]): Record<string, string | string[]> | undefined => {
  if (!artifacts) return undefined;
  const result: Record<string, string | string[]> = {};
  let remainingValues = 4;
  for (const key of Object.keys(artifacts).sort(compareText)) {
    if (remainingValues === 0) break;
    const value = artifacts[key];
    if (!/^[a-z0-9_]{1,32}$/.test(key)) continue;
    if (typeof value === "string") {
      const reference = safeArtifactReference(key, value);
      if (!reference) continue;
      result[key] = reference;
      remainingValues -= 1;
      continue;
    }
    if (!Array.isArray(value)) continue;
    const references = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => safeArtifactReference(key, item))
      .filter((item): item is string => Boolean(item))
      .slice(0, remainingValues);
    if (references.length === 0) continue;
    result[key] = references;
    remainingValues -= references.length;
  }
  return result;
};

const safeArtifactReference = (key: string, value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160 || /[\r\n\0]/.test(trimmed)) return undefined;
  if (shaArtifactKey.test(key)) return /^[0-9a-f]{7,64}$/i.test(trimmed) ? trimmed : undefined;
  if (branchArtifactKey.test(key)) return isSafeGitRef(trimmed) ? trimmed : undefined;
  if (!pathArtifactKey.test(key) || !isSafeRepoPath(trimmed)) return undefined;
  return trimmed;
};

const isSafeGitRef = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(value)
  && !value.includes("..") && !value.includes("//") && !value.includes("@{")
  && !value.endsWith("/") && !value.endsWith(".") && !value.endsWith(".lock");

const isSafeRepoPath = (value: string): boolean => safePathCharacters.test(value)
  && !value.startsWith("/") && !value.startsWith("~") && !/^[a-zA-Z]:\//.test(value)
  && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)
  && !value.split("/").some((segment) => !segment || segment === "." || segment === "..")
  && value !== ".git" && !value.startsWith(".git/");

const compactText = (value: string, maxChars: number): string =>
  truncateMiddle(value.replace(/\s+/g, " ").trim(), maxChars, TEXT_TRUNCATION_MARKER);

const truncateMiddle = (value: string, maxChars: number, marker: string): string => {
  if (value.length <= maxChars) return value;
  const available = maxChars - marker.length;
  if (available <= 0) return marker.slice(0, maxChars);
  const headLength = Math.ceil(available / 2);
  const tailLength = Math.floor(available / 2);
  let head = value.slice(0, headLength);
  let tail = value.slice(value.length - tailLength);
  if (isHighSurrogate(head.charCodeAt(head.length - 1))) head = head.slice(0, -1);
  if (isLowSurrogate(tail.charCodeAt(0))) tail = tail.slice(1);
  return `${head}${marker}${tail}`;
};

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const isHighSurrogate = (value: number): boolean => value >= 0xd800 && value <= 0xdbff;
const isLowSurrogate = (value: number): boolean => value >= 0xdc00 && value <= 0xdfff;
const utf8Bytes = (value: string): number => Buffer.byteLength(value, "utf8");
