import type { ProjectAutomationConfig, ProjectExecutionComposition } from "../../shared/domain/automation.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import {
  AutomationConflictError,
  AutomationValidationError,
  loadProjectAutomationConfigWithIssues,
  saveProjectAutomationConfig,
  validateProjectExecutionResources
} from "../automation.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";

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
  { path: "graph.orchestrator", composition: graph.orchestrator },
  ...(graph.repairNode ? [{ path: "graph.repairNode", composition: graph.repairNode }] : []),
  ...graph.graphNodes.flatMap((graphNode) => [
    { path: `${graphNode.id}.orchestrator`, composition: graphNode.orchestrator },
    ...(graphNode.repairNode ? [{ path: `${graphNode.id}.repairNode`, composition: graphNode.repairNode }] : []),
    ...graphNode.jobNodes.flatMap((jobNode) => [
      ...(jobNode.workNode.type === "agent" ? [{ path: `${graphNode.id}.${jobNode.id}.work`, composition: jobNode.workNode }] : []),
      ...(jobNode.validationNode.type === "agent" ? [{ path: `${graphNode.id}.${jobNode.id}.validation`, composition: jobNode.validationNode }] : [])
    ])
  ])
];
