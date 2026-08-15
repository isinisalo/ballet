import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { validateProjectAutomationConfig } from "../automation.js";
import { composeExecutionPrompt, resolveExecutionResources } from "../execution/ExecutionComposition.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { LoopRunNotFoundError, LoopRunStateError } from "../runtime/LoopRunErrors.js";
import { serializeTaskEnvelopeV1 } from "../integration/TaskEnvelopeV1.js";
import { reachableExecutionSteps, reachableLoops } from "./LoopExecutionSnapshot.js";

export class LoopExecutionPlanner {
  private readonly projects = new ProjectConfigurationRepository();
  private readonly themes = new LoopThemeRepository();

  constructor(
    private readonly configurations: RuntimeConfigurationService,
    private readonly runtime: LocalRuntimeService
  ) {}

  async create(
    workspace: PreparedRootWorkspace,
    rootLoopId: string,
    runInput = ""
  ): Promise<RootExecutionSnapshot> {
    const loaded = this.projects.load(workspace.path);
    if (!loaded.config || loaded.issues.length > 0) {
      const issue = loaded.issues[0];
      throw new LoopRunStateError(issue
        ? `Project configuration is invalid at ${issue.path}: ${issue.message}`
        : "The prepared Run workspace has no valid strict v9 project configuration.");
    }
    const automationIssues = validateProjectAutomationConfig(
      { version: 9, loops: loaded.config.loops },
      loaded.config.executionProfiles
    );
    if (automationIssues.length > 0) {
      const issue = automationIssues[0]!;
      throw new LoopRunStateError(`Project automation is invalid at ${issue.path}: ${issue.message}`);
    }
    const theme = await this.themes.load(workspace.path);
    if (theme.issues.length > 0) {
      const issue = theme.issues[0]!;
      throw new LoopRunStateError(`Loop theme is invalid at ${issue.path}: ${issue.message}`);
    }

    const loops = reachableLoops(loaded.config, rootLoopId);
    const steps = reachableExecutionSteps(loaded.config, rootLoopId);
    let readOnlyRoots: string[];
    try {
      readOnlyRoots = await this.configurations.readOnlyRootsForRun();
    } catch (error) {
      throw new LoopRunStateError(error instanceof Error ? error.message : String(error));
    }
    const profilesById = new Map(loaded.config.executionProfiles.map((profile) => [profile.id, profile]));
    const profileIds = [...new Set(steps.map(({ step }) => step.executionProfileId))].sort(compareText);
    const executionProfiles = profileIds.map((id) => requireProfile(profilesById, id));
    const resources = await resolveExecutionResources(workspace.path, steps.map(({ step }) => step));
    const runtimes = [];
    for (const profile of executionProfiles) {
      try {
        const resolved = await this.configurations.require(profile, readOnlyRoots);
        const preflight = await this.runtime.preflight(resolved);
        runtimes.push({ executionProfileId: profile.id, runtime: preflight.runtime });
      } catch (error) {
        throw new LoopRunStateError(
          `Execution profile ${profile.id} failed preflight: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const snapshot: RootExecutionSnapshot = {
      version: 1,
      rootLoopId,
      project: {
        checkoutRoot: workspace.path,
        headSha: workspace.headSha,
        configHash: workspace.configHash,
        snapshotHash: workspace.snapshotHash
      },
      loops,
      theme: theme.theme,
      executionProfiles,
      runtimes,
      resources,
      createdAt: new Date().toISOString()
    };
    for (const { loopId, step } of steps) {
      composeExecutionPrompt(snapshot, loopId, step.id, serializeTaskEnvelopeV1({
        version: 1,
        loopId,
        stepId: step.id,
        task: step.description,
        runInput,
        recentSteps: []
      }));
    }
    return snapshot;
  }
}

const requireProfile = (
  profiles: ReadonlyMap<string, ExecutionProfile>,
  executionProfileId: string
): ExecutionProfile => {
  const profile = profiles.get(executionProfileId);
  if (!profile) throw new LoopRunNotFoundError(`Execution profile ${executionProfileId} was not found.`);
  return profile;
};

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
