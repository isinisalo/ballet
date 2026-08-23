import {
  projectValidationNodeSchema,
  projectWorkNodeSchema,
  type ProjectJobNode
} from "@shared/api/workspace-contracts";

export type JobFlowViewport = "wide" | "narrow";
export type JobFlowTone = "flow" | "retry" | "fail";

export interface JobFlowEdge {
  id: string;
  path: string;
  tone: JobFlowTone;
  dashed?: boolean;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export interface JobFlowLayout {
  width: number;
  height: number;
  points: Record<"start" | "work" | "validation" | "result" | "retry" | "retryCount" | "escalate" | "continue", { x: number; y: number }>;
  edges: JobFlowEdge[];
}

export const projectJobFlow = (job: ProjectJobNode) => ({
  workDefined: projectWorkNodeSchema.safeParse(job.workNode).success,
  validationDefined: projectValidationNodeSchema.safeParse(job.validationNode).success,
  retryCount: job.maxRetries,
  retryEnabled: job.maxRetries > 0
});

export const jobFlowLayout = (viewport: JobFlowViewport, retryEnabled: boolean): JobFlowLayout =>
  viewport === "narrow" ? narrowLayout(retryEnabled) : wideLayout(retryEnabled);

const wideLayout = (retryEnabled: boolean): JobFlowLayout => ({
  width: 700,
  height: 650,
  points: {
    start: { x: 350, y: 56 }, work: { x: 350, y: 170 }, validation: { x: 350, y: 300 },
    result: { x: 350, y: 430 }, retry: { x: 190, y: 430 }, retryCount: { x: 70, y: 430 },
    escalate: { x: 190, y: 580 }, continue: { x: 350, y: 580 }
  },
  edges: [
    edge("start-work", "M350 88 L350 138", "flow"), edge("work-validation", "M350 202 L350 268", "flow"),
    edge("validation-result", "M350 332 L350 394", "flow"),
    edge("result-retry", "M324 430 L226 430", "fail", false, "NO", 274, 416),
    edge("result-continue", "M350 466 L350 548", "flow"),
    edge("retry-escalate", "M190 466 L190 548", "fail"),
    ...(retryEnabled ? [edge("retry-work", "M190 394 L190 170 L256 170", "retry", true, "YES", 202, 382)] : [])
  ]
});

const narrowLayout = (retryEnabled: boolean): JobFlowLayout => ({
  width: 390,
  height: 650,
  points: {
    start: { x: 260, y: 56 }, work: { x: 260, y: 170 }, validation: { x: 260, y: 300 },
    result: { x: 260, y: 430 }, retry: { x: 145, y: 430 }, retryCount: { x: 72, y: 360 },
    escalate: { x: 145, y: 580 }, continue: { x: 260, y: 580 }
  },
  edges: [
    edge("start-work", "M260 88 L260 138", "flow"), edge("work-validation", "M260 202 L260 268", "flow"),
    edge("validation-result", "M260 332 L260 394", "flow"),
    edge("result-retry", "M234 430 L181 430", "fail", false, "NO", 204, 416),
    edge("result-continue", "M260 466 L260 548", "flow"),
    edge("retry-escalate", "M145 466 L145 548", "fail"),
    ...(retryEnabled ? [edge("retry-work", "M145 394 L145 170 L166 170", "retry", true, "YES", 157, 382)] : [])
  ]
});

const edge = (
  id: string, path: string, tone: JobFlowTone, dashed = false,
  label?: string, labelX?: number, labelY?: number
): JobFlowEdge => ({ id, path, tone, dashed, label, labelX, labelY });
