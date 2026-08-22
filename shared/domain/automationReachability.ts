import type {
  ProjectCandidateRouting,
  ProjectGraphNode,
  ProjectGraphNodeRouteTarget,
  ProjectGraphRouteTarget,
  ProjectJobNode,
  ProjectRouteCandidate
} from "./automation.js";

export const getProjectGraphNode = (
  graphNodes: readonly ProjectGraphNode[],
  graphNodeId: string
): ProjectGraphNode | undefined => graphNodes.find((node) => node.id === graphNodeId);

export const getProjectJobNode = (
  graphNode: ProjectGraphNode,
  jobNodeId: string
): ProjectJobNode | undefined => graphNode.jobNodes.find((node) => node.id === jobNodeId);

export const graphRoutingChildIds = (
  routing: ProjectCandidateRouting<ProjectGraphRouteTarget>
): Set<string> => candidateUnion(routing)
  .flatMap((candidate) => "graphNodeId" in candidate.target ? [candidate.target.graphNodeId] : [])
  .reduce((ids, id) => ids.add(id), new Set<string>());

export const graphNodeRoutingChildIds = (
  routing: ProjectCandidateRouting<ProjectGraphNodeRouteTarget>
): Set<string> => candidateUnion(routing)
  .flatMap((candidate) => "jobNodeId" in candidate.target ? [candidate.target.jobNodeId] : [])
  .reduce((ids, id) => ids.add(id), new Set<string>());

export const routingTerminalResults = <TTarget extends ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget>(
  routing: ProjectCandidateRouting<TTarget>
): Set<string> => candidateUnion(routing)
  .flatMap((candidate) => "terminal" in candidate.target ? [candidate.target.terminal] : [])
  .reduce((results, result) => results.add(result), new Set<string>());

export const candidateUnion = <TTarget>(
  routing: ProjectCandidateRouting<TTarget>
): ProjectRouteCandidate<TTarget>[] => [
  ...routing.start.candidates,
  ...routing.continuation.flatMap((rule) => rule.candidates),
  ...routing.repair.flatMap((rule) => rule.candidates)
];

export const routeCandidatesAfter = <TTarget>(
  routing: ProjectCandidateRouting<TTarget>,
  sourceId: string,
  result: "PASS" | "FAIL"
): ProjectRouteCandidate<TTarget>[] => routing.continuation
  .filter((rule) => rule.sourceId === sourceId && rule.result === result)
  .flatMap((rule) => rule.candidates);

export const repairCandidatesFor = <TTarget>(
  routing: ProjectCandidateRouting<TTarget>,
  sourceId: string,
  capability: string
): ProjectRouteCandidate<TTarget>[] => routing.repair
  .filter((rule) => rule.sourceId === sourceId && rule.capability === capability)
  .flatMap((rule) => rule.candidates);
