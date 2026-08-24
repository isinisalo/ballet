import type { ProjectExecutionComposition, ProjectGraph } from "../../shared/domain/automation.js";
import type {
  AcceptanceLedgerSnapshotV1,
  AuthorizationSnapshotV1,
  CompiledRewardPolicyV4
} from "../../shared/domain/decisionModel.js";
import type { ExecutionRuntimeBinding, RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type { RootRunKind } from "../../shared/domain/runs.js";
import { CanvasThemeRepository } from "../canvas-themes/CanvasThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { resolveExecutionResources } from "../execution/ExecutionResourceCatalog.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import { GraphRunStateError } from "../runtime/GraphRunErrors.js";
import {
  compilePolicyScope,
  describePolicyScope,
  policyGuardContext,
  scopedDecisionModelSha256
} from "../policy/PolicyScope.js";
import { validateProjectAutomationConfig } from "../automation/validateAutomationConfig.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

export class GraphExecutionPlanner {
  constructor(
    private readonly configurations: RuntimeConfigurationService,
    private readonly runtime: LocalRuntimeService
  ) {}

  async create(workspace: PreparedRootWorkspace, kind: RootRunKind, targetId: string): Promise<RootExecutionSnapshot> {
    const loaded = new ProjectConfigurationRepository().load(workspace.path);
    if (!loaded.config || loaded.issues.length > 0) throw new GraphRunStateError(
      loaded.issues[0]?.message ?? "Project configuration v19 is unavailable."
    );
    const readinessIssues = validateProjectAutomationConfig(
      { version: 19, graph: loaded.config.graph }, loaded.config.executionProfiles
    );
    if (readinessIssues.length) throw new GraphRunStateError(readinessIssues[0]!.message);
    assertTarget(loaded.config.graph, kind, targetId);
    const graph = structuredClone(loaded.config.graph);
    const compositions = collectCompositions(graph, kind === "graph_node" ? targetId : undefined);
    const profiles = [...new Set(compositions.map(({ executionProfileId }) => executionProfileId))].sort().map((id) => {
      const profile = loaded.config!.executionProfiles.find((candidate) => candidate.id === id);
      if (!profile) throw new GraphRunStateError(`Execution profile ${id} is missing from the immutable snapshot.`);
      return profile;
    });
    const readOnlyRoots = await this.configurations.readOnlyRootsForRun();
    const runtimes: ExecutionRuntimeBinding[] = [];
    for (const profile of profiles) {
      const resolved = await this.configurations.require(profile, readOnlyRoots);
      runtimes.push({ executionProfileId: profile.id, runtime: (await this.runtime.preflight(resolved)).runtime });
    }
    const theme = await new CanvasThemeRepository().load(workspace.path);
    if (theme.issues.length > 0) throw new GraphRunStateError(theme.issues[0]!.message);
    const authorization = authorizationSnapshot();
    const acceptanceLedger = acceptanceSnapshot(graph);
    const guardContext = policyGuardContext({
      graphState: graph.state.initial,
      stateRevision: 0,
      authorization,
      acceptanceLedger
    });
    const global = kind === "graph" ? compilePolicyScope(graph, "graph", guardContext) : undefined;
    if (global && global.status !== "compiled") throw compileError("Graph", global);
    const localIds = kind === "graph" ? graph.graphNodes.map(({ id }) => id) : [targetId];
    const localPolicies: Record<string, CompiledRewardPolicyV4> = {};
    for (const graphNodeId of localIds) {
      const compiled = compilePolicyScope(graph, "graph_node", guardContext, graphNodeId);
      if (compiled.status !== "compiled") throw compileError(`Graph Node ${graphNodeId}`, compiled);
      localPolicies[graphNodeId] = compiled;
    }
    const graphNodeDecisionModels = Object.fromEntries(localIds.map((graphNodeId) => {
      const descriptor = describePolicyScope(graph, "graph_node", graphNodeId);
      return [graphNodeId, {
        strategyKind: "reward_mdp_v4" as const,
        modelVersion: 4 as const,
        modelSha256: scopedDecisionModelSha256(descriptor)
      }];
    }));
    return {
      version: 12,
      policyObservationContractVersion: 5,
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
      decisionModels: {
        ...(kind === "graph" ? {
          global: {
            strategyKind: "reward_mdp_v4" as const,
            modelVersion: 4 as const,
            modelSha256: scopedDecisionModelSha256(describePolicyScope(graph, "graph"))
          }
        } : {}),
        graphNodes: graphNodeDecisionModels
      },
      theme: theme.theme,
      executionProfiles: structuredClone(profiles),
      runtimes,
      resources: await resolveExecutionResources(workspace.path, compositions),
      authorization,
      acceptanceLedger,
      compiledPolicies: { ...(global ? { global } : {}), graphNodes: localPolicies },
      createdAt: new Date().toISOString()
    };
  }
}

function compileError(label: string, compiled: CompiledRewardPolicyV4): GraphRunStateError {
  return new GraphRunStateError(compiled.message ?? `${label} Reward-MDP compilation failed with ${compiled.status}.`);
}

function assertTarget(graph: ProjectGraph, kind: RootRunKind, targetId: string): void {
  if (kind === "graph" && graph.id !== targetId) throw new GraphRunStateError(`Graph ${targetId} was not found.`);
  if (kind === "graph_node" && !graph.graphNodes.some(({ id }) => id === targetId)) {
    throw new GraphRunStateError(`Graph Node ${targetId} was not found.`);
  }
}

function collectCompositions(graph: ProjectGraph, graphNodeId?: string): Array<ProjectExecutionComposition & { id: string }> {
  const result: Array<ProjectExecutionComposition & { id: string }> = [];
  for (const graphNode of graph.graphNodes) {
    if (graphNodeId && graphNode.id !== graphNodeId) continue;
    for (const action of graphNode.actionNodes) {
      if (action.workNode.type === "agent") result.push(action.workNode);
      if (action.validationNode.type === "agent") result.push(action.validationNode);
    }
  }
  return result;
}

function authorizationSnapshot(): AuthorizationSnapshotV1 {
  const facts = { localExecutionAuthorized: true, externalWritesAuthorized: false };
  return { version: 1, facts, sha256: jsonSha256(facts) };
}

function acceptanceSnapshot(graph: ProjectGraph): AcceptanceLedgerSnapshotV1 {
  const entries = graph.acceptance.obligations.map(({ obligationId, weight }) => ({
    obligationId,
    weight,
    status: "pending" as const,
    evidenceRefs: []
  })).sort((left, right) => left.obligationId.localeCompare(right.obligationId));
  return { version: 1, entries, sha256: jsonSha256(entries) };
}
