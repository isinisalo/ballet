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

export function projectActionFlow(): ActionFlowProjection {
  return {
    width: 520,
    height: 390,
    points: {
      start: { x: 48, y: 156 }, work: { x: 230, y: 52 }, validation: { x: 230, y: 156 },
      done: { x: 230, y: 258 }, complete: { x: 58, y: 258 }, retry: { x: 370, y: 258 },
      blocked: { x: 478, y: 258 }, retryCount: { x: 370, y: 350 },
    },
    edges: [
      edge("start-validation", "M81 156 L164 156", "flow"),
      edge("work-validation", "M230 80 L230 126", "flow", false, "evidence", 240, 108),
      edge("validation-done", "M230 186 L230 224", "flow"),
      edge("done-complete", "M196 258 L91 258", "flow", false, "done", 132, 246),
      edge("done-retry", "M264 258 L336 258", "attention", false, "delegate / retry", 270, 246),
      edge("retry-work", "M370 224 L370 52 L296 52", "attention", true, "prompt / correction", 380, 126),
      edge("retry-blocked", "M404 258 L445 258", "fail", false, "blocked", 411, 246),
      edge("retry-count", "M370 292 L370 326", "neutral", true),
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
