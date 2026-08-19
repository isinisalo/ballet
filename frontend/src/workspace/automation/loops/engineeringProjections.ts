import {
  defaultLoopNodeStyle,
  type LoopNodeStyle,
  type InstalledLoopModuleStatus,
  type ProjectAutomationConfig,
  type ProjectLoop,
  type ProjectLoopEdge,
  type ProjectNodeEdge,
  type ProjectWorkLoopNode
} from "@shared/api/workspace-contracts";

export interface GraphEngineeringNode {
  loopId: string;
  title: string;
  description: string;
  kind: "installed" | "custom";
  moduleVersion?: string;
  provenanceStatus?: InstalledLoopModuleStatus["status"];
  workLoopNodeCount: number;
  capabilities: string[];
  artworkStyle: LoopNodeStyle;
  locked: boolean;
}

export interface GraphEngineeringProjection {
  nodes: GraphEngineeringNode[];
  edges: ProjectLoopEdge[];
}

export interface GraphEngineeringFocus {
  edges: ProjectLoopEdge[];
  visibleRepairCount: number;
  hiddenRepairCount: number;
}

export interface LoopEngineeringProjection {
  loop: ProjectLoop;
  nodes: ProjectWorkLoopNode[];
  edges: ProjectNodeEdge[];
  startNodeId: string;
  terminals: Array<"completed" | "blocked" | "failed">;
}

export function buildGraphEngineeringProjection({
  config,
  installedModules = [],
  lockedLoopIds = new Set<string>()
}: {
  config: ProjectAutomationConfig;
  installedModules?: InstalledLoopModuleStatus[];
  lockedLoopIds?: ReadonlySet<string>;
}): GraphEngineeringProjection {
  const installedByLoopId = new Map(installedModules.map((module) => [module.loopId, module]));
  return {
    nodes: config.loops.map((loop) => {
      const installed = installedByLoopId.get(loop.id);
      const startNode = loop.nodes.find((node) => node.id === loop.startNodeId);
      return {
        loopId: loop.id,
        title: installed?.title ?? loop.id,
        description: loop.description,
        kind: installed ? "installed" : "custom",
        moduleVersion: installed?.moduleVersion,
        provenanceStatus: installed?.status,
        workLoopNodeCount: loop.nodes.length,
        capabilities: installed?.capabilities.provides.slice(0, 2) ?? [],
        artworkStyle: startNode?.work.nodeStyle ?? defaultLoopNodeStyle,
        locked: lockedLoopIds.has(loop.id)
      };
    }),
    edges: config.graph.loopEdges.map((edge) => ({ ...edge }))
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
    : [];
  return {
    edges: [...flowEdges, ...visibleRepairEdges],
    visibleRepairCount: visibleRepairEdges.length,
    hiddenRepairCount: repairEdges.length - visibleRepairEdges.length
  };
}

export function buildLoopEngineeringProjection(
  config: ProjectAutomationConfig,
  selectedLoopId: string
): LoopEngineeringProjection | undefined {
  const loop = config.loops.find((candidate) => candidate.id === selectedLoopId);
  if (!loop) return undefined;
  const terminals = uniqueStrings(loop.edges.flatMap((edge) =>
    "terminal" in edge.target ? [edge.target.terminal] : [])) as LoopEngineeringProjection["terminals"];
  return {
    loop,
    nodes: loop.nodes.map((node) => ({ ...node })),
    edges: loop.edges.map((edge) => ({ ...edge })),
    startNodeId: loop.startNodeId,
    terminals
  };
}

const uniqueStrings = (values: string[]) => [...new Set(values)];
