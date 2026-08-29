import type { CanvasSurfaceSize } from "./useCanvasSurfaceSize";

export type ActionFlowTone = "flow" | "attention" | "fail" | "neutral";

export interface ActionFlowEdge {
  id: string;
  path: string;
  tone: ActionFlowTone;
  dashed?: boolean;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export interface ActionFlowProjection {
  width: number;
  height: number;
  points: Record<"start" | "work" | "validation" | "done" | "retry" | "retryCount" | "blocked" | "complete", { x: number; y: number }>;
  edges: ActionFlowEdge[];
}

export function projectActionFlow(surface: CanvasSurfaceSize = { width: 0, height: 0 }): ActionFlowProjection {
  const width = Math.max(520, surface.width); const height = Math.max(390, surface.height);
  const points: ActionFlowProjection["points"] = {
    start: { x: width * .09, y: height * .38 }, work: { x: width * .44, y: height * .14 }, validation: { x: width * .44, y: height * .38 },
    done: { x: width * .44, y: height * .65 }, complete: { x: width * .12, y: height * .65 }, retry: { x: width * .72, y: height * .65 },
    blocked: { x: width * .91, y: height * .65 }, retryCount: { x: width * .72, y: height * .88 },
  };
  return {
    width, height, points,
    edges: [
      edge("start-validation", `M${points.start.x + 33} ${points.start.y} L${points.validation.x - 66} ${points.validation.y}`, "flow"),
      edge("work-validation", `M${points.work.x} ${points.work.y + 29} L${points.validation.x} ${points.validation.y - 30}`, "flow", false, "evidence", points.work.x + 10, (points.work.y + points.validation.y) / 2),
      edge("validation-done", `M${points.validation.x} ${points.validation.y + 30} L${points.done.x} ${points.done.y - 34}`, "flow"),
      edge("done-complete", `M${points.done.x - 34} ${points.done.y} L${points.complete.x + 33} ${points.complete.y}`, "flow", false, "done", (points.done.x + points.complete.x) / 2, points.done.y - 12),
      edge("done-retry", `M${points.done.x + 34} ${points.done.y} L${points.retry.x - 34} ${points.retry.y}`, "attention", false, "delegate / retry", (points.done.x + points.retry.x) / 2, points.done.y - 12),
      edge("retry-work", `M${points.retry.x} ${points.retry.y - 34} L${points.retry.x} ${points.work.y} L${points.work.x + 66} ${points.work.y}`, "attention", true, "prompt / correction", points.retry.x + 10, (points.retry.y + points.work.y) / 2),
      edge("retry-blocked", `M${points.retry.x + 34} ${points.retry.y} L${points.blocked.x - 33} ${points.blocked.y}`, "fail", false, "blocked", (points.retry.x + points.blocked.x) / 2, points.retry.y - 12),
      edge("retry-count", `M${points.retry.x} ${points.retry.y + 34} L${points.retryCount.x} ${points.retryCount.y - 25}`, "neutral", true),
    ],
  };
}

const edge = (
  id: string,
  path: string,
  tone: ActionFlowTone,
  dashed = false,
  label?: string,
  labelX?: number,
  labelY?: number,
): ActionFlowEdge => ({ id, path, tone, dashed, label, labelX, labelY });
