import { createHash } from "node:crypto";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { Agent } from "../../shared/domain/agents.js";
import { getProjectStepTransitionTargets, type ProjectLoop, type ProjectStep } from "../../shared/domain/automation.js";
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
): Array<{ loopId: string; step: Extract<ProjectStep, { type: "agent" }> }> =>
  reachableLoops(data, rootLoopId).flatMap((loop) => loop.steps.flatMap((step) =>
    step.type === "agent" ? [{ loopId: loop.id, step }] : []));

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
    for (const step of loop.steps) {
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
  const loops = reachableLoops(data, rootLoopId);
  const loopIds = new Set(loops.map((loop) => loop.id));
  const themeIds = new Set(loops.map((loop) => loop.theme));
  return data.loopThemeIssues.filter((issue) =>
    (issue.loopId && loopIds.has(issue.loopId)) || (issue.themeId && themeIds.has(issue.themeId)));
};
