import type { JsonValue, ProjectJobNode, ProjectLoop } from "../../shared/domain/automation.js";
import type { NodeRun, ValidationCompletedOutcome } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { LoopStateStore } from "./LoopStateStore.js";
import type { WorkflowProgressStore } from "./WorkflowProgressStore.js";

type ValidationFailOutcome = Extract<ValidationCompletedOutcome, { decision: "FAIL" }>;

export interface WorkflowRetryContext {
  loop: ProjectLoop;
  job: ProjectJobNode;
  jobRunId: string;
  createJob(attempt: number, revision: number, context: JsonValue): void;
}

export class WorkflowRetryEngine {
  constructor(
    private readonly loops: LoopRunStore,
    private readonly states: LoopStateStore,
    private readonly progress: WorkflowProgressStore
  ) {}

  apply(node: NodeRun, outcome: ValidationFailOutcome, context: WorkflowRetryContext): void {
    const jobRun = this.loops.getJobRun(context.jobRunId);
    if (!jobRun) throw new LoopRunIntegrityError(`Job Run ${context.jobRunId} was not found.`);
    if (jobRun.jobAttempt > context.job.maxRetries) {
      throw new LoopRunIntegrityError(
        `Job Run ${context.jobRunId} has exhausted ${context.job.maxRetries} retries and must escalate.`
      );
    }
    this.states.commitNodeOutcome({
      rootRunId: node.rootRunId,
      nodeRunId: node.nodeRunId,
      baseRevision: node.stateRevisionBefore,
      outcome,
      jobRunStatus: "running",
      control: { kind: "validation_fail_retry", targetJobRunId: context.jobRunId }
    });
    const persisted = this.loops.getNodeRun(node.nodeRunId);
    if (!persisted?.outcome || persisted.outcome.role !== "validation" || persisted.outcome.state !== "completed") {
      throw new LoopRunIntegrityError("Persisted Validation FAIL outcome was not available for retry readback.");
    }
    const revision = persisted.stateRevisionAfter ?? node.stateRevisionBefore;
    const jobAttempt = this.progress.incrementLocalAttempt(context.jobRunId, context.job.maxRetries + 1);
    context.createJob(jobAttempt, revision, {
      previousValidationFeedback: {
        feedback: outcome.feedback,
        expectedCorrection: outcome.expectedCorrection
      }
    });
  }
}
