import {
  getProjectStepTransitionTargets,
  isProjectExecutionStep,
  isProjectTerminalNode,
  type ProjectExecutionStep,
  type ProjectLoop
} from "../../shared/domain/automation.js";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { LoopRunNotFoundError } from "../runtime/LoopRunErrors.js";

export const reachableExecutionSteps = (
  config: Pick<ProjectConfiguration, "loops">,
  rootLoopId: string
): Array<{ loopId: string; step: ProjectExecutionStep }> =>
  reachableLoops(config, rootLoopId).flatMap((loop) => loop.nodes.flatMap((node) =>
    !isProjectTerminalNode(node) && isProjectExecutionStep(node) ? [{ loopId: loop.id, step: node }] : []));

export const reachableLoops = (
  config: Pick<ProjectConfiguration, "loops">,
  rootLoopId: string
): ProjectLoop[] => {
  const loops = new Map(config.loops.map((loop) => [loop.id, loop]));
  const root = loops.get(rootLoopId);
  if (!root) throw new LoopRunNotFoundError(`Reachable Loop ${rootLoopId} was not found.`);
  const pending = [{ loopId: root.id, nodeId: root.start }];
  const visitedNodes = new Set<string>();
  const reachedLoops = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift()!;
    const key = nodeKey(current.loopId, current.nodeId);
    if (visitedNodes.has(key)) continue;
    visitedNodes.add(key);
    reachedLoops.add(current.loopId);
    const loop = loops.get(current.loopId);
    if (!loop) throw new LoopRunNotFoundError(`Reachable Loop ${current.loopId} was not found.`);
    const node = loop.nodes.find((candidate) => candidate.id === current.nodeId);
    if (!node) throw new LoopRunNotFoundError(`Reachable node ${current.loopId}:${current.nodeId} was not found.`);
    if (isProjectTerminalNode(node)) continue;
    for (const target of getProjectStepTransitionTargets(node)) {
      if (typeof target === "string") pending.push({ loopId: loop.id, nodeId: target });
      else {
        const targetLoop = loops.get(target.loop);
        if (!targetLoop) throw new LoopRunNotFoundError(`Reachable Loop ${target.loop} was not found.`);
        pending.push({ loopId: targetLoop.id, nodeId: targetLoop.start });
      }
    }
  }
  return config.loops
    .filter((loop) => reachedLoops.has(loop.id))
    .map((loop) => ({
      ...loop,
      nodes: loop.nodes.filter((node) => visitedNodes.has(nodeKey(loop.id, node.id)))
    }));
};

const nodeKey = (loopId: string, nodeId: string): string => `${loopId}\0${nodeId}`;
