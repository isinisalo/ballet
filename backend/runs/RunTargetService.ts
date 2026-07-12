import type { AppData } from "../../shared/api/workspaceData.js";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import { getProjectStepTransitionTargets } from "../../shared/domain/automation.js";
import type { RunTargetIssue, RunTargetsResponse } from "../../shared/domain/runs.js";
import type { RuntimePreflightIssue } from "../../shared/domain/runtime.js";
import type { RunReadModelService } from "./RunReadModelService.js";

export interface TargetPreflightResult {
  ok: boolean;
  deviceId?: string;
  issues: RuntimePreflightIssue[];
}

export interface RunTargetServiceOptions {
  readData: () => Promise<AppData>;
  runs: RunReadModelService;
  preflightAgent: (agentId: string) => TargetPreflightResult;
}

export class RunTargetService {
  constructor(private readonly options: RunTargetServiceOptions) {}

  async list(): Promise<RunTargetsResponse> {
    const data = await this.options.readData();
    const active = this.options.runs.list({ state: "active", limit: 200 }).items;
    const activeRoot = (kind: "loop" | "agent", id: string) =>
      active.find((run) => run.kind === kind && run.targetId === id)?.rootRunId;
    const agents = data.agents.map((agent) => {
      const issues = this.agentIssues(agent);
      return {
        kind: "agent" as const,
        id: agent.id,
        name: agent.name,
        description: agent.description,
        ready: issues.length === 0,
        issues,
        activeRootRunId: activeRoot("agent", agent.id)
      };
    });
    const loops = data.automation.loops.map((loop) => {
      const issues = this.loopIssues(data, loop);
      return {
        kind: "loop" as const,
        id: loop.id,
        name: loop.id,
        ready: issues.length === 0,
        issues,
        activeRootRunId: activeRoot("loop", loop.id)
      };
    });
    return { loops, agents };
  }

  private agentIssues(agent: Agent): RunTargetIssue[] {
    if (!agent.enabled) return [{ code: "disabled", agentId: agent.id, message: "Agent is disabled." }];
    return this.options.preflightAgent(agent.id).issues;
  }

  private loopIssues(data: AppData, root: ProjectLoop): RunTargetIssue[] {
    if (data.automationIssues.length > 0) {
      return data.automationIssues.map((issue) => ({ code: "invalid_config", path: issue.path, message: issue.message }));
    }
    const entries = reachableAgentSteps(data, root.id);
    const issues: RunTargetIssue[] = [];
    const deviceIds = new Set<string>();
    for (const entry of entries) {
      const agent = data.agents.find((candidate) => candidate.id === entry.agentId);
      if (!agent) {
        issues.push({ code: "missing_agent", agentId: entry.agentId, stepId: entry.stepId, message: `Agent ${entry.agentId} was not found.` });
        continue;
      }
      if (!agent.enabled) {
        issues.push({ code: "disabled", agentId: agent.id, stepId: entry.stepId, message: `Agent ${agent.id} is disabled.` });
        continue;
      }
      const result = this.options.preflightAgent(agent.id);
      if (result.deviceId) deviceIds.add(result.deviceId);
      issues.push(...result.issues.map((issue) => ({ ...issue, stepId: entry.stepId })));
    }
    if (deviceIds.size > 1) {
      issues.push(...entries.map((entry) => ({
        code: "mixed_device" as const,
        agentId: entry.agentId,
        stepId: entry.stepId,
        message: "Every agent step in one root Loop Run must use the same runtime device."
      })));
    }
    return issues;
  }
}

const reachableAgentSteps = (data: AppData, rootLoopId: string): Array<{ agentId: string; stepId: string }> => {
  const result: Array<{ agentId: string; stepId: string }> = [];
  const pending = [rootLoopId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const loopId = pending.shift();
    if (!loopId || visited.has(loopId)) continue;
    visited.add(loopId);
    const loop = data.automation.loops.find((candidate) => candidate.id === loopId);
    if (!loop) continue;
    for (const step of loop.steps) {
      if (step.type === "agent") result.push({ agentId: step.agentId, stepId: `${loop.id}:${step.id}` });
      for (const target of getProjectStepTransitionTargets(step)) {
        if (typeof target === "object" && "loop" in target) pending.push(target.loop);
      }
    }
  }
  return result;
};
