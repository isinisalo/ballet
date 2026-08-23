import type { ProjectAutomationConfig, ProjectExecutionComposition } from "../../shared/domain/automation.js";
import type { PolicyPreviewRequestV2 } from "../../shared/api/workspace-contracts.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import {
  AutomationConflictError,
  AutomationValidationError,
  loadProjectAutomationConfigWithIssues,
  saveProjectAutomationConfig,
  validateProjectExecutionResources,
  validateProjectAutomationConfig
} from "../automation.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";
import type { PolicyPreviewResultV2 } from "../../shared/domain/decisionModel.js";
import { decisionModelSha256 } from "../policy/DecisionModelCanonical.js";
import { evaluatePolicyDecision } from "../policy/PolicyRuntime.js";
import { derivePolicyProjection } from "../policy/PolicyProjection.js";

export class AutomationService {
  private readonly projectConfigurations = new ProjectConfigurationRepository();
  constructor(private readonly root: () => string, private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider) {}

  async save(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    const [current, resources] = await Promise.all([
      loadProjectAutomationConfigWithIssues(this.root()),
      loadProjectResources(this.root())
    ]);
    const activeGraphNodeIds = this.runtimeDatabaseProvider.runtimeDatabase().activeGraphNodeIds();
    for (const graphNodeId of activeGraphNodeIds) {
      const before = current.config.graph.graphNodes.find((node) => node.id === graphNodeId);
      const after = config.graph.graphNodes.find((node) => node.id === graphNodeId);
      if (!before || !after || JSON.stringify(before) !== JSON.stringify(after)) {
        throw new AutomationConflictError(`Graph Node ${graphNodeId} cannot be edited while it has an active Run.`);
      }
    }
    const resourceIssues = validateProjectExecutionResources(config, resources);
    if (resourceIssues.length) throw new AutomationValidationError("Execution resources are invalid.", resourceIssues);
    return saveProjectAutomationConfig(this.root(), config);
  }

  previewPolicy(input: PolicyPreviewRequestV2): PolicyPreviewResultV2 {
    const { config } = input;
    const loaded = this.projectConfigurations.load(this.root());
    const allIssues = validateProjectAutomationConfig(config, loaded.config?.executionProfiles ?? []);
    const graphNodeIndex = input.graphNodeId
      ? config.graph.graphNodes.findIndex(({ id }) => id === input.graphNodeId) : -1;
    const issuePrefix = input.scope === "graph" ? "graph.strategy" : `graph.graphNodes.${graphNodeIndex}.strategy`;
    const issues = allIssues.filter(({ path }) => path.startsWith(issuePrefix));
    if (issues.length) return { issues };
    const graphNode = input.scope === "graph_node" ? config.graph.graphNodes[graphNodeIndex] : undefined;
    if (input.scope === "graph_node" && !graphNode) return {
      issues: [{ path: "graphNodeId", message: `Graph Node ${String(input.graphNodeId)} was not found.` }]
    };
    const strategy = graphNode?.strategy ?? config.graph.strategy;
    if (strategy.kind !== "ssp_v2") return {
      issues: [{ path: issuePrefix, message: "Policy Preview requires the explicit ssp_v2 strategy." }]
    };
    const actionIds = graphNode ? graphNode.jobNodes.map(({ id }) => id) : config.graph.graphNodes.map(({ id }) => id);
    const modelSha256 = decisionModelSha256(strategy.model);
    const evaluation = evaluatePolicyDecision({
      strategy,
      context: {
        epochKind: "start",
        actionInvocationCount: 0,
        stateRevision: 0,
        projectState: config.graph.state.initial,
        authorizationFacts: config.graph.state.initial,
        evidenceRefs: ["configure:draft-unsnapshotted"]
      },
      snapshotGraphNodeIds: actionIds,
      modelSha256
    });
    return {
      issues: [],
      preview: {
        derived: true,
        persisted: false,
        scope: input.scope,
        scopeKey: graphNode?.id ?? "graph",
        state: evaluation.state,
        admissibleActionIds: evaluation.admissible.actionIds,
        excludedActions: evaluation.admissible.excludedActions,
        selectedActionId: evaluation.solution?.selectedActionId,
        actionValues: evaluation.solution?.actionValues ?? [],
        expectedRemainingCostMicros: evaluation.solution?.stateValueMicros,
        solverStatus: evaluation.status,
        modelVersion: 2,
        modelSha256,
        projection: evaluation.state && evaluation.status === "converged" ? derivePolicyProjection({
          strategy,
          scope: input.scope,
          currentStateId: evaluation.state.stateId,
          snapshotActionIds: actionIds,
          modelSha256,
          source: "configure_draft"
        }) : undefined,
        message: evaluation.message
      }
    };
  }

  createExecutionProfile(profile: ExecutionProfile): ExecutionProfile {
    const config = this.projectConfigurations.createExecutionProfile(this.root(), profile);
    return config.executionProfiles.find((candidate) => candidate.id === profile.id)!;
  }
  updateExecutionProfile(profile: ExecutionProfile): ExecutionProfile {
    const config = this.projectConfigurations.updateExecutionProfile(this.root(), profile);
    return config.executionProfiles.find((candidate) => candidate.id === profile.id)!;
  }
  removeExecutionProfile(executionProfileId: string): void {
    this.assertExecutionProfileRemovable(executionProfileId);
    this.projectConfigurations.removeExecutionProfile(this.root(), executionProfileId);
  }
  assertExecutionProfileRemovable(executionProfileId: string): void {
    const loaded = this.projectConfigurations.load(this.root());
    if (!loaded.config) throw new AutomationValidationError("Project config is invalid.", loaded.issues.map(({ path, message }) => ({ path, message })));
    const references = compositions(loaded.config.graph).filter(({ composition }) =>
      composition.executionProfileId === executionProfileId).map(({ path }) => path);
    if (references.length) throw new AutomationConflictError(
      `Execution profile ${executionProfileId} is referenced by execution compositions: ${references.join(", ")}.`
    );
  }
  async assertProjectResourceRemovable(resourceId: string): Promise<void> {
    const loaded = await loadProjectAutomationConfigWithIssues(this.root());
    if (loaded.issues.length) throw new AutomationValidationError("Automation config is invalid.", loaded.issues);
    const references = compositions(loaded.config.graph).filter(({ composition }) =>
      composition.primaryInstructionId === resourceId || composition.skillIds.includes(resourceId)).map(({ path }) => path);
    if (references.length) throw new AutomationConflictError(
      `Project resource ${resourceId} is referenced by execution compositions: ${references.join(", ")}.`
    );
  }
}

const compositions = (graph: ProjectAutomationConfig["graph"]): Array<{ path: string; composition: ProjectExecutionComposition }> => [
  ...(graph.strategy.kind === "agent_v1"
    ? [{ path: "graph.strategy.orchestrator", composition: graph.strategy.orchestrator }] : []),
  ...(graph.repairNode ? [{ path: "graph.repairNode", composition: graph.repairNode }] : []),
  ...graph.graphNodes.flatMap((graphNode) => [
    ...(graphNode.strategy.kind === "agent_v1"
      ? [{ path: `${graphNode.id}.strategy.orchestrator`, composition: graphNode.strategy.orchestrator }] : []),
    ...(graphNode.repairNode ? [{ path: `${graphNode.id}.repairNode`, composition: graphNode.repairNode }] : []),
    ...graphNode.jobNodes.flatMap((jobNode) => [
      ...(jobNode.workNode.type === "agent" ? [{ path: `${graphNode.id}.${jobNode.id}.work`, composition: jobNode.workNode }] : []),
      ...(jobNode.validationNode.type === "agent" ? [{ path: `${graphNode.id}.${jobNode.id}.validation`, composition: jobNode.validationNode }] : [])
    ])
  ])
];
