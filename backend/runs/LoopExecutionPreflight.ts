import {
  isProjectAgentValidationNode,
  isProjectProviderWorkNode,
  type ProjectLoop
} from "../../shared/domain/automation.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type {
  OrchestratorTaskEnvelopeV2,
  ValidationTaskEnvelopeV2,
  WorkTaskEnvelopeV2
} from "../../shared/domain/taskEnvelope.js";
import { composeExecutionPrompt } from "../execution/ExecutionComposition.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { validateState } from "../runtime/state/StatePatch.js";

export const loopOrchestratorTask =
  "Route the persisted Repair Request to one allowed target Loop.";

export const preflightExecutionPrompts = (snapshot: RootExecutionSnapshot): void => {
  const rootLoop = requireLoop(snapshot, snapshot.rootLoopId);
  const state = validateState(rootLoop.state.initial);
  const stateEnvelope = { revision: 0, value: state, sha256: jsonSha256(state) };
  for (const loop of snapshot.loops) {
    for (const node of loop.nodes) {
      if (isProjectProviderWorkNode(node.work)) {
        composeExecutionPrompt(snapshot, workEnvelope(loop, node.id, stateEnvelope));
      }
      if (isProjectAgentValidationNode(node.validation)) {
        composeExecutionPrompt(snapshot, validationEnvelope(loop, node.id, stateEnvelope));
      }
    }
  }
  const sources = snapshot.loops.filter((loop) => snapshot.loopEdges.some((edge) =>
    edge.kind === "repair" && edge.source === loop.id));
  for (const loop of sources.length > 0 ? sources : [rootLoop]) {
    composeExecutionPrompt(snapshot, orchestratorEnvelope(snapshot, loop, stateEnvelope));
  }
};

const workEnvelope = (
  loop: ProjectLoop,
  nodeId: string,
  state: WorkTaskEnvelopeV2["state"]
): WorkTaskEnvelopeV2 => {
  const node = requireNode(loop, nodeId);
  return {
    version: 2,
    role: "work",
    run: providerRunIdentity,
    loop: { id: loop.id, description: loop.description },
    workLoopNode: { id: node.id, description: node.description },
    task: node.work.task,
    state,
    localAttempt: 1,
    relevantHistory: []
  };
};

const validationEnvelope = (
  loop: ProjectLoop,
  nodeId: string,
  state: ValidationTaskEnvelopeV2["state"]
): ValidationTaskEnvelopeV2 => {
  const node = requireNode(loop, nodeId);
  return {
    version: 2,
    role: "validation",
    run: providerRunIdentity,
    loop: { id: loop.id, description: loop.description },
    workLoopNode: { id: node.id, description: node.description },
    task: node.validation.task,
    state,
    localAttempt: 1,
    workOutcome: {
      role: "work",
      state: "completed",
      summary: "Preflight Work outcome.",
      artifacts: {},
      checks: []
    },
    relevantHistory: []
  };
};

const orchestratorEnvelope = (
  snapshot: RootExecutionSnapshot,
  loop: ProjectLoop,
  state: OrchestratorTaskEnvelopeV2["state"]
): OrchestratorTaskEnvelopeV2 => ({
  version: 2,
  role: "orchestrator",
  run: orchestratorRunIdentity,
  loop: { id: loop.id, description: loop.description },
  task: loopOrchestratorTask,
  state,
  repairRequest: {
    id: "preflight-repair-request",
    requesterLoopRunId: "preflight-loop-run",
    requesterWorkLoopNodeRunId: "preflight-work-loop-node-run",
    requesterValidationNodeRunId: "preflight-validation-node-run",
    reason: "Preflight the immutable Orchestrator composition.",
    requestedCapability: "Preflight routing capability.",
    stateRevisionAtRequest: 0,
    nestingDepth: 0
  },
  allowedTargetLoops: snapshot.loopEdges
    .filter((edge) => edge.kind === "repair" && edge.source === loop.id)
    .map((edge) => requireLoop(snapshot, edge.target))
    .map(({ id, description }) => ({ id, description })),
  relevantHistory: []
});

const providerRunIdentity = {
  rootRunId: "preflight-root-run",
  loopRunId: "preflight-loop-run",
  workLoopNodeRunId: "preflight-work-loop-node-run",
  nodeRunId: "preflight-node-run"
};
const orchestratorRunIdentity = {
  rootRunId: "preflight-root-run",
  loopRunId: "preflight-loop-run",
  nodeRunId: "preflight-orchestrator-node-run"
};

const requireLoop = (snapshot: RootExecutionSnapshot, loopId: string): ProjectLoop => {
  const loop = snapshot.loops.find((candidate) => candidate.id === loopId);
  if (!loop) throw new Error(`Loop ${loopId} is missing from the execution snapshot.`);
  return loop;
};
const requireNode = (loop: ProjectLoop, nodeId: string) => {
  const node = loop.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Work Loop Node ${loop.id}:${nodeId} is missing from the execution snapshot.`);
  return node;
};
