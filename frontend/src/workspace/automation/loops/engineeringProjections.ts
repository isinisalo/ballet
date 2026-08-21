import type {
  InstalledLoopModuleStatus,
  LoopRunDetails,
  LoopRunStatus,
  NodeRunStatus,
  OrchestratorRoute,
  ProjectAutomationConfig,
  ProjectFailEdge,
  ProjectGraphTransition,
  ProjectJobNode,
  ProjectLoop,
  ProjectPassEdge,
  ProjectRepairEdge,
  ProjectValidationNode,
  RootRun
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
  locked: boolean;
  start: boolean;
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

export type GraphEngineeringEdge =
  | (ProjectGraphTransition & {
      kind: "transition";
      targetId: string;
      activeRoute?: never;
    })
  | (ProjectRepairEdge & {
      kind: "repair";
      targetId: string;
      activeRoute?: OrchestratorRoute;
    });

export interface GraphEngineeringProjection {
  graphId: string;
  graphName: string;
  startLoopId: string;
  orchestrator: GraphEngineeringOrchestratorNode;
  nodes: GraphEngineeringNode[];
  done: boolean;
  edges: GraphEngineeringEdge[];
  routeEvidence: GraphEngineeringRouteEvidence[];
}

export interface GraphEngineeringFocus {
  edges: GraphEngineeringEdge[];
  transitionCount: number;
  repairCount: number;
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
    .map((route) => projectRepairRouteEvidence(route, activeRootRuns, liveLoopRuns));
  const activeRouteByEdgeId = new Map(routeEvidence
    .filter((evidence) => evidence.state === "active")
    .map((evidence) => [evidence.route.loopEdgeId, evidence.route]));
  const orchestratorNodeRuns = liveLoopRuns.flatMap((run) => run.nodeRuns)
    .filter((node) => node.role === "orchestrator");

  return {
    graphId: config.graph.id,
    graphName: config.graph.name,
    startLoopId: config.graph.startLoopId,
    orchestrator: {
      id: "loop-orchestrator",
      title: "Loop Orchestrator",
      description: "Routes immutable PASS and FAIL outcomes by exact decision and named RunBook outcome.",
      activeRootRunCount: activeRootRuns.filter((run) => run.kind === "graph").length,
      liveStatus: latestStatus(orchestratorNodeRuns)
    },
    nodes: config.loops.map((loop) => {
      const installed = installedByLoopId.get(loop.id);
      return {
        loopId: loop.id,
        title: installed?.title ?? loop.id.toUpperCase(),
        description: loop.description,
        kind: installed ? "installed" : "custom",
        moduleVersion: installed?.moduleVersion,
        provenanceStatus: installed?.status,
        jobCount: loop.workflow.jobNodes.length,
        locked: lockedLoopIds.has(loop.id),
        start: loop.id === config.graph.startLoopId,
        liveStatus: latestStatus(liveLoopRuns.filter((run) => run.loopId === loop.id))
      };
    }),
    done: config.graph.transitions.some((transition) => "runResult" in transition.target),
    edges: [
      ...config.graph.transitions.map((transition): GraphEngineeringEdge => ({
        ...transition,
        kind: "transition",
        targetId: "loopId" in transition.target ? transition.target.loopId : "graph-done"
      })),
      ...config.graph.repairEdges.map((edge): GraphEngineeringEdge => ({
        ...edge,
        kind: "repair",
        targetId: edge.target,
        activeRoute: activeRouteByEdgeId.get(edge.id)
      }))
    ],
    routeEvidence
  };
}

export function buildGraphEngineeringFocus(
  projection: GraphEngineeringProjection
): GraphEngineeringFocus {
  return {
    edges: projection.edges,
    transitionCount: projection.edges.filter((edge) => edge.kind === "transition").length,
    repairCount: projection.edges.filter((edge) => edge.kind === "repair").length
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

function projectRepairRouteEvidence(
  route: OrchestratorRoute,
  roots: RootRun[],
  loopRuns: LoopRunDetails[]
): GraphEngineeringRouteEvidence {
  const root = roots.find((candidate) => candidate.rootRunId === route.rootRunId);
  const snapshotEdge = root?.executionSnapshot.graph.repairEdges.find((edge) => edge.id === route.loopEdgeId);
  const mismatch = !snapshotEdge
    ? "Route is outside the immutable Root Run repair allowlist."
    : route.kind !== "repair" || route.sourceLoopId !== snapshotEdge.source || route.targetLoopId !== snapshotEdge.target
      ? "Persisted repair route identity does not match its immutable Root Run policy."
      : capabilityMismatch(root, snapshotEdge);
  if (mismatch) return { route, state: "blocked", reason: mismatch };
  const targetIsActive = loopRuns.some((run) =>
    run.rootRunId === route.rootRunId
    && run.orchestrationRequestId === route.orchestrationRequestId
    && run.loopId === route.targetLoopId
    && isLiveStatus(run.status));
  return { route, state: targetIsActive ? "active" : "recorded" };
}

function capabilityMismatch(root: RootRun | undefined, edge: ProjectRepairEdge): string | undefined {
  const target = root?.executionSnapshot.loops.find((loop) => loop.id === edge.target);
  return target?.capabilities.provides.includes(edge.capability)
    ? undefined
    : `Target Loop does not provide repair capability ${edge.capability}.`;
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
