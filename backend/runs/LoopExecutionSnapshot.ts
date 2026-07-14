import { createHash } from "node:crypto";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { Agent } from "../../shared/domain/agents.js";
import {
  getProjectStepTransitionTargets,
  isProjectTerminalNode,
  type ProjectAgentBackedStep,
  type ProjectLoop
} from "../../shared/domain/automation.js";
import type { ExecutionAgentSnapshot } from "../../shared/domain/runtime.js";

export const agentSnapshot = (agent: Agent): ExecutionAgentSnapshot => ({
  id: agent.id,
  name: agent.name,
  description: agent.description,
  instructions: [agent.instructions, ...agent.skills.filter((skill) => skill.enabled !== false)
    .map((skill) => skill.body ?? "")]
    .filter(Boolean)
    .join("\n\n"),
  skillIds: agent.skills.filter((skill) => skill.enabled !== false).map((skill) => skill.id),
  avatar: agent.avatar,
  configHash: createHash("sha256").update(JSON.stringify(agent)).digest("hex")
});

export const reachableAgentSteps = (
  data: Pick<AppData, "automation">,
  rootLoopId: string
): Array<{ loopId: string; step: ProjectAgentBackedStep }> =>
  reachableLoops(data, rootLoopId).flatMap((loop) => loop.nodes.flatMap((node) =>
    !isProjectTerminalNode(node) && node.type !== "human" ? [{ loopId: loop.id, step: node }] : []));

export const reachableLoops = (
  data: Pick<AppData, "automation">,
  rootLoopId: string
): ProjectLoop[] => {
  const loops = new Map(data.automation.loops.map((loop) => [loop.id, loop]));
  const pending = [rootLoopId];
  const visited = new Set<string>();
  const result: ProjectLoop[] = [];
  while (pending.length > 0) {
    const loopId = pending.shift()!;
    if (visited.has(loopId)) continue;
    visited.add(loopId);
    const loop = loops.get(loopId);
    if (!loop) continue;
    result.push(loop);
    for (const step of loop.nodes) {
      if (isProjectTerminalNode(step)) continue;
      for (const target of getProjectStepTransitionTargets(step)) {
        if (typeof target === "object" && "loop" in target) pending.push(target.loop);
      }
    }
  }
  return result;
};

export const relevantLoopThemeIssues = (
  data: Pick<AppData, "automation" | "loopThemeIssues">,
  rootLoopId: string
) => {
  void rootLoopId;
  return data.loopThemeIssues;
};
