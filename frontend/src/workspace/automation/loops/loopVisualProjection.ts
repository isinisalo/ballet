import type {
  Agent,
  AgentAvatar,
  AgentExecutionState,
  LoopRunDetails,
  LoopNodeSize,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectStep,
  StepRun,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import { getProjectStepTransitionEntries } from "@shared/api/workspace-contracts";
import type { LoopOutputTarget, LoopStepRecord } from "./loopGraph";
import { scheduleSummary } from "./loopSchedulePresentation";

export type LoopVisualStep = {
  id: string;
  displayId: string;
  description: string;
  agentId?: string;
  humanGate: boolean;
  scheduled: boolean;
  scheduleLabel?: string;
  nodeSize: LoopNodeSize;
  avatar?: AgentAvatar;
  reasoningEffort?: string;
  step: ProjectStep;
  stepRun?: StepRun;
};

export type LoopVisualLoop = {
  id: string;
  start: string;
  steps: string[];
};

export type LoopVisualConfig = {
  steps: LoopVisualStep[];
  loops: LoopVisualLoop[];
};

export type LoopVisualProjection = {
  config: LoopVisualConfig;
  stepByKey: Map<string, LoopVisualStep>;
  recordsByLoopId: Map<string, LoopStepRecord[]>;
};

export const visualStepKey = (loopId: string, stepId: string) => `${loopId}::${stepId}`;

export function buildLoopVisualProjection(
  config: ProjectAutomationConfig,
  displayedLoop: ProjectLoop,
  run?: LoopRunDetails | null,
  agents: Agent[] = [],
  agentExecutionStates: AgentExecutionState[] = []
): LoopVisualProjection {
  const loopDefinitions = config.loops.map((loop) => loop.id === displayedLoop.id ? displayedLoop : loop);
  const latestRunByStepId = latestStepRuns(run?.stepRuns ?? []);
  const avatarByAgentId = new Map(agents.map((agent) => [agent.id, agent.avatar]));
  const snapshotAvatarByStepKey = new Map((run?.executionPlan?.steps ?? []).map((snapshot) => [
    visualStepKey(snapshot.loopId, snapshot.stepId),
    snapshot.agent.avatar
  ]));
  const reasoningByAgentId = new Map(agentExecutionStates.map((state) => [state.agentId, state.reasoning]));
  const steps = loopDefinitions.flatMap((loop) => loop.steps.map((step) => ({
    id: visualStepKey(loop.id, step.id),
    displayId: step.id,
    description: step.description,
    agentId: step.type === "agent" ? step.agentId : undefined,
    humanGate: step.type === "human",
    scheduled: step.type === "scheduled",
    scheduleLabel: step.type === "scheduled" ? scheduleSummary(step.schedule) : undefined,
    nodeSize: step.nodeSize,
    avatar: step.type === "agent"
      ? run ? snapshotAvatarByStepKey.get(visualStepKey(loop.id, step.id)) : avatarByAgentId.get(step.agentId)
      : undefined,
    reasoningEffort: step.type === "agent" ? reasoningByAgentId.get(step.agentId) : undefined,
    step,
    stepRun: loop.id === displayedLoop.id ? latestRunByStepId.get(step.id) : undefined
  })));
  const stepByKey = new Map(steps.map((step) => [step.id, step]));
  const loops = loopDefinitions.map((loop) => ({
    id: loop.id,
    start: visualStepKey(loop.id, loop.start),
    steps: loop.steps.map((step) => visualStepKey(loop.id, step.id))
  }));
  const recordsByLoopId = new Map(loopDefinitions.map((loop) => {
    const records = loop.steps.map((projectStep, index): LoopStepRecord => {
      const stepKey = visualStepKey(loop.id, projectStep.id);
      const visualStep = stepByKey.get(stepKey);
      const outputTargets = getProjectStepTransitionEntries(projectStep).map(([result, target]) =>
        visualTarget(loop.id, result, target, loopDefinitions)
      );
      return {
        stepKey,
        index,
        loopId: loop.id,
        step: visualStep,
        outputEvents: outputTargets.map((target) => target.eventType),
        outputTargets
      };
    });
    const startRecord = records.find((record) => record.step?.displayId === loop.start);
    return [loop.id, startRecord ? [startRecord, ...records.filter((record) => record !== startRecord)] : records] as const;
  }));

  return { config: { steps, loops }, stepByKey, recordsByLoopId };
}

function visualTarget(
  sourceLoopId: string,
  result: string,
  target: StepTransitionTarget,
  loops: ProjectLoop[]
): LoopOutputTarget {
  if (typeof target === "string") {
    return {
      outputId: result,
      eventType: result,
      type: "step",
      targetLoopId: sourceLoopId,
      targetStepKey: visualStepKey(sourceLoopId, target)
    };
  }
  if ("loop" in target) {
    const targetLoop = loops.find((loop) => loop.id === target.loop);
    return {
      outputId: result,
      eventType: result,
      type: "step",
      targetLoopId: target.loop,
      targetStepKey: visualStepKey(target.loop, targetLoop?.start ?? "start")
    };
  }
  return {
    outputId: result,
    eventType: target.end,
    type: "event"
  };
}

function latestStepRuns(stepRuns: StepRun[]) {
  const latest = new Map<string, StepRun>();
  stepRuns.forEach((stepRun) => latest.set(stepRun.stepId, stepRun));
  return latest;
}
