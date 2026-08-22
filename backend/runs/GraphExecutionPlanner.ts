import type { ProjectExecutionComposition, ProjectGraph } from "../../shared/domain/automation.js";
import type { ExecutionRuntimeBinding, RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type { RootRunKind } from "../../shared/domain/runs.js";
import { CanvasThemeRepository } from "../canvas-themes/CanvasThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { resolveExecutionResources } from "../execution/ExecutionResourceCatalog.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import { GraphRunStateError } from "../runtime/GraphRunErrors.js";

export class GraphExecutionPlanner {
  constructor(
    private readonly configurations: RuntimeConfigurationService,
    private readonly runtime: LocalRuntimeService
  ) {}

  async create(
    workspace: PreparedRootWorkspace,
    kind: RootRunKind,
    targetId: string
  ): Promise<RootExecutionSnapshot> {
    const loaded = new ProjectConfigurationRepository().load(workspace.path);
    if (!loaded.config || loaded.issues.length > 0) {
      throw new GraphRunStateError(loaded.issues[0]?.message ?? "Project configuration v14 is unavailable.");
    }
    const selected = kind === "graph"
      ? loaded.config.graph.graphNodes
      : loaded.config.graph.graphNodes.filter(({ id }) => id === targetId);
    if (kind === "graph" && loaded.config.graph.id !== targetId) {
      throw new GraphRunStateError(`Graph ${targetId} was not found.`);
    }
    if (kind === "graph_node" && selected.length !== 1) {
      throw new GraphRunStateError(`Graph Node ${targetId} was not found.`);
    }
    const graph: ProjectGraph = kind === "graph"
      ? structuredClone(loaded.config.graph)
      : { ...structuredClone(loaded.config.graph), graphNodes: structuredClone(selected) };
    const compositions = collectCompositions(graph);
    const profileIds = [...new Set(compositions.map(({ executionProfileId }) => executionProfileId))].sort();
    const profiles = profileIds.map((id) => {
      const profile = loaded.config!.executionProfiles.find((candidate) => candidate.id === id);
      if (!profile) throw new GraphRunStateError(`Execution profile ${id} is missing from the immutable snapshot.`);
      return profile;
    });
    const readOnlyRoots = await this.configurations.readOnlyRootsForRun();
    const runtimes: ExecutionRuntimeBinding[] = [];
    for (const profile of profiles) {
      const resolved = await this.configurations.require(profile, readOnlyRoots);
      runtimes.push({
        executionProfileId: profile.id,
        runtime: (await this.runtime.preflight(resolved)).runtime
      });
    }
    const theme = await new CanvasThemeRepository().load(workspace.path);
    if (theme.issues.length > 0) throw new GraphRunStateError(theme.issues[0]!.message);
    return {
      version: 7,
      rootKind: kind,
      ...(kind === "graph_node" ? { rootGraphNodeId: targetId } : {}),
      project: {
        checkoutRoot: workspace.path,
        headSha: workspace.headSha,
        configHash: workspace.configHash,
        snapshotHash: workspace.snapshotHash
      },
      issueTracker: structuredClone(loaded.config.issueTracker),
      graph,
      theme: theme.theme,
      executionProfiles: structuredClone(profiles),
      runtimes,
      resources: await resolveExecutionResources(workspace.path, compositions),
      createdAt: new Date().toISOString()
    };
  }
}

const collectCompositions = (graph: ProjectGraph): Array<ProjectExecutionComposition & { id: string }> => {
  const result: Array<ProjectExecutionComposition & { id: string }> = [graph.orchestrator];
  if (graph.repairNode) result.push(graph.repairNode);
  for (const graphNode of graph.graphNodes) {
    result.push(graphNode.orchestrator);
    if (graphNode.repairNode) result.push(graphNode.repairNode);
    for (const job of graphNode.jobNodes) {
      if (job.workNode.type === "agent") result.push(job.workNode);
      if (job.validationNode.type === "agent") result.push(job.validationNode);
    }
  }
  return result;
};
