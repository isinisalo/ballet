import type { JsonValue, ProjectLoop, ProjectWorkLoopNode } from "../../shared/domain/automation.js";
import type { NodeRun, ValidationNodeOutcome } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";
import type { LoopRunStore } from "./LoopRunStore.js";
import type { LoopStateStore } from "./LoopStateStore.js";
import type { RepairStore } from "./RepairStore.js";
import type { WorkLoopProgressStore } from "./WorkLoopProgressStore.js";

type ValidationFailOutcome = ValidationNodeOutcome & { state: "completed"; decision: "FAIL" };

export interface LocalRetryContext {
  loop: ProjectLoop;
  definition: ProjectWorkLoopNode;
  compositeId: string;
  nestingDepth: number;
  createWork(attempt: number, revision: number, context: JsonValue): void;
  completeBlocked(node: NodeRun, revision: number, outcome: ValidationNodeOutcome): void;
}

export class LocalRetryEngine {
  constructor(
    private readonly loops: LoopRunStore,
    private readonly states: LoopStateStore,
    private readonly repairs: RepairStore,
    private readonly progress: WorkLoopProgressStore
  ) {}

  apply(node: NodeRun, outcome: ValidationFailOutcome, context: LocalRetryContext): void {
    if (outcome.repair.mode !== "LOCAL_RETRY") throw new LoopRunIntegrityError("Expected a local retry repair.");
    const { definition, compositeId } = context;
    const composite = this.loops.getWorkLoopNodeRun(compositeId);
    if (!composite) throw new LoopRunIntegrityError(`Work Loop Node Run ${compositeId} was not found.`);
    const request = this.repairs.createRequest({
      rootRunId: node.rootRunId, requesterLoopRunId: node.loopRunId,
      requesterWorkLoopNodeRunId: compositeId, requesterValidationNodeRunId: node.nodeRunId,
      mode: "local", attempt: composite.attempt, validationSummary: outcome.summary,
      requestedCapability: outcome.repair.expectedCorrection, reason: outcome.repair.feedback,
      evidence: outcome.evidence, stateRevisionAtRequest: node.stateRevisionBefore,
      returnLoopId: node.loopId, returnWorkLoopNodeId: definition.id,
      returnValidationNodeDefinitionId: node.nodeDefinitionId, nestingDepth: context.nestingDepth
    });
    const limited = composite.attempt >= definition.maxLocalAttempts;
    this.states.commitNodeOutcome({
      rootRunId: node.rootRunId, nodeRunId: node.nodeRunId, baseRevision: node.stateRevisionBefore,
      outcome, workLoopNodeStatus: limited ? "blocked" : "running",
      workLoopNodeTerminal: limited ? "blocked" : undefined,
      errorCode: limited ? "local_retry_limit" : undefined,
      errorMessage: limited ? `Work Loop Node ${definition.id} exhausted ${definition.maxLocalAttempts} local attempts.` : undefined,
      control: { kind: "validation_fail_local", repairRequestId: request.repairRequestId,
        targetWorkLoopNodeRunId: limited ? undefined : compositeId }
    });
    const persisted = this.requirePersisted(node);
    const revision = persisted.stateRevisionAfter ?? node.stateRevisionBefore;
    if (limited) {
      this.repairs.finishRequest(request.repairRequestId, "failed");
      context.completeBlocked(persisted, revision, persisted.outcome);
      return;
    }
    const attempt = this.progress.incrementLocalAttempt(compositeId, definition.maxLocalAttempts);
    this.repairs.finishRequest(request.repairRequestId, "repaired");
    context.createWork(attempt, revision, {
      previousValidationFeedback: {
        feedback: outcome.repair.feedback,
        expectedCorrection: outcome.repair.expectedCorrection
      }
    });
  }

  private requirePersisted(node: NodeRun): NodeRun & { outcome: ValidationNodeOutcome } {
    const persisted = this.loops.getNodeRun(node.nodeRunId);
    if (!persisted?.outcome || persisted.outcome.role !== "validation" || persisted.outcome.state !== "completed") {
      throw new LoopRunIntegrityError("Persisted Validation outcome was not available for local retry readback.");
    }
    return persisted as NodeRun & { outcome: ValidationNodeOutcome };
  }
}
