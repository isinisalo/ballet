import {
  defaultLoopNodeStyle,
  getProjectNodeEdges,
  isProjectNodeTerminalTarget,
  isProjectProviderWorkNode,
  type ExecutionProfile,
  type LoopNodeSize,
  type LoopNodeStyle,
  type LoopRunDetails,
  type LoopTerminal,
  type ProjectAutomationConfig,
  type ProjectLoop,
  type ProjectWorkLoopNode,
  type WorkLoopNodeRun
} from "@shared/api/workspace-contracts";
import type { LoopOutputTarget, LoopStepRecord } from "./loopGraph";
import { scheduleSummary } from "./loopSchedulePresentation";

export interface LoopVisualTerminal {
  id: LoopTerminal;
  type: "terminal";
  terminal: LoopTerminal;
}

export type LoopVisualStep = {
  id: string;
  displayId: string;
  description: string;
  executionProfileId?: string;
  humanGate: boolean;
  scheduled: boolean;
  terminal: boolean;
  scheduleLabel?: string;
  nodeStyle: LoopNodeStyle;
  nodeSize: LoopNodeSize;
  reasoningEffort?: string;
  step: ProjectWorkLoopNode | LoopVisualTerminal;
  workLoopNodeRun?: WorkLoopNodeRun;
};

export type LoopVisualLoop = { id: string; start: string; steps: string[] };
export type LoopVisualConfig = { steps: LoopVisualStep[]; loops: LoopVisualLoop[] };
export type LoopVisualProjection = {
  config: LoopVisualConfig;
  stepByKey: Map<string, LoopVisualStep>;
  recordsByLoopId: Map<string, LoopStepRecord[]>;
};

export const visualStepKey = (loopId: string, nodeId: string) => `${loopId}::${nodeId}`;

export function buildLoopVisualProjection(
  config: ProjectAutomationConfig,
  displayedLoop: ProjectLoop,
  run?: LoopRunDetails | null,
  executionProfiles: ExecutionProfile[] = [],
  availableExecutionProfileIds?: ReadonlySet<string>
): LoopVisualProjection {
  const loops = config.loops.map((loop) => loop.id === displayedLoop.id ? displayedLoop : loop);
  const latestRuns = latestWorkLoopNodeRuns(run?.workLoopNodeRuns ?? []);
  const reasoning = new Map(executionProfiles
    .filter((profile) => !availableExecutionProfileIds || availableExecutionProfileIds.has(profile.id))
    .map((profile) => [profile.id, profile.reasoningEffort]));
  const nodesByLoop = new Map(loops.map((loop) => [loop.id, visualNodes(loop, latestRuns, reasoning)]));
  const steps = [...nodesByLoop.values()].flat();
  const stepByKey = new Map(steps.map((step) => [step.id, step]));
  const visualLoops = loops.map((loop) => ({
    id: loop.id,
    start: visualStepKey(loop.id, loop.startNodeId),
    steps: (nodesByLoop.get(loop.id) ?? []).map((step) => step.id)
  }));
  const recordsByLoopId = new Map(loops.map((loop) => {
    const visual = nodesByLoop.get(loop.id) ?? [];
    const records = visual.map((step, index): LoopStepRecord => ({
      stepKey: step.id,
      index,
      loopId: loop.id,
      step,
      outputTargets: step.terminal ? [] : getProjectNodeEdges(loop, step.displayId).map((edge) => ({
        outputId: "ok",
        eventType: `validation.ok.${edge.id}`,
        type: "step",
        targetLoopId: loop.id,
        targetStepKey: visualStepKey(loop.id, isProjectNodeTerminalTarget(edge.target)
          ? edge.target.terminal
          : edge.target.nodeId)
      } satisfies LoopOutputTarget))
    }));
    const start = records.find((record) => record.step?.displayId === loop.startNodeId);
    return [loop.id, start ? [start, ...records.filter((record) => record !== start)] : records] as const;
  }));
  return { config: { steps, loops: visualLoops }, stepByKey, recordsByLoopId };
}

const visualNodes = (
  loop: ProjectLoop,
  latestRuns: ReadonlyMap<string, WorkLoopNodeRun>,
  reasoning: ReadonlyMap<string, string>
): LoopVisualStep[] => {
  const nodes = loop.nodes.map((node): LoopVisualStep => {
    const work = node.work;
    const providerWork = isProjectProviderWorkNode(work);
    return {
      id: visualStepKey(loop.id, node.id),
      displayId: node.id,
      description: node.description,
      executionProfileId: providerWork ? work.executionProfileId : undefined,
      humanGate: work.type === "human" || node.validation.type === "human",
      scheduled: work.type === "scheduled",
      terminal: false,
      scheduleLabel: work.type === "scheduled" ? scheduleSummary(work.schedule) : undefined,
      nodeStyle: work.nodeStyle,
      nodeSize: work.nodeSize,
      reasoningEffort: providerWork ? reasoning.get(work.executionProfileId) : undefined,
      step: node,
      workLoopNodeRun: latestRuns.get(node.id)
    };
  });
  const terminals = [...new Set(loop.edges.flatMap((edge) =>
    isProjectNodeTerminalTarget(edge.target) ? [edge.target.terminal] : []))];
  return [...nodes, ...terminals.map((terminal): LoopVisualStep => ({
    id: visualStepKey(loop.id, terminal),
    displayId: terminal,
    description: `${terminal} Loop terminal`,
    humanGate: false,
    scheduled: false,
    terminal: true,
    nodeStyle: defaultLoopNodeStyle,
    nodeSize: "tiny",
    step: { id: terminal, type: "terminal", terminal }
  }))];
};

const latestWorkLoopNodeRuns = (runs: WorkLoopNodeRun[]): Map<string, WorkLoopNodeRun> => {
  const latest = new Map<string, WorkLoopNodeRun>();
  runs.forEach((run) => latest.set(run.workLoopNodeId, run));
  return latest;
};
