import { createHash } from "node:crypto";
import type { AppData } from "../../shared/api/workspaceData.js";
import type { Agent } from "../../shared/domain/agents.js";
import { getProjectStepTransitionTargets, type ProjectStep } from "../../shared/domain/automation.js";
import type { ExecutionAgentSnapshot } from "../../shared/domain/runtime.js";

export const agentSnapshot = (agent: Agent): ExecutionAgentSnapshot => ({
  id: agent.id,
  name: agent.name,
  description: agent.description,
  instructions: [agent.instructions, ...agent.skills.map((skill) => skill.body ?? "")]
    .filter(Boolean)
    .join("\n\n"),
  skillIds: agent.skills.map((skill) => skill.id),
  avatar: agent.avatar,
  configHash: createHash("sha256").update(JSON.stringify(agent)).digest("hex")
});

export const reachableAgentSteps = (
  data: AppData,
  rootLoopId: string
): Array<{ loopId: string; step: Extract<ProjectStep, { type: "agent" }> }> => {
  const loops = new Map(data.automation.loops.map((loop) => [loop.id, loop]));
  const pending = [rootLoopId];
  const visited = new Set<string>();
  const result: Array<{ loopId: string; step: Extract<ProjectStep, { type: "agent" }> }> = [];
  while (pending.length > 0) {
    const loopId = pending.shift()!;
    if (visited.has(loopId)) continue;
    visited.add(loopId);
    const loop = loops.get(loopId);
    if (!loop) continue;
    for (const step of loop.steps) {
      if (step.type === "agent") result.push({ loopId, step });
      for (const target of getProjectStepTransitionTargets(step)) {
        if (typeof target === "object" && "loop" in target) pending.push(target.loop);
      }
    }
  }
  return result;
};
