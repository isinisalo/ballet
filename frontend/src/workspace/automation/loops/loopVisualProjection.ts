import type {
  LoopRunDetails,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectStep,
  StepRun,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import type { LoopOutputTarget, LoopStepRecord } from "./loopGraph";

export type LoopVisualStep = {
  id: string;
  displayId: string;
  description: string;
  agentId?: string;
  humanGate: boolean;
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
  run?: LoopRunDetails | null
): LoopVisualProjection {
  const loopDefinitions = config.loops.map((loop) => loop.id === displayedLoop.id ? displayedLoop : loop);
  const latestRunByStepId = latestStepRuns(run?.stepRuns ?? []);
  const steps = loopDefinitions.flatMap((loop) => loop.steps.map((step) => ({
    id: visualStepKey(loop.id, step.id),
    displayId: step.id,
    description: step.description,
    agentId: step.type === "agent" ? step.agentId : undefined,
    humanGate: step.type === "human",
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
      const outputTargets = (["approved", "rejected"] as const).map((result) =>
        visualTarget(loop.id, result, projectStep.on[result], loopDefinitions)
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
  result: "approved" | "rejected",
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
