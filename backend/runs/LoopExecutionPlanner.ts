import type { AppData } from "../../shared/api/workspaceData.js";
import type { LoopExecutionPlan } from "../../shared/domain/runtime.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { agentSnapshot, reachableAgentSteps } from "./LoopExecutionSnapshot.js";

export class LoopExecutionPlanner {
  constructor(
    private readonly configurations: RuntimeConfigurationService,
    private readonly runtime: LocalRuntimeService
  ) {}

  async create(data: AppData, loopId: string): Promise<LoopExecutionPlan | undefined> {
    const steps = reachableAgentSteps(data, loopId);
    if (steps.length === 0) return undefined;
    const snapshots: LoopExecutionPlan["steps"] = [];
    let project: LoopExecutionPlan["project"] | undefined;
    for (const entry of steps) {
      const agent = data.agents.find((candidate) =>
        candidate.id === entry.step.agentId && candidate.enabled);
      if (!agent) throw new Error(`Agent ${entry.step.agentId} was not found or is disabled.`);
      const configuration = await this.configurations.get(agent.id);
      if (!configuration.resolved) {
        throw new Error(configuration.issues[0]?.message ?? `Agent ${agent.id} is not configured.`);
      }
      const preflight = await this.runtime.preflight(configuration.resolved);
      if (project && (project.headSha !== preflight.project.headSha
        || project.configHash !== preflight.project.configHash)) {
        throw new Error("Checkout changed during Loop preflight.");
      }
      project ??= preflight.project;
      snapshots.push({
        loopId: entry.loopId,
        stepId: entry.step.id,
        agentId: agent.id,
        agent: agentSnapshot(agent),
        runtime: preflight.runtime
      });
    }
    return {
      version: 1,
      rootLoopId: loopId,
      project: project!,
      steps: snapshots,
      createdAt: new Date().toISOString()
    };
  }
}
