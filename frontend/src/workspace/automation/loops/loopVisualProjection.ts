import type {
  Agent,
  AgentAvatar,
  AgentExecutionState,
  LoopRunDetails,
  LoopNodeStyle,
  LoopNodeSize,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectLoopNode,
  StepRun,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import { getProjectStepTransitionEntries, getTransitionActionTargets, isProjectTerminalNode } from "@shared/api/workspace-contracts";
import type { LoopOutputTarget, LoopStepRecord } from "./loopGraph";
import { scheduleSummary } from "./loopSchedulePresentation";

export type LoopVisualStep = {
  id: string;
  displayId: string;
  description: string;
  agentId?: string;
  humanGate: boolean;
  scheduled: boolean;
  terminal: boolean;
  scheduleLabel?: string;
  nodeStyle: LoopNodeStyle;
  nodeSize: LoopNodeSize;
  avatar?: AgentAvatar;
  reasoningEffort?: string;
  step: ProjectLoopNode;
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
  const visibleNodeIdsByLoopId = new Map(loopDefinitions.map((loop) => [loop.id, reachableNodeIds(loop)]));
  const latestRunByStepId = latestStepRuns(run?.stepRuns ?? []);
  const avatarByAgentId = new Map(agents.map((agent) => [agent.id, agent.avatar]));
  const snapshotAvatarByStepKey = new Map((run?.executionPlan?.steps ?? []).map((snapshot) => [
    visualStepKey(snapshot.loopId, snapshot.stepId),
    snapshot.agent.avatar
  ]));
  const snapshotReasoningByStepKey = new Map((run?.executionPlan?.steps ?? []).map((snapshot) => [
    visualStepKey(snapshot.loopId, snapshot.stepId),
    snapshot.runtime.reasoning
  ]));
  const reasoningByAgentId = new Map(agentExecutionStates.map((state) => [state.agentId, state.reasoning]));
  const steps = loopDefinitions.flatMap((loop) => loop.nodes.map((node) => ({
    id: visualStepKey(loop.id, node.id),
    displayId: node.id,
    description: node.description,
    agentId: node.type === "agent" || node.type === "scheduled" ? node.agentId : undefined,
    humanGate: node.type === "human",
    scheduled: node.type === "scheduled",
    terminal: isProjectTerminalNode(node),
    scheduleLabel: node.type === "scheduled" ? scheduleSummary(node.schedule) : undefined,
    nodeStyle: node.nodeStyle,
    nodeSize: node.nodeSize,
    avatar: node.type === "agent"
      ? run ? snapshotAvatarByStepKey.get(visualStepKey(loop.id, node.id)) : avatarByAgentId.get(node.agentId)
      : undefined,
    reasoningEffort: node.type === "agent" || node.type === "scheduled"
      ? run
        ? snapshotReasoningByStepKey.get(visualStepKey(loop.id, node.id))
        : reasoningByAgentId.get(node.agentId)
      : undefined,
    step: node,
    stepRun: loop.id === displayedLoop.id ? latestRunByStepId.get(node.id) : undefined
  })));
  const stepByKey = new Map(steps.map((step) => [step.id, step]));
  const loops = loopDefinitions.map((loop) => ({
    id: loop.id,
    start: visualStepKey(loop.id, loop.start),
    steps: loop.nodes
      .filter((node) => !isProjectTerminalNode(node) || visibleNodeIdsByLoopId.get(loop.id)?.has(node.id))
      .map((node) => visualStepKey(loop.id, node.id))
  }));
  const recordsByLoopId = new Map(loopDefinitions.map((loop) => {
    const records = loop.nodes
      .filter((node) => !isProjectTerminalNode(node) || visibleNodeIdsByLoopId.get(loop.id)?.has(node.id))
      .map((projectNode, index): LoopStepRecord => {
      const stepKey = visualStepKey(loop.id, projectNode.id);
      const visualStep = stepByKey.get(stepKey);
      const outputTargets = isProjectTerminalNode(projectNode) ? [] : getProjectStepTransitionEntries(projectNode).flatMap(
        ([result, action]) => getTransitionActionTargets(action, projectNode.id).map((target, targetIndex) =>
          visualTarget(loop.id, projectNode.id, targetIndex === 0 ? result : `${result}.fallback-${targetIndex}`, target, loopDefinitions))
      );
      return {
        stepKey,
        index,
        loopId: loop.id,
        step: visualStep,
        outputTargets
      };
    });
    const startRecord = records.find((record) => record.step?.displayId === loop.start);
    return [loop.id, startRecord ? [startRecord, ...records.filter((record) => record !== startRecord)] : records] as const;
  }));

  return { config: { steps, loops }, stepByKey, recordsByLoopId };
}

function reachableNodeIds(loop: ProjectLoop): Set<string> {
  const nodesById = new Map(loop.nodes.map((node) => [node.id, node]));
  const reachable = new Set<string>();
  const pending = [loop.start];
  while (pending.length > 0) {
    const nodeId = pending.shift();
    if (!nodeId || reachable.has(nodeId)) continue;
    const node = nodesById.get(nodeId);
    if (!node) continue;
    reachable.add(nodeId);
    if (isProjectTerminalNode(node)) continue;
    getProjectStepTransitionEntries(node).forEach(([, action]) => {
      getTransitionActionTargets(action, node.id).forEach((target) => {
        if (typeof target === "string") pending.push(target);
      });
    });
  }
  return reachable;
}

function visualTarget(
  sourceLoopId: string,
  sourceStepId: string,
  result: string,
  target: StepTransitionTarget,
  loops: ProjectLoop[]
): LoopOutputTarget {
  const eventType = `${visualStepKey(sourceLoopId, sourceStepId)}::${result}`;
  if (typeof target === "string") {
    return {
      outputId: result,
      eventType,
      type: "step",
      targetLoopId: sourceLoopId,
      targetStepKey: visualStepKey(sourceLoopId, target)
    };
  }
  if ("loop" in target) {
    const targetLoop = loops.find((loop) => loop.id === target.loop);
    return {
      outputId: result,
      eventType,
      type: "step",
      targetLoopId: target.loop,
      targetStepKey: visualStepKey(target.loop, targetLoop?.start ?? "start")
    };
  }
  throw new Error("Unsupported transition target.");
}

function latestStepRuns(stepRuns: StepRun[]) {
  const latest = new Map<string, StepRun>();
  stepRuns.forEach((stepRun) => latest.set(stepRun.stepId, stepRun));
  return latest;
}
