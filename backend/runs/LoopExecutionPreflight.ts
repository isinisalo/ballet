import {
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type ProjectLoop,
  type ProjectLoopEdgeKind
} from "../../shared/domain/automation.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type {
  OrchestratorTaskEnvelopeV5,
  ValidationTaskEnvelopeV5,
  JobTaskEnvelopeV5
} from "../../shared/domain/taskEnvelope.js";
import { composeExecutionPrompt } from "../execution/ExecutionComposition.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { validateState } from "../runtime/state/StatePatch.js";

export const loopOrchestratorTask =
  "Route the persisted Orchestration Request to one allowed candidate Loop.";

export const preflightExecutionPrompts = (snapshot: RootExecutionSnapshot): void => {
  const rootLoop = requireLoop(snapshot, snapshot.rootLoopId);
  const state = validateState(rootLoop.state.initial);
  const stateEnvelope = { revision: 0, value: state, sha256: jsonSha256(state) };
  for (const loop of snapshot.loops) {
    for (const node of loop.workflow.jobNodes) {
      if (isProjectProviderJobNode(node)) {
        composeExecutionPrompt(snapshot, jobEnvelope(loop, node.id, stateEnvelope));
      }
      const validation = loop.workflow.validationNodes.find((candidate) => candidate.id === node.validationNodeId);
      if (validation && isProjectAgentValidationNode(validation)) {
        composeExecutionPrompt(snapshot, validationEnvelope(loop, node.id, stateEnvelope));
      }
    }
  }
  const routes = snapshot.graph.loopEdges.map((edge) => ({ source: edge.source, kind: edge.kind }));
  const uniqueRoutes = routes.filter((route, index) => routes.findIndex((candidate) =>
    candidate.source === route.source && candidate.kind === route.kind) === index);
  for (const route of uniqueRoutes.length > 0
    ? uniqueRoutes
    : [{ source: rootLoop.id, kind: "repair" as const }]) {
    composeExecutionPrompt(
      snapshot,
      orchestratorEnvelope(snapshot, requireLoop(snapshot, route.source), route.kind, stateEnvelope)
    );
  }
};

const jobEnvelope = (
  loop: ProjectLoop,
  nodeId: string,
  state: JobTaskEnvelopeV5["state"]
): JobTaskEnvelopeV5 => {
  const node = requireNode(loop, nodeId);
  return {
    version: 5,
    role: "job",
    run: providerRunIdentity,
    loop: { id: loop.id, description: loop.description },
    jobNode: { id: node.id, description: node.description },
    task: node.task,
    state,
    jobAttempt: 1,
    relevantHistory: []
  };
};

const validationEnvelope = (
  loop: ProjectLoop,
  nodeId: string,
  state: ValidationTaskEnvelopeV5["state"]
): ValidationTaskEnvelopeV5 => {
  const node = requireNode(loop, nodeId);
  const validation = loop.workflow.validationNodes.find((candidate) => candidate.id === node.validationNodeId);
  if (!validation) throw new Error(`ValidationNode ${node.validationNodeId} is missing from Loop ${loop.id}.`);
  return {
    version: 5,
    role: "validation",
    run: providerRunIdentity,
    loop: { id: loop.id, description: loop.description },
    jobNode: { id: node.id, description: node.description },
    validationNode: { id: validation.id, description: validation.description },
    task: validation.task,
    state,
    jobAttempt: 1,
    jobOutcome: {
      role: "job",
      state: "completed",
      summary: "Preflight Job outcome.",
      artifacts: {},
      checks: []
    },
    relevantHistory: []
  };
};

const orchestratorEnvelope = (
  snapshot: RootExecutionSnapshot,
  loop: ProjectLoop,
  kind: ProjectLoopEdgeKind,
  state: OrchestratorTaskEnvelopeV5["state"]
): OrchestratorTaskEnvelopeV5 => ({
  version: 5,
  role: "orchestrator",
  run: orchestratorRunIdentity,
  loop: { id: loop.id, description: loop.description },
  task: loopOrchestratorTask,
  state,
  orchestrationRequest: {
    id: "preflight-orchestration-request",
    kind,
    sourceLoopId: loop.id,
    sourceLoopRunId: "preflight-loop-run",
    sourceNodeRunId: "preflight-source-node-run",
    stateRevisionAtRequest: 0,
    completionSummary: "Preflight source completion.",
    completionEvidence: {}
  },
  allowedCandidates: snapshot.graph.loopEdges
    .filter((edge) => edge.kind === kind && edge.source === loop.id)
    .flatMap((edge) => {
      const target = requireLoop(snapshot, edge.target);
      const compatible = edge.kind === "repair"
        ? target.capabilities.provides.includes(edge.capability)
        : target.capabilities.accepts.includes(edge.capability);
      return compatible ? [{
        id: target.id, description: target.description,
        capabilities: target.capabilities,
        route: { kind: edge.kind, capability: edge.capability, description: edge.description }
      }] : [];
    }),
  relevantHistory: []
});

const providerRunIdentity = {
  rootRunId: "preflight-root-run",
  loopRunId: "preflight-loop-run",
  jobRunId: "preflight-job-run",
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
  const node = loop.workflow.jobNodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`JobNode ${loop.id}:${nodeId} is missing from the execution snapshot.`);
  return node;
};
