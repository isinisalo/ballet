import type { AppData } from "../../shared/api/workspaceData.js";
import type { AgentRuntimeConfiguration } from "../../shared/domain/runtime.js";
import { getProjectStepTransitionTargets } from "../../shared/domain/automation.js";
import type { RunTarget, RunTargetsResponse } from "../../shared/domain/runs.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { RootRunStore } from "./RootRunStore.js";

export class LocalRunTargetService {
  constructor(
    private readonly roots: RootRunStore,
    private readonly configurations: RuntimeConfigurationService
  ) {}

  async list(
    data: Pick<AppData, "agents" | "automation" | "automationIssues">,
    configurations: Record<string, AgentRuntimeConfiguration>
  ): Promise<RunTargetsResponse> {
    const agents: RunTarget[] = await Promise.all(data.agents.map(async (agent) => {
      const configuration = configurations[agent.id] ?? await this.configurations.get(agent.id);
      const issues = [
        ...configuration.issues.map((issue) => ({ code: "invalid_config" as const, message: issue.message, agentId: agent.id, path: issue.path })),
        ...(!agent.enabled ? [{ code: "disabled" as const, message: "Agent is disabled.", agentId: agent.id }] : [])
      ];
      return target(this.roots, "agent", agent.id, agent.name, agent.description, issues);
    }));
    const loops: RunTarget[] = await Promise.all(data.automation.loops.map(async (loop) => {
      const issues: RunTarget["issues"] = data.automationIssues.map((issue) => ({
        code: "invalid_config", message: issue.message, path: issue.path
      }));
      for (const agentId of reachableAgentIds(data, loop.id)) {
        const agent = data.agents.find((candidate) => candidate.id === agentId);
        if (!agent) issues.push({ code: "missing_agent", message: `Agent ${agentId} does not exist.`, agentId });
        else {
          const configuration = configurations[agentId] ?? await this.configurations.get(agentId);
          issues.push(...configuration.issues.map((issue) => ({
            code: "invalid_config" as const, message: issue.message, agentId, path: issue.path
          })));
        }
      }
      return target(this.roots, "loop", loop.id, loop.id, undefined, issues);
    }));
    return { loops, agents };
  }
}

const target = (
  roots: RootRunStore,
  kind: "agent" | "loop",
  id: string,
  name: string,
  description: string | undefined,
  issues: RunTarget["issues"]
): RunTarget => ({
  kind, id, name, description, ready: issues.length === 0, issues,
  activeRootRunId: roots.active(kind, id)?.rootRunId,
  latestRootRunId: roots.latest(kind, id)?.rootRunId
});

const reachableAgentIds = (data: Pick<AppData, "automation">, rootLoopId: string): string[] => {
  const pending = [rootLoopId];
  const visited = new Set<string>();
  const ids = new Set<string>();
  while (pending.length) {
    const loopId = pending.shift()!;
    if (visited.has(loopId)) continue;
    visited.add(loopId);
    const loop = data.automation.loops.find((candidate) => candidate.id === loopId);
    if (!loop) continue;
    for (const step of loop.steps) {
      if (step.type === "agent") ids.add(step.agentId);
      for (const transition of getProjectStepTransitionTargets(step)) {
        if (typeof transition === "object" && "loop" in transition) pending.push(transition.loop);
      }
    }
  }
  return [...ids];
};
