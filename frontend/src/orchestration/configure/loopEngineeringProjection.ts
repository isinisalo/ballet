import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { orderedActions, orderedStates } from "@shared/orchestration/gates";

export type ActionArtwork = "sol" | "terra" | "station";

export interface LoopEngineeringStateNode {
  kind: "state";
  id: string;
  name: string;
  order: number;
  x: number;
  y: number;
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

const STATE_X = 88;
const TOP = 56;
const COMPACT_ROW_HEIGHT = 76;
const EXPANDED_ROW_HEIGHT = 190;
const ACTION_START_X = 260;
const ACTION_GAP = 190;

export function projectLoopEngineering(
  environment: EnvironmentDefinition,
  selectedStateId?: string,
  selectedActionId?: string,
): LoopEngineeringProjection {
  const states = orderedStates(environment.states);
  const projectedStates: LoopEngineeringStateNode[] = [];
  const projectedActions: LoopEngineeringActionNode[] = [];
  const edges: LoopEngineeringEdge[] = [];
  let cursor = TOP;
  let previousState: LoopEngineeringStateNode | undefined;

  states.forEach((state) => {
    const selected = state.id === selectedStateId;
    const y = cursor + (selected ? EXPANDED_ROW_HEIGHT / 2 : COMPACT_ROW_HEIGHT / 2);
    const stateNode: LoopEngineeringStateNode = {
      kind: "state", id: state.id, name: state.name, order: state.order, x: STATE_X, y, selected,
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
          x: ACTION_START_X + index * ACTION_GAP,
          y,
          ...appearance,
          selected: action.id === selectedActionId,
        });
      });
      edges.push(...actionEdges(stateNode, projectedActions));
    }

    previousState = stateNode;
    cursor += selected ? EXPANDED_ROW_HEIGHT : COMPACT_ROW_HEIGHT;
  });

  const lastActionX = projectedActions.at(-1)?.x ?? 0;
  return {
    width: Math.max(560, lastActionX + 170),
    height: Math.max(360, cursor + 40),
    states: projectedStates,
    actions: projectedActions,
    edges,
  };
}

function stateEdge(source: LoopEngineeringStateNode, target: LoopEngineeringStateNode): LoopEngineeringEdge {
  return {
    id: `state:${source.id}:to:${target.id}`,
    path: `M${source.x} ${source.y + 22} L${target.x} ${target.y - 22}`,
    tone: "state",
    points: [{ x: source.x, y: source.y + 22 }, { x: target.x, y: target.y - 22 }],
  };
}

function actionEdges(state: LoopEngineeringStateNode, actions: LoopEngineeringActionNode[]): LoopEngineeringEdge[] {
  if (actions.length === 0) return [];
  const first = actions[0]!;
  const result: LoopEngineeringEdge[] = [{
    id: `state:${state.id}:actions`,
    path: `M${state.x + 22} ${state.y} L${first.x - first.size / 2 - 10} ${first.y}`,
    tone: "action",
    points: [{ x: state.x + 22, y: state.y }, { x: first.x - first.size / 2 - 10, y: first.y }],
  }];
  actions.slice(1).forEach((target, index) => {
    const source = actions[index]!;
    result.push({
      id: `action:${source.id}:to:${target.id}`,
      path: `M${source.x + source.size / 2 + 10} ${source.y} L${target.x - target.size / 2 - 10} ${target.y}`,
      tone: "action",
      points: [
        { x: source.x + source.size / 2 + 10, y: source.y },
        { x: target.x - target.size / 2 - 10, y: target.y },
      ],
    });
  });
  return result;
}

function actionAppearance(index: number, count: number): { artwork: ActionArtwork; size: number } {
  if (index === 0 || count === 1) return { artwork: "sol", size: 84 };
  if (index === count - 1) return { artwork: "station", size: 48 };
  return { artwork: "terra", size: 64 };
}
