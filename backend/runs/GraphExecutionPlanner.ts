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
import { capabilityModelSha256, decisionModelSha256 } from "../policy/DecisionModelCanonical.js";
import { validateProjectAutomationConfig } from "../automation/validateAutomationConfig.js";

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
      throw new GraphRunStateError(loaded.issues[0]?.message ?? "Project configuration v16 is unavailable.");
    }
    const readinessIssues = validateProjectAutomationConfig(
      { version: 16, graph: loaded.config.graph }, loaded.config.executionProfiles
    );
    if (readinessIssues.length) throw new GraphRunStateError(readinessIssues[0]!.message);
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
      version: 9,
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
      graphDecision: graph.strategy.kind === "ssp_v2" ? {
        strategyKind: "ssp_v2",
        modelVersion: graph.strategy.model.version,
        modelSha256: decisionModelSha256(graph.strategy.model),
        capabilityModelSha256: capabilityModelSha256(graph.strategy.capabilityModel)
      } : { strategyKind: "agent_v1" },
      graphNodeDecisions: Object.fromEntries(graph.graphNodes.map((graphNode) => [graphNode.id,
        graphNode.strategy.kind === "ssp_v2" ? {
          strategyKind: "ssp_v2" as const,
          modelVersion: graphNode.strategy.model.version,
          modelSha256: decisionModelSha256(graphNode.strategy.model),
          capabilityModelSha256: capabilityModelSha256(graphNode.strategy.capabilityModel)
        } : { strategyKind: "agent_v1" as const }
      ])),
      theme: theme.theme,
      executionProfiles: structuredClone(profiles),
      runtimes,
      resources: await resolveExecutionResources(workspace.path, compositions),
      createdAt: new Date().toISOString()
    };
  }
}

const collectCompositions = (graph: ProjectGraph): Array<ProjectExecutionComposition & { id: string }> => {
  const result: Array<ProjectExecutionComposition & { id: string }> = graph.strategy.kind === "agent_v1"
    ? [graph.strategy.orchestrator] : [];
  if (graph.repairNode) result.push(graph.repairNode);
  for (const graphNode of graph.graphNodes) {
    if (graphNode.strategy.kind === "agent_v1") result.push(graphNode.strategy.orchestrator);
    if (graphNode.repairNode) result.push(graphNode.repairNode);
    for (const job of graphNode.jobNodes) {
      if (job.workNode.type === "agent") result.push(job.workNode);
      if (job.validationNode.type === "agent") result.push(job.validationNode);
    }
  }
  return result;
};
