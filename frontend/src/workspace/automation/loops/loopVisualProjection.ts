import {
  defaultLoopNodeStyle,
  getProjectNodeEdges,
  isProjectAgentValidationNode,
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
import type { LoopNodeRecord, LoopOutputTarget } from "./loopGraph";

export interface LoopVisualTerminal {
  id: LoopTerminal;
  type: "terminal";
  terminal: LoopTerminal;
}

export type LoopVisualNode = {
  id: string;
  displayId: string;
  description: string;
  terminal: boolean;
  nodeStyle: LoopNodeStyle;
  nodeSize: LoopNodeSize;
  workReasoningEffort?: string;
  validationReasoningEffort?: string;
  definition: ProjectWorkLoopNode | LoopVisualTerminal;
  workLoopNodeRun?: WorkLoopNodeRun;
};

export type LoopVisualLoop = { id: string; description: string; start: string; nodes: string[] };
export type LoopVisualConfig = { nodes: LoopVisualNode[]; loops: LoopVisualLoop[] };
export type LoopVisualProjection = {
  config: LoopVisualConfig;
  nodeByKey: Map<string, LoopVisualNode>;
  recordsByLoopId: Map<string, LoopNodeRecord[]>;
};

export const visualNodeKey = (loopId: string, nodeId: string) => `${loopId}::${nodeId}`;

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
  const nodes = [...nodesByLoop.values()].flat();
  const nodeByKey = new Map(nodes.map((node) => [node.id, node]));
  const visualLoops = loops.map((loop) => ({
    id: loop.id,
    description: loop.description,
    start: visualNodeKey(loop.id, loop.startNodeId),
    nodes: (nodesByLoop.get(loop.id) ?? []).map((node) => node.id)
  }));
  const recordsByLoopId = new Map(loops.map((loop) => {
    const visual = nodesByLoop.get(loop.id) ?? [];
    const records = visual.map((node, index): LoopNodeRecord => ({
      nodeKey: node.id,
      index,
      loopId: loop.id,
      node,
      outputTargets: node.terminal ? [] : getProjectNodeEdges(loop, node.displayId).map((edge) => ({
        outputId: "ok",
        eventType: `validation.ok.${edge.id}`,
        type: "node",
        targetLoopId: loop.id,
        targetNodeKey: visualNodeKey(loop.id, isProjectNodeTerminalTarget(edge.target)
          ? edge.target.terminal
          : edge.target.nodeId)
      } satisfies LoopOutputTarget))
    }));
    const start = records.find((record) => record.node?.displayId === loop.startNodeId);
    return [loop.id, start ? [start, ...records.filter((record) => record !== start)] : records] as const;
  }));
  return { config: { nodes, loops: visualLoops }, nodeByKey, recordsByLoopId };
}

const visualNodes = (
  loop: ProjectLoop,
  latestRuns: ReadonlyMap<string, WorkLoopNodeRun>,
  reasoning: ReadonlyMap<string, string>
): LoopVisualNode[] => {
  const nodes = loop.nodes.map((node): LoopVisualNode => {
    const work = node.work;
    const providerWork = isProjectProviderWorkNode(work);
    return {
      id: visualNodeKey(loop.id, node.id),
      displayId: node.id,
      description: node.description,
      terminal: false,
      nodeStyle: work.nodeStyle,
      nodeSize: work.nodeSize,
      workReasoningEffort: providerWork ? reasoning.get(work.executionProfileId) : undefined,
      validationReasoningEffort: isProjectAgentValidationNode(node.validation)
        ? reasoning.get(node.validation.executionProfileId)
        : undefined,
      definition: node,
      workLoopNodeRun: latestRuns.get(node.id)
    };
  });
  const terminals = [...new Set(loop.edges.flatMap((edge) =>
    isProjectNodeTerminalTarget(edge.target) ? [edge.target.terminal] : []))];
  return [...nodes, ...terminals.map((terminal): LoopVisualNode => ({
    id: visualNodeKey(loop.id, terminal),
    displayId: terminal,
    description: `${terminal} Loop terminal`,
    terminal: true,
    nodeStyle: defaultLoopNodeStyle,
    nodeSize: "tiny",
    definition: { id: terminal, type: "terminal", terminal }
  }))];
};

const latestWorkLoopNodeRuns = (runs: WorkLoopNodeRun[]): Map<string, WorkLoopNodeRun> => {
  const latest = new Map<string, WorkLoopNodeRun>();
  runs.forEach((run) => latest.set(run.workLoopNodeId, run));
  return latest;
};
