import type { ProjectAutomationConfig, ProjectExecutionComposition } from "../../shared/domain/automation.js";
import type { PolicyPreviewRequestV4 } from "../../shared/api/workspace-contracts.js";
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
import type { PolicyPreviewResultV4 } from "../../shared/domain/decisionModel.js";
import { decisionState } from "../policy/DecisionStateProjector.js";
import { resolveAdmissibleActions } from "../policy/AdmissibleActionResolver.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import {
  compilePolicyScope,
  describePolicyScope,
  policyGuardContext,
  scopedDecisionModelSha256
} from "../policy/PolicyScope.js";

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

  previewPolicy(input: PolicyPreviewRequestV4): PolicyPreviewResultV4 {
    const { config, scope, graphNodeId } = input;
    const loaded = this.projectConfigurations.load(this.root());
    const allIssues = validateProjectAutomationConfig(config, loaded.config?.executionProfiles ?? []);
    const scopePath = scope === "graph" ? "graph.strategy"
      : `graph.graphNodes.${config.graph.graphNodes.findIndex(({ id }) => id === graphNodeId)}.strategy`;
    const issues = allIssues.filter(({ path }) => path.startsWith(scopePath));
    if (issues.length) return { issues };
    if (scope === "graph_node" && !config.graph.graphNodes.some(({ id }) => id === graphNodeId)) return {
      issues: [{ path: "graphNodeId", message: `Graph Node ${graphNodeId ?? "<missing>"} was not found.` }]
    };
    const entries = config.graph.acceptance.obligations.map(({ obligationId, weight }) => ({
      obligationId, weight, status: "pending" as const, evidenceRefs: []
    })).sort((left, right) => left.obligationId.localeCompare(right.obligationId));
    const acceptanceLedger = { version: 1 as const, entries, sha256: jsonSha256(entries) };
    const authorizationFacts = { localExecutionAuthorized: true, externalWritesAuthorized: false };
    const authorization = { version: 1 as const, facts: authorizationFacts, sha256: jsonSha256(authorizationFacts) };
    const guardContext = policyGuardContext({
      graphState: config.graph.state.initial, stateRevision: 0, authorization, acceptanceLedger
    });
    const descriptor = describePolicyScope(config.graph, scope, graphNodeId);
    const modelSha256 = scopedDecisionModelSha256(descriptor);
    const compiled = compilePolicyScope(config.graph, scope, guardContext, graphNodeId);
    const state = decisionState({
      scope, graphNodeId, stateId: descriptor.strategy.model.initialStateId, graph: config.graph,
      sourceStateRevision: 0, evidenceRefs: ["configure:draft-unsnapshotted"]
    });
    const admissible = resolveAdmissibleActions(
      descriptor.strategy, state.stateId, descriptor.actionIds, guardContext
    );
    const current = compiled.states.find(({ stateId }) => stateId === state.stateId);
    return {
      issues: [],
      preview: {
        derived: true,
        persisted: false,
        scope,
        ...(graphNodeId ? { graphNodeId } : {}),
        state,
        admissibleActionIds: admissible.actionIds,
        excludedActions: admissible.excludedActions,
        selectedActionId: current?.selectedActionId,
        actionValues: current?.actionValues ?? [],
        expectedReturnMicros: current?.valueMicros,
        solverStatus: compiled.status,
        modelVersion: 4,
        modelSha256,
        policySha256: compiled.policySha256,
        compiledPolicy: compiled,
        message: compiled.message
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
  ...graph.graphNodes.flatMap((graphNode) => [
    ...graphNode.actionNodes.flatMap((actionNode) => [
      ...(actionNode.workNode.type === "agent" ? [{ path: `${graphNode.id}.${actionNode.id}.work`, composition: actionNode.workNode }] : []),
      ...(actionNode.validationNode.type === "agent" ? [{ path: `${graphNode.id}.${actionNode.id}.validation`, composition: actionNode.validationNode }] : [])
    ])
  ])
];
