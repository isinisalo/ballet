import type { JsonValue, ProjectGraphTransition, ProjectLoop } from "../../shared/domain/automation.js";
import type { NodeRun, ValidationCompletedOutcome } from "../../shared/domain/runtime.js";
import { ControlFlowTransitionStore } from "./ControlFlowTransitionStore.js";
import { GraphRunStateStore } from "./GraphRunStateStore.js";
import { LoopRunIntegrityError } from "./LoopRunErrors.js";
import type { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import type { WorkflowProgressStore } from "./WorkflowProgressStore.js";

export interface GraphRunbookCallbacks {
  startTransition(
    loop: ProjectLoop, input: JsonValue, revision: number
  ): { loopRunId: string; jobRunId: string };
}

export class GraphRunbookEngine {
  private readonly events: ControlFlowTransitionStore;
  private readonly state: GraphRunStateStore;

  constructor(
    connection: ConstructorParameters<typeof ControlFlowTransitionStore>[0],
    private readonly snapshots: RootExecutionSnapshotStore,
    private readonly progress: WorkflowProgressStore
  ) {
    this.events = new ControlFlowTransitionStore(connection);
    this.state = new GraphRunStateStore(connection);
  }

  route(
    node: NodeRun,
    revision: number,
    outcome: ValidationCompletedOutcome,
    callbacks: GraphRunbookCallbacks
  ): boolean {
    const snapshot = this.snapshots.require(node.rootRunId);
    if (snapshot.rootKind === "loop") return false;
    if (!outcome.transitionOutcome) throw new LoopRunIntegrityError(
      `Terminal Validation in Graph Run ${node.rootRunId} did not select a transition outcome.`
    );
    const matches = snapshot.graph.transitions.filter((transition) =>
      transition.source === node.loopId
      && transition.decision === outcome.decision
      && transition.outcome === outcome.transitionOutcome
    );
    if (matches.length !== 1) throw new LoopRunIntegrityError(
      `Graph Run ${node.rootRunId} has ${matches.length} transitions for `
      + `${node.loopId}:${outcome.decision}:${outcome.transitionOutcome}; expected one.`
    );
    const transition = matches[0]!;
    const count = this.state.countTransitions(node.rootRunId);
    if (count >= snapshot.orchestrator.maxTransitions) throw new LoopRunIntegrityError(
      `Graph Run ${node.rootRunId} exceeded its ${snapshot.orchestrator.maxTransitions} transition limit.`
    );
    if ("runResult" in transition.target) {
      this.events.append({
        rootRunId: node.rootRunId,
        kind: "graph_transition",
        stateRevision: revision,
        sourceLoopRunId: node.loopRunId,
        sourceJobRunId: node.jobRunId,
        sourceNodeRunId: node.nodeRunId
      });
      this.state.recordTransition(node.rootRunId, transition);
      this.progress.finishRoot(node.rootRunId, outcome);
      return true;
    }
    const targetLoop = this.snapshots.loop(snapshot, transition.target.loopId);
    const target = callbacks.startTransition(targetLoop, transitionInput(transition, outcome), revision);
    this.events.append({
      rootRunId: node.rootRunId,
      kind: "graph_transition",
      stateRevision: revision,
      sourceLoopRunId: node.loopRunId,
      sourceJobRunId: node.jobRunId,
      sourceNodeRunId: node.nodeRunId,
      targetLoopRunId: target.loopRunId,
      targetJobRunId: target.jobRunId
    });
    this.state.recordTransition(node.rootRunId, transition, target.loopRunId);
    return true;
  }
}

const transitionInput = (
  transition: ProjectGraphTransition,
  outcome: ValidationCompletedOutcome
): JsonValue => ({
  transition: {
    id: transition.id,
    source: transition.source,
    decision: transition.decision,
    outcome: transition.outcome,
    targetLoopId: "loopId" in transition.target ? transition.target.loopId : null
  },
  validation: outcome as unknown as JsonValue
});
