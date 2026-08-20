import {
  defaultLoopNodeStyle,
  type InstalledLoopModuleStatus,
  type LoopNodeStyle,
  type LoopRunDetails,
  type LoopRunStatus,
  type NodeRunStatus,
  type OrchestratorRoute,
  type ProjectAutomationConfig,
  type ProjectFailEdge,
  type ProjectJobNode,
  type ProjectLoop,
  type ProjectLoopEdge,
  type ProjectPassEdge,
  type ProjectValidationNode,
  type RootRun
} from "@shared/api/workspace-contracts";

export type GraphEngineeringLiveStatus = LoopRunStatus | NodeRunStatus | "finalizing";

export interface GraphEngineeringNode {
  loopId: string;
  title: string;
  description: string;
  kind: "installed" | "custom";
  moduleVersion?: string;
  provenanceStatus?: InstalledLoopModuleStatus["status"];
  jobCount: number;
  accepts: string[];
  provides: string[];
  artworkStyle: LoopNodeStyle;
  locked: boolean;
  liveStatus?: GraphEngineeringLiveStatus;
}

export interface GraphEngineeringOrchestratorNode {
  id: "loop-orchestrator";
  title: "Loop Orchestrator";
  description: string;
  activeRootRunCount: number;
  liveStatus?: GraphEngineeringLiveStatus;
}

export interface GraphEngineeringRouteEvidence {
  route: OrchestratorRoute;
  state: "active" | "recorded" | "blocked";
  reason?: string;
}

export interface GraphEngineeringEdge extends ProjectLoopEdge {
  activeRoute?: OrchestratorRoute;
}

export interface GraphEngineeringProjection {
  orchestrator: GraphEngineeringOrchestratorNode;
  nodes: GraphEngineeringNode[];
  edges: GraphEngineeringEdge[];
  routeEvidence: GraphEngineeringRouteEvidence[];
}

export interface GraphEngineeringFocus {
  edges: GraphEngineeringEdge[];
  visibleRepairCount: number;
  hiddenRepairCount: number;
}

export interface WorkflowEngineeringProjection {
  loop: ProjectLoop;
  jobNodes: ProjectJobNode[];
  validationNodes: ProjectValidationNode[];
  passEdges: ProjectPassEdge[];
  failEdges: ProjectFailEdge[];
  startJobNodeId: string;
}

export function buildGraphEngineeringProjection({
  config,
  installedModules = [],
  lockedLoopIds = new Set<string>(),
  activeRootRuns = [],
  loopRuns = [],
  orchestratorRoutes = []
}: {
  config: ProjectAutomationConfig;
  installedModules?: InstalledLoopModuleStatus[];
  lockedLoopIds?: ReadonlySet<string>;
  activeRootRuns?: RootRun[];
  loopRuns?: LoopRunDetails[];
  orchestratorRoutes?: OrchestratorRoute[];
}): GraphEngineeringProjection {
  const installedByLoopId = new Map(installedModules.map((module) => [module.loopId, module]));
  const activeRootIds = new Set(activeRootRuns.map((run) => run.rootRunId));
  const liveLoopRuns = loopRuns.filter((run) => activeRootIds.has(run.rootRunId));
  const routeEvidence = orchestratorRoutes
    .filter((route) => activeRootIds.has(route.rootRunId))
    .map((route) => projectRouteEvidence(route, activeRootRuns, liveLoopRuns));
  const activeRouteByEdgeId = new Map(routeEvidence
    .filter((evidence) => evidence.state === "active")
    .map((evidence) => [evidence.route.loopEdgeId, evidence.route]));
  const orchestratorNodeRuns = liveLoopRuns.flatMap((run) => run.nodeRuns)
    .filter((node) => node.role === "orchestrator");

  return {
    orchestrator: {
      id: "loop-orchestrator",
      title: "Loop Orchestrator",
      description: "Validates completion and escalation dispatch against the immutable Graph allowlist.",
      activeRootRunCount: activeRootRuns.length,
      liveStatus: latestStatus(orchestratorNodeRuns)
    },
    nodes: config.loops.map((loop) => {
      const installed = installedByLoopId.get(loop.id);
      const startNode = loop.workflow.jobNodes.find((node) => node.id === loop.workflow.startJobNodeId);
      return {
        loopId: loop.id,
        title: installed?.title ?? loop.id,
        description: loop.description,
        kind: installed ? "installed" : "custom",
        moduleVersion: installed?.moduleVersion,
        provenanceStatus: installed?.status,
        jobCount: loop.workflow.jobNodes.length,
        accepts: [...loop.capabilities.accepts],
        provides: [...loop.capabilities.provides],
        artworkStyle: startNode?.nodeStyle ?? defaultLoopNodeStyle,
        locked: lockedLoopIds.has(loop.id),
        liveStatus: latestStatus(liveLoopRuns.filter((run) => run.loopId === loop.id))
      };
    }),
    edges: config.graph.loopEdges.map((edge) => ({
      ...edge,
      activeRoute: activeRouteByEdgeId.get(edge.id)
    })),
    routeEvidence
  };
}

export function buildGraphEngineeringFocus(
  projection: GraphEngineeringProjection,
  selectedLoopId?: string
): GraphEngineeringFocus {
  const flowEdges = projection.edges.filter((edge) => edge.kind === "flow");
  const repairEdges = projection.edges.filter((edge) => edge.kind === "repair");
  const visibleRepairEdges = selectedLoopId
    ? repairEdges.filter((edge) => edge.source === selectedLoopId || edge.target === selectedLoopId)
    : repairEdges.filter((edge) => Boolean(edge.activeRoute));
  return {
    edges: [...flowEdges, ...visibleRepairEdges],
    visibleRepairCount: visibleRepairEdges.length,
    hiddenRepairCount: repairEdges.length - visibleRepairEdges.length
  };
}

export function buildWorkflowEngineeringProjection(
  config: ProjectAutomationConfig,
  selectedLoopId: string
): WorkflowEngineeringProjection | undefined {
  const loop = config.loops.find((candidate) => candidate.id === selectedLoopId);
  if (!loop) return undefined;
  return {
    loop,
    jobNodes: loop.workflow.jobNodes.map((node) => ({ ...node })),
    validationNodes: loop.workflow.validationNodes.map((node) => ({ ...node })),
    passEdges: loop.workflow.passEdges.map((edge) => ({ ...edge })),
    failEdges: loop.workflow.failEdges.map((edge) => ({ ...edge })),
    startJobNodeId: loop.workflow.startJobNodeId
  };
}

function projectRouteEvidence(
  route: OrchestratorRoute,
  roots: RootRun[],
  loopRuns: LoopRunDetails[]
): GraphEngineeringRouteEvidence {
  const root = roots.find((candidate) => candidate.rootRunId === route.rootRunId);
  const snapshotEdge = root?.executionSnapshot.graph.loopEdges.find((edge) => edge.id === route.loopEdgeId);
  const mismatch = !snapshotEdge
    ? "Route is outside the immutable Root Run graph allowlist."
    : route.sourceLoopId !== snapshotEdge.source || route.targetLoopId !== snapshotEdge.target || route.kind !== snapshotEdge.kind
      ? "Persisted route identity does not match its immutable Root Run policy."
      : capabilityMismatch(root, snapshotEdge);
  if (mismatch) return { route, state: "blocked", reason: mismatch };
  const targetIsActive = loopRuns.some((run) =>
    run.rootRunId === route.rootRunId
    && run.orchestrationRequestId === route.orchestrationRequestId
    && run.loopId === route.targetLoopId
    && isLiveStatus(run.status));
  return { route, state: targetIsActive ? "active" : "recorded" };
}

function capabilityMismatch(root: RootRun | undefined, edge: ProjectLoopEdge): string | undefined {
  const target = root?.executionSnapshot.loops.find((loop) => loop.id === edge.target);
  const accepted = edge.kind === "repair"
    ? target?.capabilities.provides.includes(edge.capability)
    : target?.capabilities.accepts.includes(edge.capability);
  return accepted ? undefined : `Target Loop does not satisfy ${edge.kind} capability ${edge.capability}.`;
}

function latestStatus<T extends { status: GraphEngineeringLiveStatus; updatedAt: string }>(values: T[]) {
  const ranked = [...values].sort((left, right) => {
    const priority = statusPriority(right.status) - statusPriority(left.status);
    return priority || right.updatedAt.localeCompare(left.updatedAt);
  });
  return ranked[0]?.status;
}

const statusPriority = (status: GraphEngineeringLiveStatus) => {
  if (["failed", "blocked"].includes(status)) return 5;
  if (["running", "waiting_for_input", "queued", "finalizing"].includes(status)) return 4;
  if (status === "interrupted") return 3;
  if (status === "completed") return 2;
  return 1;
};

const isLiveStatus = (status: GraphEngineeringLiveStatus) =>
  ["queued", "running", "waiting_for_input", "finalizing"].includes(status);
