import {
  getReachableProjectLoopGraph,
  getReachableProjectJobNodeIds,
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type JsonValue,
  type ProjectExecutionComposition,
  type ProjectGraphTransition,
  type ProjectLoop,
  type ProjectRepairEdge
} from "../../shared/domain/automation.js";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { LoopRunNotFoundError } from "../runtime/LoopRunErrors.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";

type ReachableConfiguration = Pick<
  ProjectConfiguration,
  "loops" | "graph" | "orchestrator"
>;

export interface ReachableProviderComposition {
  id: string;
  loopId: string;
  nodeId: string;
  role: "job" | "validation";
  composition: ProjectExecutionComposition;
}

export interface ReachableExecutionGraph {
  loops: ProjectLoop[];
  graph: {
    id: string;
    name: string;
    startLoopId: string;
    transitions: ProjectGraphTransition[];
    repairEdges: ProjectRepairEdge[];
  };
  minimumRepairDepthByLoopId: ReadonlyMap<string, number>;
}

export const reachableExecutionGraph = (
  config: ReachableConfiguration,
  rootLoopId: string,
  rootKind: "graph" | "loop" = "graph"
): ReachableExecutionGraph => {
  const loopsById = new Map(config.loops.map((loop) => [loop.id, loop]));
  if (!loopsById.has(rootLoopId)) {
    throw new LoopRunNotFoundError(`Reachable Loop ${rootLoopId} was not found.`);
  }
  const reachability = getReachableProjectLoopGraph(
    rootKind === "graph" ? config : {
      ...config,
      graph: { ...config.graph, transitions: [] }
    },
    rootLoopId,
    config.orchestrator.repairRouter?.maxRepairDepth ?? 0
  );
  const loops = [...reachability.loopIds].map((loopId) => {
    const loop = loopsById.get(loopId);
    if (!loop) throw new LoopRunNotFoundError(`Reachable Loop ${loopId} was not found.`);
    return snapshotLoop(loop);
  }).sort((left, right) => compareUtf8(left.id, right.id));
  const reachableLoopIds = new Set(loops.map((loop) => loop.id));
  const transitions = config.graph.transitions
    .filter((transition) => reachability.transitionIds.has(transition.id))
    .map((transition) => {
      if (!reachableLoopIds.has(transition.source)
        || ("loopId" in transition.target && !reachableLoopIds.has(transition.target.loopId))) {
        throw new LoopRunNotFoundError(`Reachable Transition ${transition.id} has a missing endpoint.`);
      }
      return { ...transition, target: { ...transition.target } };
    })
    .sort((left, right) => compareUtf8(left.id, right.id));
  const repairEdges = config.graph.repairEdges
    .filter((edge) => reachability.repairEdgeIds.has(edge.id))
    .map((edge) => {
      if (!reachableLoopIds.has(edge.source) || !reachableLoopIds.has(edge.target)) {
        throw new LoopRunNotFoundError(`Reachable Repair Edge ${edge.id} has a missing endpoint.`);
      }
      return { ...edge };
    })
    .sort((left, right) => compareUtf8(left.id, right.id));
  return {
    loops,
    graph: {
      id: config.graph.id,
      name: config.graph.name,
      startLoopId: rootLoopId,
      transitions,
      repairEdges
    },
    minimumRepairDepthByLoopId: reachability.minimumRepairDepthByLoopId
  };
};

export const reachableProviderCompositions = (
  config: ReachableConfiguration,
  rootLoopId: string,
  rootKind: "graph" | "loop" = "loop"
): ReachableProviderComposition[] => providerCompositionsForLoops(
  reachableExecutionGraph(config, rootLoopId, rootKind).loops
);

export const providerCompositionsForLoops = (
  loops: readonly ProjectLoop[]
): ReachableProviderComposition[] => loops.flatMap((loop) =>
  loop.workflow.jobNodes.flatMap((node) => {
    const validation = loop.workflow.validationNodes.find((candidate) => candidate.id === node.validationNodeId);
    return [
    ...(isProjectProviderJobNode(node) ? [{
      id: `${loop.id}:${node.id}:job`,
      loopId: loop.id,
      nodeId: node.id,
      role: "job" as const,
      composition: node
    }] : []),
    ...(validation && isProjectAgentValidationNode(validation) ? [{
      id: `${loop.id}:${validation.id}:validation`,
      loopId: loop.id,
      nodeId: validation.id,
      role: "validation" as const,
      composition: validation
    }] : [])
  ];
  }));

export const reachableLoops = (
  config: ReachableConfiguration,
  rootLoopId: string
): ProjectLoop[] => reachableExecutionGraph(config, rootLoopId, "loop").loops;

const snapshotLoop = (loop: ProjectLoop): ProjectLoop => {
  const reachableJobIds = getReachableProjectJobNodeIds(loop);
  const reachableValidationIds = new Set(loop.workflow.jobNodes
    .filter((node) => reachableJobIds.has(node.id))
    .map((node) => node.validationNodeId));
  return {
    id: loop.id,
    description: loop.description,
    capabilities: {
      accepts: [...loop.capabilities.accepts].sort(compareUtf8),
      provides: [...loop.capabilities.provides].sort(compareUtf8)
    },
    state: {
      description: loop.state.description,
      initial: canonicalClone(loop.state.initial)
    },
    workflow: {
      startJobNodeId: loop.workflow.startJobNodeId,
      jobNodes: loop.workflow.jobNodes
        .filter((node) => reachableJobIds.has(node.id))
        .map(normalizeComposition)
        .sort((left, right) => compareUtf8(left.id, right.id)),
      validationNodes: loop.workflow.validationNodes
        .filter((node) => reachableValidationIds.has(node.id))
        .map(normalizeComposition)
        .sort((left, right) => compareUtf8(left.id, right.id)),
      passEdges: loop.workflow.passEdges
        .filter((edge) => reachableValidationIds.has(edge.sourceValidationNodeId)
          && ("workflowResult" in edge.target || reachableJobIds.has(edge.target.jobNodeId)))
        .map((edge) => ({ ...edge, target: { ...edge.target } }))
        .sort((left, right) => compareUtf8(left.id, right.id)),
      failEdges: loop.workflow.failEdges
        .filter((edge) => reachableValidationIds.has(edge.sourceValidationNodeId))
        .map((edge) => ({ ...edge, target: { ...edge.target } }))
        .sort((left, right) => compareUtf8(left.id, right.id))
    }
  };
};

const normalizeComposition = <T extends { type: string } & Partial<ProjectExecutionComposition>>(node: T): T =>
  node.type === "human" ? { ...node } : { ...node, skillIds: [...(node.skillIds ?? [])].sort(compareUtf8) };

const canonicalClone = (value: JsonValue): JsonValue => JSON.parse(canonicalJson(value)) as JsonValue;
const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left), Buffer.from(right));
