import type {
  ProjectAutomationConfig,
  ProjectFailEdge,
  ProjectGraphTransition,
  ProjectJobNode,
  ProjectLoop,
  ProjectPassEdge,
  ProjectPassEdgeTarget,
  ProjectRepairEdge,
  ProjectValidationNode
} from "./automation.js";

export const maxRepairDepthLimit = 32;

export const resolveProjectWorkflowStartJob = (loop: ProjectLoop): ProjectJobNode | undefined =>
  loop.workflow.jobNodes.find((node) => node.id === loop.workflow.startJobNodeId);

export const getProjectValidationNode = (
  loop: ProjectLoop,
  validationNodeId: string
): ProjectValidationNode | undefined => loop.workflow.validationNodes.find((node) => node.id === validationNodeId);

export const getProjectPassEdges = (
  loop: ProjectLoop,
  sourceValidationNodeId?: string
): ProjectPassEdge[] => sourceValidationNodeId === undefined
  ? [...loop.workflow.passEdges]
  : loop.workflow.passEdges.filter((edge) => edge.sourceValidationNodeId === sourceValidationNodeId);

export const getProjectFailEdges = (
  loop: ProjectLoop,
  sourceValidationNodeId?: string
): ProjectFailEdge[] => sourceValidationNodeId === undefined
  ? [...loop.workflow.failEdges]
  : loop.workflow.failEdges.filter((edge) => edge.sourceValidationNodeId === sourceValidationNodeId);

export const getProjectGraphTransitions = (
  config: Pick<ProjectAutomationConfig, "graph">,
  sourceLoopId?: string,
  decision?: "PASS" | "FAIL",
  outcome?: string
): ProjectGraphTransition[] => config.graph.transitions.filter((transition) =>
  (sourceLoopId === undefined || transition.source === sourceLoopId)
  && (decision === undefined || transition.decision === decision)
  && (outcome === undefined || transition.outcome === outcome));

export const getProjectRepairEdges = (
  config: Pick<ProjectAutomationConfig, "graph">,
  sourceLoopId?: string
): ProjectRepairEdge[] => config.graph.repairEdges.filter((edge) =>
  sourceLoopId === undefined || edge.source === sourceLoopId);

export const isAllowedProjectRepairRoute = (
  config: Pick<ProjectAutomationConfig, "graph">,
  sourceLoopId: string,
  loopEdgeId: string
): boolean => getProjectRepairEdges(config, sourceLoopId)
  .some((edge) => edge.id === loopEdgeId);

export const getProjectPassTargetJobId = (target: ProjectPassEdgeTarget): string | undefined =>
  "jobNodeId" in target ? target.jobNodeId : undefined;

export const getReachableProjectJobNodeIds = (loop: ProjectLoop): Set<string> => {
  const reachable = new Set<string>();
  const pending = [loop.workflow.startJobNodeId];
  while (pending.length > 0) {
    const jobNodeId = pending.shift();
    if (!jobNodeId || reachable.has(jobNodeId)) continue;
    reachable.add(jobNodeId);
    const validationNodeId = loop.workflow.jobNodes.find((job) => job.id === jobNodeId)?.validationNodeId;
    for (const edge of validationNodeId ? getProjectPassEdges(loop, validationNodeId) : []) {
      const targetJobNodeId = getProjectPassTargetJobId(edge.target);
      if (targetJobNodeId && !reachable.has(targetJobNodeId)) pending.push(targetJobNodeId);
    }
  }
  return reachable;
};

export interface ReachableProjectLoopGraph {
  loopIds: Set<string>;
  transitionIds: Set<string>;
  repairEdgeIds: Set<string>;
  minimumRepairDepthByLoopId: Map<string, number>;
}

export const getReachableProjectLoopIds = (
  config: Pick<ProjectAutomationConfig, "graph">,
  startLoopId: string,
  maxRepairDepth: number
): Set<string> => getReachableProjectLoopGraph(config, startLoopId, maxRepairDepth).loopIds;

/**
 * Computes every statically usable Loop route. RunBook transitions preserve
 * the repair depth and Repair Edges consume one level, so cycles terminate while a Loop
 * can still be revisited at a shallower, more permissive depth.
 */
export const getReachableProjectLoopGraph = (
  config: Pick<ProjectAutomationConfig, "graph">,
  startLoopId: string,
  maxRepairDepth: number
): ReachableProjectLoopGraph => {
  if (!Number.isInteger(maxRepairDepth) || maxRepairDepth < 0 || maxRepairDepth > maxRepairDepthLimit) {
    throw new Error(`maxRepairDepth must be an integer between 0 and ${maxRepairDepthLimit}.`);
  }
  const minimumRepairDepthByLoopId = new Map<string, number>([[startLoopId, 0]]);
  const transitionIds = new Set<string>();
  const repairEdgeIds = new Set<string>();
  const pending: Array<{ loopId: string; repairDepth: number }> = [{ loopId: startLoopId, repairDepth: 0 }];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || minimumRepairDepthByLoopId.get(current.loopId) !== current.repairDepth) continue;
    for (const transition of getProjectGraphTransitions(config, current.loopId)) {
      transitionIds.add(transition.id);
      if (!("loopId" in transition.target)) continue;
      const previousDepth = minimumRepairDepthByLoopId.get(transition.target.loopId);
      if (previousDepth === undefined || current.repairDepth < previousDepth) {
        minimumRepairDepthByLoopId.set(transition.target.loopId, current.repairDepth);
        pending.push({ loopId: transition.target.loopId, repairDepth: current.repairDepth });
      }
    }
    if (current.repairDepth >= maxRepairDepth) continue;
    for (const edge of getProjectRepairEdges(config, current.loopId)) {
      const targetDepth = current.repairDepth + 1;
      repairEdgeIds.add(edge.id);
      const previousDepth = minimumRepairDepthByLoopId.get(edge.target);
      if (previousDepth === undefined || targetDepth < previousDepth) {
        minimumRepairDepthByLoopId.set(edge.target, targetDepth);
        pending.push({ loopId: edge.target, repairDepth: targetDepth });
      }
    }
  }
  return {
    loopIds: new Set(minimumRepairDepthByLoopId.keys()),
    transitionIds,
    repairEdgeIds,
    minimumRepairDepthByLoopId
  };
};

export const hasReachableProjectWorkflowPass = (loop: ProjectLoop): boolean => {
  const reachableJobs = getReachableProjectJobNodeIds(loop);
  const reachableValidations = new Set(loop.workflow.jobNodes
    .filter((job) => reachableJobs.has(job.id))
    .map((job) => job.validationNodeId));
  return loop.workflow.passEdges.some((edge) =>
    reachableValidations.has(edge.sourceValidationNodeId) && "workflowResult" in edge.target);
};
