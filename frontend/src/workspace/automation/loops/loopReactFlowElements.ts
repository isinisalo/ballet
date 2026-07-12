import { Position } from "@xyflow/react";
import type { LoopCanvasProps, LoopNodeContext, LoopReactFlowEdge, LoopReactFlowNode } from "./LoopCanvasTypes";
import { loopEdgeDomAttributes, loopEdgeStyle } from "./loopEdgeStyle";
import { loopCanvasNodeAnchorY } from "./loopLayout";
import { loopTheme as resolveLoopTheme } from "./loopTheme";

export function loopActiveHandleIdsByNodeKey(layoutEdges: LoopCanvasProps["layout"]["edges"]) {
  const values = new Map<string, Set<string>>();
  const add = (nodeKey: string, handleId?: string) => {
    if (!handleId) return;
    const ids = values.get(nodeKey) ?? new Set<string>();
    ids.add(handleId);
    values.set(nodeKey, ids);
  };
  layoutEdges.forEach((edge) => {
    add(edge.sourceNodeKey, edge.sourceHandleId);
    add(edge.targetNodeKey, edge.targetHandleId);
  });
  return new Map([...values].map(([key, ids]) => [key, [...ids]]));
}

export function loopNodeHandles(
  layoutNode: LoopCanvasProps["layout"]["nodes"][number],
  activeHandleIds: string[]
): LoopReactFlowNode["handles"] {
  const anchorTop = loopCanvasNodeAnchorY(layoutNode);
  const ids = new Set(activeHandleIds);
  const handles: NonNullable<LoopReactFlowNode["handles"]> = [];
  if (ids.has("left")) handles.push({ id: "left", type: "target", position: Position.Left, x: 0, y: anchorTop, width: 1, height: 1 });
  if (ids.has("right")) handles.push({ id: "right", type: "source", position: Position.Right, x: layoutNode.width, y: anchorTop, width: 1, height: 1 });
  if (ids.has("top")) {
    handles.push({ id: "top", type: "source", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
    handles.push({ id: "top", type: "target", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
  }
  if (ids.has("bottom")) {
    handles.push({ id: "bottom", type: "source", position: Position.Bottom, x: layoutNode.width / 2, y: layoutNode.height, width: 1, height: 1 });
    handles.push({ id: "bottom", type: "target", position: Position.Bottom, x: layoutNode.width / 2, y: layoutNode.height, width: 1, height: 1 });
  }
  return handles;
}

export function toLoopReactFlowEdges(
  layoutEdges: LoopCanvasProps["layout"]["edges"],
  layoutNodes: LoopCanvasProps["layout"]["nodes"] = [],
  context?: LoopNodeContext,
  animatedEdgeId?: string | null
): LoopReactFlowEdge[] {
  const nodeByKey = new Map(layoutNodes.map((node) => [node.key, node]));
  const theme = context?.theme ?? resolveLoopTheme("open-ai");
  return layoutEdges.map((loopEdge) => {
    const sourceNode = nodeByKey.get(loopEdge.sourceNodeKey);
    const targetNode = nodeByKey.get(loopEdge.targetNodeKey);
    const isAnimated = loopEdge.key === animatedEdgeId;
    return {
      id: loopEdge.key,
      type: "loopSmart",
      source: loopEdge.sourceNodeKey,
      target: loopEdge.targetNodeKey,
      sourceHandle: loopEdge.sourceHandleId,
      targetHandle: loopEdge.targetHandleId,
      data: { loopEdge, context, sourceNode, targetNode },
      animated: isAnimated,
      className: isAnimated ? "loop-edge-animated" : undefined,
      style: loopEdgeStyle(loopEdge, targetNode, isAnimated, theme),
      interactionWidth: 16,
      selectable: false,
      focusable: false,
      reconnectable: false,
      domAttributes: loopEdgeDomAttributes(loopEdge, theme, isAnimated)
    };
  });
}
