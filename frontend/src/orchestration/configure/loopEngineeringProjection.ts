import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { orderedActions, orderedStates } from "@shared/orchestration/gates";
import type { CanvasSurfaceSize } from "./useCanvasSurfaceSize";

export type ActionArtwork = "sol" | "terra" | "luna";

export interface LoopEngineeringStateNode {
  kind: "state";
  id: string;
  name: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
}

export interface LoopEngineeringActionNode {
  kind: "action";
  id: string;
  name: string;
  priority: number;
  x: number;
  y: number;
  size: number;
  hitSize: number;
  artwork: ActionArtwork;
  selected: boolean;
}

export interface LoopEngineeringEdge {
  id: string;
  path: string;
  tone: "state" | "action";
  points: Array<{ x: number; y: number }>;
}

export interface LoopEngineeringProjection {
  width: number;
  height: number;
  states: LoopEngineeringStateNode[];
  actions: LoopEngineeringActionNode[];
  edges: LoopEngineeringEdge[];
}

const MIN_WIDTH = 560;
const MIN_HEIGHT = 360;
const SIDE_MARGIN = 16;
const STATE_NODE_WIDTH = 96;
const NODE_HIT_SIZE = 44;
const STATE_GAP = 16;
const STATE_Y = 52;
const ACTION_START_Y = 120;
const ACTION_GAP = 56;
const ACTION_BOTTOM_ALLOWANCE = 54;
const FLOATING_EDGE_GAP = 4;

export function projectLoopEngineering(
  environment: EnvironmentDefinition,
  selectedStateId?: string,
  selectedActionId?: string,
  surface: CanvasSurfaceSize = { width: 0, height: 0 },
): LoopEngineeringProjection {
  const states = orderedStates(environment.states);
  const projectedStates: LoopEngineeringStateNode[] = [];
  const projectedActions: LoopEngineeringActionNode[] = [];
  const edges: LoopEngineeringEdge[] = [];
  const stateGroupWidth = states.length === 0 ? 0 : states.length * STATE_NODE_WIDTH + (states.length - 1) * STATE_GAP;
  const width = Math.max(MIN_WIDTH, surface.width, stateGroupWidth + SIDE_MARGIN * 2);
  const stateStartX = (width - stateGroupWidth) / 2 + STATE_NODE_WIDTH / 2;
  let previousState: LoopEngineeringStateNode | undefined;
  states.forEach((state, stateIndex) => {
    const selected = state.id === selectedStateId;
    const stateNode: LoopEngineeringStateNode = {
      kind: "state",
      id: state.id,
      name: state.name,
      order: state.order,
      x: stateStartX + stateIndex * (STATE_NODE_WIDTH + STATE_GAP),
      y: STATE_Y,
      width: STATE_NODE_WIDTH,
      height: NODE_HIT_SIZE,
      selected,
    };
    projectedStates.push(stateNode);
    if (previousState) edges.push(stateEdge(previousState, stateNode));

    if (selected) {
      const actions = orderedActions(state.actions);
      actions.forEach((action, index) => {
        const appearance = actionAppearance(index, actions.length);
        projectedActions.push({
          kind: "action",
          id: action.id,
          name: action.name,
          priority: action.priority,
          x: stateNode.x,
          y: ACTION_START_Y + index * ACTION_GAP,
          hitSize: NODE_HIT_SIZE,
          ...appearance,
          selected: action.id === selectedActionId,
        });
      });
      edges.push(...actionEdges(stateNode, projectedActions));
    }

    previousState = stateNode;
  });

  const contentHeight = projectedActions.length > 0
    ? projectedActions.at(-1)!.y + ACTION_BOTTOM_ALLOWANCE
    : STATE_Y + NODE_HIT_SIZE / 2 + SIDE_MARGIN;
  return {
    width,
    height: Math.max(MIN_HEIGHT, surface.height, contentHeight),
    states: projectedStates,
    actions: projectedActions,
    edges,
  };
}

function stateEdge(source: LoopEngineeringStateNode, target: LoopEngineeringStateNode): LoopEngineeringEdge {
  const start = { x: source.x + source.width / 2 + FLOATING_EDGE_GAP, y: source.y };
  const end = { x: target.x - target.width / 2 - FLOATING_EDGE_GAP, y: target.y };
  return {
    id: `state:${source.id}:to:${target.id}`,
    path: `M${start.x} ${start.y} L${end.x} ${end.y}`,
    tone: "state",
    points: [start, end],
  };
}

function actionEdges(state: LoopEngineeringStateNode, actions: LoopEngineeringActionNode[]): LoopEngineeringEdge[] {
  if (actions.length === 0) return [];
  const first = actions[0]!;
  const stateStart = { x: state.x, y: state.y + state.height / 2 + FLOATING_EDGE_GAP };
  const firstEnd = { x: first.x, y: first.y - first.size / 2 - FLOATING_EDGE_GAP };
  const result: LoopEngineeringEdge[] = [{
    id: `state:${state.id}:actions`,
    path: `M${stateStart.x} ${stateStart.y} L${firstEnd.x} ${firstEnd.y}`,
    tone: "action",
    points: [stateStart, firstEnd],
  }];
  actions.slice(1).forEach((target, index) => {
    const source = actions[index]!;
    const start = { x: source.x, y: source.y + source.size / 2 + FLOATING_EDGE_GAP };
    const end = { x: target.x, y: target.y - target.size / 2 - FLOATING_EDGE_GAP };
    result.push({
      id: `action:${source.id}:to:${target.id}`,
      path: `M${start.x} ${start.y} L${end.x} ${end.y}`,
      tone: "action",
      points: [
        start,
        end,
      ],
    });
  });
  return result;
}

function actionAppearance(index: number, count: number): { artwork: ActionArtwork; size: number } {
  if (index === 0 || count === 1) return { artwork: "sol", size: 32 };
  if (index === count - 1) return { artwork: "luna", size: 24 };
  return { artwork: "terra", size: 28 };
}
