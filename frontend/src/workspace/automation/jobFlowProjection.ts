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
  points: Record<"start" | "work" | "validation" | "result" | "retry" | "orchestrator" | "escalate" | "next" | "done", { x: number; y: number }>;
  edges: JobFlowEdge[];
}

export const projectJobFlow = (job: ProjectJobNode) => ({
  workDefined: projectWorkNodeSchema.safeParse(job.workNode).success,
  validationDefined: projectValidationNodeSchema.safeParse(job.validationNode).success,
  retryEnabled: job.maxRetries > 0,
  retryLabel: job.maxRetries === 1 ? "1 retry" : `${job.maxRetries} retries`
});

export const jobFlowLayout = (viewport: JobFlowViewport, retryEnabled: boolean): JobFlowLayout =>
  viewport === "narrow" ? narrowLayout(retryEnabled) : wideLayout(retryEnabled);

const wideLayout = (retryEnabled: boolean): JobFlowLayout => ({
  width: 760,
  height: 640,
  points: {
    start: { x: 380, y: 48 }, work: { x: 380, y: 132 }, validation: { x: 380, y: 222 },
    result: { x: 380, y: 312 }, retry: { x: 205, y: 410 }, orchestrator: { x: 555, y: 410 },
    escalate: { x: 205, y: 552 }, next: { x: 500, y: 552 }, done: { x: 660, y: 552 }
  },
  edges: [
    edge("start-work", "M380 69 L380 99", "flow"), edge("work-validation", "M380 165 L380 189", "flow"),
    edge("validation-result", "M380 255 L380 278", "flow"),
    edge("result-retry", "M345 312 L205 376", "fail", false, "FAIL", 271, 329),
    edge("result-orchestrator", "M415 312 L555 376", "flow", false, "PASS", 479, 329),
    edge("retry-escalate", "M205 444 L205 519", "fail", false, "NO", 214, 485),
    edge("orchestrator-next", "M555 446 L555 483 L500 483 L500 519", "flow"),
    edge("orchestrator-done", "M555 446 L555 483 L660 483 L660 519", "flow"),
    ...(retryEnabled ? [edge("retry-work", "M170 410 L62 410 L62 132 L280 132", "retry", true, "YES", 79, 395)] : [])
  ]
});

const narrowLayout = (retryEnabled: boolean): JobFlowLayout => ({
  width: 360,
  height: 800,
  points: {
    start: { x: 180, y: 44 }, work: { x: 180, y: 124 }, validation: { x: 180, y: 210 },
    result: { x: 180, y: 296 }, retry: { x: 92, y: 392 }, orchestrator: { x: 266, y: 392 },
    escalate: { x: 92, y: 522 }, next: { x: 258, y: 522 }, done: { x: 258, y: 632 }
  },
  edges: [
    edge("start-work", "M180 65 L180 91", "flow"), edge("work-validation", "M180 157 L180 177", "flow"),
    edge("validation-result", "M180 243 L180 262", "flow"),
    edge("result-retry", "M148 296 L92 358", "fail", false, "FAIL", 106, 315),
    edge("result-orchestrator", "M212 296 L266 358", "flow", false, "PASS", 243, 315),
    edge("retry-escalate", "M92 426 L92 489", "fail", false, "NO", 101, 463),
    edge("orchestrator-next", "M266 428 L266 489", "flow"), edge("next-done", "M258 555 L258 599", "flow"),
    ...(retryEnabled ? [edge("retry-work", "M58 392 L18 392 L18 124 L78 124", "retry", true, "YES", 25, 377)] : [])
  ]
});

const edge = (
  id: string, path: string, tone: JobFlowTone, dashed = false,
  label?: string, labelX?: number, labelY?: number
): JobFlowEdge => ({ id, path, tone, dashed, label, labelX, labelY });
