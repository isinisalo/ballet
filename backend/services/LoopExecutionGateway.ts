import type { AppData } from "../../shared/api/workspaceData.js";
import { getProjectStepTransitionTargets } from "../../shared/domain/automation.js";
import type { LoopExecutionPlan, LoopRunDetails } from "../../shared/domain/runtime.js";

export interface LoopExecutionGateway {
  prepare(data: AppData, loopId: string): Promise<LoopExecutionPlan | undefined>;
  enqueuePending(data: AppData, rootRunId: string): Promise<void>;
  cancel(rootRunId: string): Promise<void>;
  finalizeIfTerminal(rootRunId: string): Promise<void>;
}

export const loopContainsAgentWork = (data: AppData, loopId: string): boolean => {
  const visited = new Set<string>();
  const pending = [loopId];
  while (pending.length > 0) {
    const next = pending.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    const loop = data.automation.loops.find((candidate) => candidate.id === next);
    if (!loop) continue;
    if (loop.steps.some((step) => step.type === "agent")) return true;
    for (const step of loop.steps) {
      for (const target of getProjectStepTransitionTargets(step)) {
        if (typeof target === "object" && "loop" in target) pending.push(target.loop);
      }
    }
  }
  return false;
};

export const rootRunIdOf = (details: LoopRunDetails): string => details.rootRunId;
