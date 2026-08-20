import type { KeyboardEvent, ReactNode } from "react";
import {
  defaultLoopTheme,
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type ExecutionProfile,
  type LocalRuntime,
  type LoopRunDetails,
  type LoopTheme,
  type ProjectAutomationConfig,
  type ProjectJobNode,
  type ProjectLoop,
  type ProjectValidationNode
} from "@shared/api/workspace-contracts";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loopThemeCssProperties, loopThemeNodeGlow } from "./loopTheme";
import { WorkflowNodeVisual, workflowNodeRadius } from "./WorkflowNodeVisual";
import { workflowReasoningGlowLevel } from "./workflowReasoningGlow";

export type WorkflowCanvasSelection = {
  kind: "job" | "validation" | "pass-edge" | "fail-edge";
  id: string;
};

type Point = { x: number; y: number };
type EdgeGeometry = "straight" | "smoothstep";

const jobSpacing = 300;
const firstJobX = 100;
const nodeY = 215;
const terminalXOffset = 190;

export function LoopCanvas({
  loop,
  executionProfiles = [],
  run,
  selection,
  theme: themeOverride,
  readOnly = false,
  onAddFirstNode,
  onSelection
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  executionProfiles?: ExecutionProfile[];
  runtime?: LocalRuntime;
  run?: LoopRunDetails | null;
  selection?: WorkflowCanvasSelection;
  theme?: LoopTheme;
  readOnly?: boolean;
  onAddFirstNode?: () => void;
  onSelection?: (selection: WorkflowCanvasSelection) => void;
  onReorderNode?: (fromIndex: number, toIndex: number) => void;
}) {
  const theme = run?.themeSnapshot ?? themeOverride ?? defaultLoopTheme;
  const { jobs, terminalX, width } = workflowCanvasFrame(loop);
  const { activeValidation, activeDecision } = validationDecision(run);

  if (jobs.length === 0) return (
    <section aria-label={readOnly ? "Run selected Workflow internal Edge canvas" : "Workflow Engineering internal Edge canvas"} className="grid min-h-[28rem] place-items-center border border-divider-strong bg-background p-6" style={loopThemeCssProperties(theme)}>
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <BriefcaseBusiness className="size-8 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">This Workflow has no Job Nodes.</p>
        {!readOnly && onAddFirstNode ? <Button type="button" size="sm" onClick={onAddFirstNode}><Plus /> Add first Job</Button> : null}
      </div>
    </section>
  );

  return (
    <section
      aria-label={readOnly ? "Run selected Workflow internal Edge canvas" : "Workflow Engineering internal Edge canvas"}
      className="relative min-h-[28rem] min-w-0 overflow-x-auto overflow-y-hidden border border-divider-strong bg-background"
      style={loopThemeCssProperties(theme)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <svg width={width} height="440" viewBox={`0 0 ${width} 440`} className="relative block min-h-[28rem]" role="group" aria-label="Workflow Job Nodes and edges">
        <defs>
          <marker id="workflow-arrow-pass" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" className="fill-[var(--loop-theme-edge-color)]" /></marker>
          <marker id="workflow-arrow-fail" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" className="fill-destructive" /></marker>
        </defs>
        {loop.workflow.passEdges.map((edge, index) => {
          const sourceJobIndex = jobs.findIndex((job) => job.validationNodeId === edge.sourceValidationNodeId);
          if (sourceJobIndex < 0) return null;
          const sourceJob = jobs[sourceJobIndex]!;
          const sourceX = firstJobX + sourceJobIndex * jobSpacing;
          const sourceRadius = workflowNodeRadius(sourceJob);
          const targetJobId = "jobNodeId" in edge.target ? edge.target.jobNodeId : undefined;
          const targetJobIndex = targetJobId ? jobs.findIndex((job) => job.id === targetJobId) : -1;
          const targetJob = targetJobIndex >= 0 ? jobs[targetJobIndex] : undefined;
          const targetRadius = targetJob ? workflowNodeRadius(targetJob) : 0;
          const terminal = !targetJob;
          const source = { x: sourceX + sourceRadius + 4, y: nodeY - 9 };
          const target = terminal
            ? { x: terminalX, y: 112 }
            : { x: firstJobX + targetJobIndex * jobSpacing - targetRadius - 5, y: nodeY - 9 };
          const geometry: EdgeGeometry = targetJobIndex === sourceJobIndex + 1 ? "straight" : "smoothstep";
          const routeY = 68 - index * 16;
          const path = geometry === "straight"
            ? straightPath(source, target)
            : smartSmoothstepPath(source, target, routeY);
          const labelPoint = terminal
            ? { x: terminalX - 72, y: 96 }
            : geometry === "straight"
              ? { x: (source.x + target.x) / 2, y: source.y - 13 }
              : { x: (source.x + target.x) / 2, y: routeY - 10 };
          return <SelectableEdge key={edge.id} label={`Pass Edge ${edge.id}, ${edge.sourceValidationNodeId} to ${targetJobId ? `Job ${targetJobId}` : "Workflow PASS"}`} selected={selection?.kind === "pass-edge" && selection.id === edge.id} readOnly={readOnly} onSelect={() => onSelection?.({ kind: "pass-edge", id: edge.id })}>
            <path data-workflow-edge="pass" data-edge-geometry={geometry} d={path} className={cn("stroke-[var(--loop-theme-edge-color)]", activeDecision === "PASS" && activeValidation?.workflowNodeId === edge.sourceValidationNodeId && "[filter:drop-shadow(0_0_5px_var(--secondary))]")} strokeWidth="1.5" fill="none" markerEnd="url(#workflow-arrow-pass)" />
            <WorkflowConnectionPoint x={source.x} y={source.y} />
            {terminal ? <WorkflowConnectionPoint x={target.x} y={target.y} /> : null}
            <text x={labelPoint.x} y={labelPoint.y} textAnchor={terminal ? "start" : "middle"} className="fill-secondary font-mono text-[10px]">✓ PASS</text>
          </SelectableEdge>;
        })}
        {loop.workflow.failEdges.map((edge, index) => {
          const sourceJobIndex = jobs.findIndex((job) => job.validationNodeId === edge.sourceValidationNodeId);
          if (sourceJobIndex < 0) return null;
          const sourceJob = jobs[sourceJobIndex]!;
          const sourceX = firstJobX + sourceJobIndex * jobSpacing;
          const sourceRadius = workflowNodeRadius(sourceJob);
          const source = { x: sourceX + sourceRadius + 4, y: nodeY + 9 };
          const target = { x: terminalX, y: 326 };
          const routeY = 364 + index * 14;
          const path = smartSmoothstepPath(source, target, routeY);
          return <SelectableEdge key={edge.id} label={`Fail Edge ${edge.id}, ${edge.sourceValidationNodeId} to Workflow FAIL and external escalation`} selected={selection?.kind === "fail-edge" && selection.id === edge.id} readOnly={readOnly} onSelect={() => onSelection?.({ kind: "fail-edge", id: edge.id })}>
            <path data-workflow-edge="fail" data-edge-geometry="smoothstep" d={path} className={cn("stroke-destructive", activeDecision === "FAIL" && activeValidation?.workflowNodeId === edge.sourceValidationNodeId && "[filter:drop-shadow(0_0_5px_var(--destructive))]")} strokeWidth="1.5" fill="none" markerEnd="url(#workflow-arrow-fail)" />
            <WorkflowConnectionPoint x={source.x} y={source.y} />
            <WorkflowConnectionPoint x={target.x} y={target.y} />
            <text x={terminalX - 126} y={target.y + 18} className="fill-destructive font-mono text-[10px]">✕ FAIL · escalate</text>
          </SelectableEdge>;
        })}
        {jobs.map((job, index) => {
          const validation = loop.workflow.validationNodes.find((node) => node.id === job.validationNodeId);
          const projection = compositeNodeProjection(run, job, validation);
          const glowNode = projection.activeRole === "validation" && validation ? validation : job;
          return <WorkflowNodeVisual
            key={job.id}
            x={firstJobX + index * jobSpacing}
            y={nodeY}
            node={job}
            pairedValidationId={validation?.id ?? job.validationNodeId}
            activeRole={projection.activeRole}
            selected={selection?.kind === "job" && selection.id === job.id}
            readOnly={readOnly}
            status={projection.status}
            reasoningGlow={nodeReasoningGlow(glowNode, executionProfiles)}
            glowColor={loopThemeNodeGlow(theme)}
            onSelect={() => onSelection?.({ kind: "job", id: job.id })}
          />;
        })}
      </svg>
    </section>
  );
}

function workflowCanvasFrame(loop: ProjectLoop) {
  const jobs = loop.workflow.jobNodes;
  const lastJobX = firstJobX + Math.max(0, jobs.length - 1) * jobSpacing;
  const terminalX = lastJobX + terminalXOffset;
  return { jobs, terminalX, width: Math.max(780, terminalX + 90) };
}

function validationDecision(run?: LoopRunDetails | null) {
  const activeValidation = [...(run?.nodeRuns ?? [])].reverse().find((nodeRun) =>
    nodeRun.role === "validation" && nodeRun.outcome?.role === "validation"
    && nodeRun.outcome.state === "completed");
  const activeDecision = activeValidation?.outcome?.role === "validation"
    && activeValidation.outcome.state === "completed" ? activeValidation.outcome.decision : undefined;
  return { activeValidation, activeDecision };
}

function SelectableEdge({ label, selected, readOnly, onSelect, children }: { label: string; selected: boolean; readOnly: boolean; onSelect: () => void; children: ReactNode }) {
  const activate = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };
  return <g role={readOnly ? undefined : "button"} tabIndex={readOnly ? undefined : 0} aria-label={readOnly ? undefined : `Edit ${label}`} data-selected={selected || undefined} className={cn("outline-none", selected && "[filter:drop-shadow(0_0_5px_var(--primary))]")} onClick={readOnly ? undefined : onSelect} onKeyDown={readOnly ? undefined : activate}>
    <title>{label}</title>
    {children}
  </g>;
}

function WorkflowConnectionPoint({ x, y }: Point) {
  return <circle cx={x} cy={y} r="2.5" className="workflow-connection-point" aria-hidden="true" />;
}

function straightPath(source: Point, target: Point) {
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}

function smartSmoothstepPath(source: Point, target: Point, routeY: number) {
  const direction = target.x >= source.x ? 1 : -1;
  const lead = Math.min(46, Math.max(26, Math.abs(target.x - source.x) / 4));
  return roundedOrthogonalPath([
    source,
    { x: source.x + direction * lead, y: source.y },
    { x: source.x + direction * lead, y: routeY },
    { x: target.x - direction * lead, y: routeY },
    { x: target.x - direction * lead, y: target.y },
    target
  ]);
}

function roundedOrthogonalPath(points: Point[], radius = 10) {
  const path = [`M ${points[0]!.x} ${points[0]!.y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const incomingDistance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoingDistance = Math.hypot(next.x - current.x, next.y - current.y);
    const corner = Math.min(radius, incomingDistance / 2, outgoingDistance / 2);
    const before = pointToward(current, previous, corner);
    const after = pointToward(current, next, corner);
    path.push(`L ${before.x} ${before.y}`, `Q ${current.x} ${current.y} ${after.x} ${after.y}`);
  }
  const last = points.at(-1)!;
  path.push(`L ${last.x} ${last.y}`);
  return path.join(" ");
}

function pointToward(origin: Point, target: Point, distance: number): Point {
  const length = Math.hypot(target.x - origin.x, target.y - origin.y);
  if (length === 0) return origin;
  return {
    x: origin.x + (target.x - origin.x) / length * distance,
    y: origin.y + (target.y - origin.y) / length * distance
  };
}

function nodeReasoningGlow(
  node: ProjectJobNode | ProjectValidationNode,
  executionProfiles: ExecutionProfile[]
) {
  const profileId = "validationNodeId" in node
    ? isProjectProviderJobNode(node) ? node.executionProfileId : undefined
    : isProjectAgentValidationNode(node) ? node.executionProfileId : undefined;
  return workflowReasoningGlowLevel(
    executionProfiles.find((profile) => profile.id === profileId)?.reasoningEffort
  );
}

function compositeNodeProjection(
  run: LoopRunDetails | null | undefined,
  job: ProjectJobNode,
  validation?: ProjectValidationNode
) {
  const latest = [...(run?.nodeRuns ?? [])].reverse().find((nodeRun) =>
    (nodeRun.role === "job" && (nodeRun.workflowNodeId === job.id || nodeRun.nodeDefinitionId === job.id))
    || (nodeRun.role === "validation" && validation
      && (nodeRun.workflowNodeId === validation.id || nodeRun.nodeDefinitionId === validation.id)));
  return {
    activeRole: latest?.role === "validation" ? "validation" as const : "job" as const,
    status: latest?.status
  };
}
