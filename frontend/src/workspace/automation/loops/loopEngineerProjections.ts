import type {
  InstalledLoopModuleStatus,
  Project,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectLoopEdge,
  ProjectNodeEdge,
  ProjectWorkLoopNode
} from "@shared/api/workspace-contracts";

export interface LoopContextProjection {
  projectIntent: {
    name: string;
    description?: string;
    missingDescription: boolean;
    entryLoopCount: number;
  };
  system: {
    loopCount: number;
    installedModuleCount: number;
    customLoopCount: number;
    flowConnectionCount: number;
    repairConnectionCount: number;
    activeRunCount: number;
  };
  declaredOutcomes: string[];
  hiddenOutcomeCount: number;
}

export interface LoopCompositionNode {
  loopId: string;
  title: string;
  description: string;
  kind: "installed" | "custom";
  moduleVersion?: string;
  provenanceStatus?: InstalledLoopModuleStatus["status"];
  workLoopNodeCount: number;
  capabilities: string[];
  locked: boolean;
}

export interface LoopCompositionProjection {
  nodes: LoopCompositionNode[];
  edges: ProjectLoopEdge[];
}

export interface LoopDetailProjection {
  loop: ProjectLoop;
  nodes: ProjectWorkLoopNode[];
  edges: ProjectNodeEdge[];
  startNodeId: string;
  terminals: Array<"completed" | "blocked" | "failed">;
}

export function buildLoopContextProjection({
  project,
  config,
  installedModules = [],
  activeLoopIds = new Set<string>()
}: {
  project: Pick<Project, "name" | "description">;
  config: ProjectAutomationConfig;
  installedModules?: InstalledLoopModuleStatus[];
  activeLoopIds?: ReadonlySet<string>;
}): LoopContextProjection {
  const incomingFlowTargets = new Set(config.loopEdges
    .filter((edge) => edge.kind === "flow")
    .map((edge) => edge.target));
  const outgoingFlowSources = new Set(config.loopEdges
    .filter((edge) => edge.kind === "flow")
    .map((edge) => edge.source));
  const installedByLoopId = new Map(installedModules.map((module) => [module.loopId, module]));
  const outcomeCandidates = uniqueStrings([
    ...installedModules.flatMap((module) => module.capabilities.provides),
    ...config.loops
      .filter((loop) => !outgoingFlowSources.has(loop.id))
      .map((loop) => installedByLoopId.get(loop.id)?.title || loop.description || loop.id)
  ]);
  const description = project.description.trim();

  return {
    projectIntent: {
      name: project.name,
      description: description || undefined,
      missingDescription: !description,
      entryLoopCount: config.loops.filter((loop) => !incomingFlowTargets.has(loop.id)).length
    },
    system: {
      loopCount: config.loops.length,
      installedModuleCount: config.loops.filter((loop) => installedByLoopId.has(loop.id)).length,
      customLoopCount: config.loops.filter((loop) => !installedByLoopId.has(loop.id)).length,
      flowConnectionCount: config.loopEdges.filter((edge) => edge.kind === "flow").length,
      repairConnectionCount: config.loopEdges.filter((edge) => edge.kind === "repair").length,
      activeRunCount: config.loops.filter((loop) => activeLoopIds.has(loop.id)).length
    },
    declaredOutcomes: outcomeCandidates.slice(0, 5),
    hiddenOutcomeCount: Math.max(0, outcomeCandidates.length - 5)
  };
}

export function buildLoopCompositionProjection({
  config,
  installedModules = [],
  lockedLoopIds = new Set<string>()
}: {
  config: ProjectAutomationConfig;
  installedModules?: InstalledLoopModuleStatus[];
  lockedLoopIds?: ReadonlySet<string>;
}): LoopCompositionProjection {
  const installedByLoopId = new Map(installedModules.map((module) => [module.loopId, module]));
  return {
    nodes: config.loops.map((loop) => {
      const installed = installedByLoopId.get(loop.id);
      return {
        loopId: loop.id,
        title: installed?.title ?? loop.id,
        description: loop.description,
        kind: installed ? "installed" : "custom",
        moduleVersion: installed?.moduleVersion,
        provenanceStatus: installed?.status,
        workLoopNodeCount: loop.nodes.length,
        capabilities: installed?.capabilities.provides.slice(0, 2) ?? [],
        locked: lockedLoopIds.has(loop.id)
      };
    }),
    edges: config.loopEdges.map((edge) => ({ ...edge }))
  };
}

export function buildLoopDetailProjection(
  config: ProjectAutomationConfig,
  selectedLoopId: string
): LoopDetailProjection | undefined {
  const loop = config.loops.find((candidate) => candidate.id === selectedLoopId);
  if (!loop) return undefined;
  const terminals = uniqueStrings(loop.edges.flatMap((edge) =>
    "terminal" in edge.target ? [edge.target.terminal] : [])) as LoopDetailProjection["terminals"];
  return {
    loop,
    nodes: loop.nodes.map((node) => ({ ...node })),
    edges: loop.edges.map((edge) => ({ ...edge })),
    startNodeId: loop.startNodeId,
    terminals
  };
}

const uniqueStrings = (values: string[]) => [...new Set(values)];
