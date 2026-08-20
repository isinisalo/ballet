import {
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type ProjectAutomationConfig,
  type ProjectExecutionComposition
} from "../../shared/domain/automation.js";
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
import { LoopRunConflictError } from "../runtime/LoopRunErrors.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";

export class AutomationService {
  private readonly projectConfigurations = new ProjectConfigurationRepository();

  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider
  ) {}

  async save(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    const [current, resources] = await Promise.all([
      loadProjectAutomationConfigWithIssues(this.root()),
      loadProjectResources(this.root())
    ]);
    const activeLoopIds = this.runtimeDatabaseProvider.runtimeDatabase().activeLoopIds();
    for (const loopId of activeLoopIds) {
      const before = current.config.loops.find((loop) => loop.id === loopId);
      const after = config.loops.find((loop) => loop.id === loopId);
      if (!before || !after || JSON.stringify(before) !== JSON.stringify(after)) {
        throw new LoopRunConflictError(`Loop ${loopId} cannot be edited while it has an active run.`);
      }
    }
    const resourceIssues = validateProjectExecutionResources(config, resources);
    if (resourceIssues.length > 0) {
      throw new AutomationValidationError("Execution resources are invalid.", resourceIssues);
    }
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
    if (!loaded.config) {
      throw new AutomationValidationError(
        "Project config is invalid.",
        loaded.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      );
    }
    const references = loaded.config.loops.flatMap((loop) => [
      ...loop.workflow.jobNodes.flatMap((node) =>
        isProjectProviderJobNode(node) && node.executionProfileId === executionProfileId
          ? [`${loop.id}:${node.id}:job`] : []),
      ...loop.workflow.validationNodes.flatMap((node) =>
        isProjectAgentValidationNode(node) && node.executionProfileId === executionProfileId
          ? [`${loop.id}:${node.id}:validation`] : [])
    ]);
    if (loaded.config.orchestrator.executionProfileId === executionProfileId) references.push("orchestrator");
    if (references.length > 0) throw new AutomationConflictError(
      `Execution profile ${executionProfileId} is referenced by execution compositions: ${references.join(", ")}.`
    );
  }

  async assertProjectResourceRemovable(resourceId: string): Promise<void> {
    const automation = await loadProjectAutomationConfigWithIssues(this.root());
    if (automation.issues.length > 0) {
      throw new AutomationValidationError("Automation config is invalid.", automation.issues);
    }
    const references = automation.config.loops.flatMap((loop) => [
      ...loop.workflow.jobNodes.flatMap((node) =>
        isProjectProviderJobNode(node) && compositionReferences(node, resourceId)
          ? [`${loop.id}:${node.id}:job`] : []),
      ...loop.workflow.validationNodes.flatMap((node) =>
        isProjectAgentValidationNode(node) && compositionReferences(node, resourceId)
          ? [`${loop.id}:${node.id}:validation`] : [])
    ]);
    if (compositionReferences(automation.config.orchestrator, resourceId)) references.push("orchestrator");
    if (references.length > 0) {
      throw new AutomationConflictError(
        `Project resource ${resourceId} is referenced by execution compositions: ${references.join(", ")}.`
      );
    }
  }
}

const compositionReferences = (composition: ProjectExecutionComposition, resourceId: string): boolean =>
  composition.primaryInstructionId === resourceId || composition.skillIds.includes(resourceId);
