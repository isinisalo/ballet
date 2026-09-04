import dagre from "@dagrejs/dagre";
import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { orderedActions, orderedStates } from "@shared/orchestration/gates";
import { CONTRACT_LIMITS } from "@shared/orchestration/limits";
import type { CanvasSurfaceSize } from "./useCanvasSurfaceSize";
import { actionDisplayName } from "../actionDisplayName";

export type LoopEngineeringNodeKind =
  | "state"
  | "create-state"
  | "action"
  | "create-action"
  | "validation-agent"
  | "work-agent";

export interface LoopEngineeringNode {
  id: string;
  kind: LoopEngineeringNodeKind;
  entityId?: string;
  label: string;
  ariaLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  disabledReason?: string;
}

export interface LoopEngineeringEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: "right" | "bottom";
  targetHandle: "left" | "top";
  tone: "order" | "branch" | "selected";
  routing: "smoothstep" | "floating-smooth";
}

export interface LoopEngineeringProjection {
  width: number;
  height: number;
  nodes: LoopEngineeringNode[];
  edges: LoopEngineeringEdge[];
}

export interface LoopEngineeringProjectionOptions {
  locked?: boolean;
  selectedAgentRole?: "validation" | "work";
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 52;
const NODE_GAP = 36;
const RANK_GAP = 144;
const SIDE_MARGIN = 24;
const HEADER_ALLOWANCE = 52;
const MIN_WIDTH = 560;
const MIN_HEIGHT = 420;
const VIRTUAL_ROOT = "__environment-root";

export function projectLoopEngineering(
  environment: EnvironmentDefinition,
  selectedStateId?: string,
  selectedActionId?: string,
  surface: CanvasSurfaceSize = { width: 0, height: 0 },
  options: LoopEngineeringProjectionOptions = {},
): LoopEngineeringProjection {
  const states = orderedStates(environment.states);
  const selectedState = states.find(({ id }) => id === selectedStateId);
  const actions = selectedState ? orderedActions(selectedState.actions) : [];
  const selectedAction = actions.find(({ id }) => id === selectedActionId);
  const createStateReason = createReason(options.locked, states.length >= CONTRACT_LIMITS.states, "State");
  const createActionReason = createReason(options.locked, actions.length >= CONTRACT_LIMITS.actionsPerState, "Action");
  const nodes: LoopEngineeringNode[] = [
    ...states.map((state): LoopEngineeringNode => makeNode({
      id: `state:${state.id}`, kind: "state", entityId: state.id, label: state.name,
      ariaLabel: `Open State ${state.id}: ${state.name}`, selected: state.id === selectedStateId,
    })),
    makeNode({ id: "create:state", kind: "create-state", label: "+ STATE",
      ariaLabel: createStateReason ?? "Create State", disabledReason: createStateReason }),
    ...actions.map((action): LoopEngineeringNode => makeNode({
      id: `action:${action.id}`, kind: "action", entityId: action.id, label: actionDisplayName(action.name, selectedState?.name),
      ariaLabel: `Open Action ${action.id}: ${action.name}`, selected: action.id === selectedActionId,
    })),
    ...(selectedState ? [makeNode({ id: `create:action:${selectedState.id}`, kind: "create-action", label: "+ ACTION",
      ariaLabel: createActionReason ?? `Create Action in State ${selectedState.id}`, disabledReason: createActionReason })] : []),
    ...(selectedAction ? [
      makeNode({ id: `agent:${selectedAction.id}:validation`, kind: "validation-agent", entityId: selectedAction.validation.agentId,
        label: "Validation Agent", ariaLabel: `Open Validation Agent for Action ${selectedAction.id}`,
        selected: options.selectedAgentRole === "validation" }),
      makeNode({ id: `agent:${selectedAction.id}:work`, kind: "work-agent", entityId: selectedAction.work.agentId,
        label: "Work Agent", ariaLabel: `Open Work Agent for Action ${selectedAction.id}`,
        selected: options.selectedAgentRole === "work" }),
    ] : []),
  ];
  const graph = buildDagreGraph(nodes, selectedState?.id, selectedAction?.id);
  const stateIds = nodes.filter(({ kind }) => kind === "state" || kind === "create-state").map(({ id }) => id);
  const actionIds = nodes.filter(({ kind }) => kind === "action" || kind === "create-action").map(({ id }) => id);
  const agentIds = nodes.filter(({ kind }) => kind.endsWith("-agent")).map(({ id }) => id);
  const stateX = rankX(graph, stateIds, SIDE_MARGIN);
  const actionX = rankX(graph, actionIds, stateX + NODE_WIDTH + RANK_GAP);
  const agentX = rankX(graph, agentIds, actionX + NODE_WIDTH + RANK_GAP);
  placeColumn(nodes, actionIds, actionX, HEADER_ALLOWANCE);
  const actionCenter = columnCenter(nodes, actionIds);
  const stateStart = selectedState && actionCenter !== undefined
    ? alignedColumnStart(stateIds, `state:${selectedState.id}`, actionCenter)
    : HEADER_ALLOWANCE;
  placeColumn(nodes, stateIds, stateX, stateStart);
  const selectedActionNode = nodes.find(({ id }) => id === `action:${selectedAction?.id}`);
  const agentStart = selectedActionNode
    ? centeredColumnStart(agentIds.length, selectedActionNode.y + selectedActionNode.height / 2)
    : HEADER_ALLOWANCE;
  placeColumn(nodes, agentIds, agentX, agentStart);
  const edges = projectedEdges(states.map(({ id }) => id), selectedState?.id, actions.map(({ id }) => id), selectedAction?.id);
  const contentHeight = Math.max(...nodes.map(({ y, height }) => y + height), MIN_HEIGHT - SIDE_MARGIN) + SIDE_MARGIN;
  return {
    width: Math.max(MIN_WIDTH, surface.width, agentX + NODE_WIDTH + SIDE_MARGIN),
    height: Math.max(MIN_HEIGHT, surface.height, contentHeight),
    nodes,
    edges,
  };
}

function makeNode(value: Omit<LoopEngineeringNode, "x" | "y" | "width" | "height" | "selected"> & { selected?: boolean }): LoopEngineeringNode {
  return { ...value, x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT, selected: value.selected ?? false };
}

function buildDagreGraph(nodes: LoopEngineeringNode[], selectedStateId?: string, selectedActionId?: string) {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", ranksep: RANK_GAP, nodesep: NODE_GAP, marginx: SIDE_MARGIN, marginy: SIDE_MARGIN });
  graph.setNode(VIRTUAL_ROOT, { width: 1, height: 1 });
  for (const item of nodes) graph.setNode(item.id, { width: item.width, height: item.height });
  for (const item of nodes.filter(({ kind }) => kind === "state" || kind === "create-state")) graph.setEdge(VIRTUAL_ROOT, item.id);
  if (selectedStateId) for (const item of nodes.filter(({ kind }) => kind === "action" || kind === "create-action")) graph.setEdge(`state:${selectedStateId}`, item.id);
  if (selectedActionId) for (const item of nodes.filter(({ kind }) => kind.endsWith("-agent"))) graph.setEdge(`action:${selectedActionId}`, item.id);
  dagre.layout(graph);
  return graph;
}

function rankX(graph: InstanceType<typeof dagre.graphlib.Graph>, ids: string[], fallback: number): number {
  const center = ids[0] ? (graph.node(ids[0]) as { x?: number } | undefined)?.x : undefined;
  return typeof center === "number" ? center - NODE_WIDTH / 2 : fallback;
}

function placeColumn(nodes: LoopEngineeringNode[], ids: string[], x: number, startY: number) {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  ids.forEach((id, index) => {
    const item = byId.get(id);
    if (item) { item.x = x; item.y = startY + index * (NODE_HEIGHT + NODE_GAP); }
  });
}

function columnCenter(nodes: LoopEngineeringNode[], ids: string[]): number | undefined {
  const items = ids.map((id) => nodes.find((item) => item.id === id)).filter((item): item is LoopEngineeringNode => Boolean(item));
  const first = items[0];
  const last = items.at(-1);
  return first && last ? (first.y + first.height / 2 + last.y + last.height / 2) / 2 : undefined;
}

function alignedColumnStart(ids: string[], alignedId: string, targetCenter: number): number {
  const index = Math.max(ids.indexOf(alignedId), 0);
  return Math.max(HEADER_ALLOWANCE, targetCenter - NODE_HEIGHT / 2 - index * (NODE_HEIGHT + NODE_GAP));
}

function centeredColumnStart(count: number, targetCenter: number): number {
  const span = count > 0 ? NODE_HEIGHT + (count - 1) * (NODE_HEIGHT + NODE_GAP) : 0;
  return Math.max(HEADER_ALLOWANCE, targetCenter - span / 2);
}

function projectedEdges(stateIds: string[], selectedStateId: string | undefined, actionIds: string[], selectedActionId?: string): LoopEngineeringEdge[] {
  const edges: LoopEngineeringEdge[] = [];
  const orderedStateNodes = [...stateIds.map((id) => `state:${id}`), "create:state"];
  orderedStateNodes.slice(1).forEach((target, index) => edges.push({
    id: `state-order:${index}`, source: orderedStateNodes[index]!, target, sourceHandle: "bottom", targetHandle: "top", tone: "order", routing: "smoothstep",
  }));
  if (selectedStateId) {
    for (const actionId of actionIds) edges.push({
      id: `state:${selectedStateId}:action:${actionId}`, source: `state:${selectedStateId}`, target: `action:${actionId}`,
      sourceHandle: "right", targetHandle: "left", tone: actionId === selectedActionId ? "selected" : "branch", routing: "floating-smooth",
    });
    edges.push({ id: `state:${selectedStateId}:create-action`, source: `state:${selectedStateId}`, target: `create:action:${selectedStateId}`,
      sourceHandle: "right", targetHandle: "left", tone: "branch", routing: "floating-smooth" });
  }
  if (selectedActionId) for (const role of ["validation", "work"] as const) edges.push({
    id: `action:${selectedActionId}:${role}`, source: `action:${selectedActionId}`, target: `agent:${selectedActionId}:${role}`,
    sourceHandle: "right", targetHandle: "left", tone: "selected", routing: "floating-smooth",
  });
  return edges;
}

function createReason(locked: boolean | undefined, atLimit: boolean, entity: "State" | "Action"): string | undefined {
  if (locked) return `Cannot create ${entity}: authoring is locked by an active Run.`;
  if (atLimit) return `Cannot create ${entity}: configured limit reached.`;
  return undefined;
}
