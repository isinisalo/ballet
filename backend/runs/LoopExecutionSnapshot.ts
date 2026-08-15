import {
  getReachableProjectLoopIds,
  getReachableProjectNodeIds,
  isProjectAgentValidationNode,
  isProjectProviderWorkNode,
  type ProjectExecutionComposition,
  type ProjectLoop
} from "../../shared/domain/automation.js";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { LoopRunNotFoundError } from "../runtime/LoopRunErrors.js";

export interface ReachableProviderComposition {
  loopId: string;
  nodeId: string;
  phase: "work" | "validation";
  composition: ProjectExecutionComposition;
}

export const reachableProviderCompositions = (
  config: Pick<ProjectConfiguration, "loops" | "loopEdges">,
  rootLoopId: string
): ReachableProviderComposition[] => reachableLoops(config, rootLoopId).flatMap((loop) =>
  loop.nodes.flatMap((node) => [
    ...(isProjectProviderWorkNode(node.work)
      ? [{ loopId: loop.id, nodeId: node.id, phase: "work" as const, composition: node.work }]
      : []),
    ...(isProjectAgentValidationNode(node.validation)
      ? [{ loopId: loop.id, nodeId: node.id, phase: "validation" as const, composition: node.validation }]
      : [])
  ]));

export const reachableLoops = (
  config: Pick<ProjectConfiguration, "loops" | "loopEdges">,
  rootLoopId: string
): ProjectLoop[] => {
  const loops = new Map(config.loops.map((loop) => [loop.id, loop]));
  if (!loops.has(rootLoopId)) throw new LoopRunNotFoundError(`Reachable Loop ${rootLoopId} was not found.`);
  const reachableLoopIds = getReachableProjectLoopIds(config, rootLoopId);
  return config.loops.filter((loop) => reachableLoopIds.has(loop.id)).map((loop) => {
    const reachableNodeIds = getReachableProjectNodeIds(loop);
    return {
      ...loop,
      nodes: loop.nodes.filter((node) => reachableNodeIds.has(node.id)),
      edges: loop.edges.filter((edge) => reachableNodeIds.has(edge.source))
    };
  });
};
