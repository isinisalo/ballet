import {
  loopTerminals,
  type ProjectAutomationConfig,
  type ProjectLoopOrchestrator
} from "../../shared/domain/automation.js";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { validateProjectAutomationConfig } from "../automation.js";
import { resolveExecutionResources } from "../execution/ExecutionComposition.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { LoopRunNotFoundError, LoopRunStateError } from "../runtime/LoopRunErrors.js";
import { rootExecutionSnapshotSchema } from "../runtime/RootExecutionSnapshotSchema.js";
import { validateState } from "../runtime/state/StatePatch.js";
import { preflightExecutionPrompts } from "./LoopExecutionPreflight.js";
import {
  providerCompositionsForLoops,
  reachableExecutionGraph
} from "./LoopExecutionSnapshot.js";

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
    void runInput;
    const config = this.loadConfiguration(workspace.path);
    const automation = automationOf(config);
    const issues = validateProjectAutomationConfig(automation, config.executionProfiles);
    if (issues.length > 0) {
      const issue = issues[0]!;
      throw new LoopRunStateError(`Project automation is invalid at ${issue.path}: ${issue.message}`);
    }
    const theme = await this.themes.load(workspace.path);
    if (theme.issues.length > 0) {
      const issue = theme.issues[0]!;
      throw new LoopRunStateError(`Loop theme is invalid at ${issue.path}: ${issue.message}`);
    }

    const graph = reachableExecutionGraph(config, rootLoopId);
    const rootLoop = graph.loops.find((loop) => loop.id === rootLoopId);
    if (!rootLoop) throw new LoopRunNotFoundError(`Root Loop ${rootLoopId} was not found.`);
    graph.loops.forEach((loop) => validateState(loop.state.initial));

    const nodeCompositions = providerCompositionsForLoops(graph.loops);
    const orchestrator = normalizeOrchestrator(config.orchestrator);
    const compositions = [
      { id: "orchestrator", ...orchestrator },
      ...nodeCompositions.map(({ id, composition }) => ({ id, ...composition }))
    ];
    const profilesById = new Map(config.executionProfiles.map((profile) => [profile.id, profile]));
    const profileIds = [...new Set(compositions.map((value) => value.executionProfileId))].sort(compareUtf8);
    const executionProfiles = profileIds.map((id) => ({ ...requireProfile(profilesById, id) }));
    const resources = await resolveExecutionResources(workspace.path, compositions);
    const runtimes = await this.preflightRuntimes(executionProfiles);

    const snapshot = rootExecutionSnapshotSchema.parse({
      version: 4,
      rootLoopId,
      project: {
        checkoutRoot: workspace.path,
        headSha: workspace.headSha,
        configHash: workspace.configHash,
        snapshotHash: workspace.snapshotHash
      },
      orchestrator,
      graph: graph.graph,
      loops: graph.loops,
      terminals: [...loopTerminals],
      theme: theme.theme,
      executionProfiles,
      runtimes,
      resources,
      createdAt: new Date().toISOString()
    });
    preflightExecutionPrompts(snapshot);
    return snapshot;
  }

  private loadConfiguration(root: string): ProjectConfiguration {
    const loaded = this.projects.load(root);
    if (loaded.config && loaded.issues.length === 0) return loaded.config;
    const issue = loaded.issues[0];
    throw new LoopRunStateError(issue
      ? `Project configuration is invalid at ${issue.path}: ${issue.message}`
      : "The prepared Run workspace has no valid strict v11 project configuration.");
  }

  private async preflightRuntimes(
    executionProfiles: readonly ExecutionProfile[]
  ): Promise<RootExecutionSnapshot["runtimes"]> {
    let readOnlyRoots: string[];
    try {
      readOnlyRoots = await this.configurations.readOnlyRootsForRun();
    } catch (error) {
      throw new LoopRunStateError(error instanceof Error ? error.message : String(error));
    }
    const runtimes: RootExecutionSnapshot["runtimes"] = [];
    for (const profile of executionProfiles) {
      try {
        const resolved = await this.configurations.require(profile, readOnlyRoots);
        const preflight = await this.runtime.preflight(resolved);
        assertRuntimeMatchesProfile(profile, preflight.runtime);
        runtimes.push({ executionProfileId: profile.id, runtime: preflight.runtime });
      } catch (error) {
        throw new LoopRunStateError(
          `Execution profile ${profile.id} failed preflight: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return runtimes;
  }
}

const automationOf = (config: ProjectConfiguration): ProjectAutomationConfig => ({
  version: 11,
  orchestrator: config.orchestrator,
  graph: config.graph,
  loops: config.loops
});
const normalizeOrchestrator = (orchestrator: ProjectLoopOrchestrator): ProjectLoopOrchestrator => ({
  ...orchestrator,
  skillIds: [...orchestrator.skillIds].sort(compareUtf8)
});
const requireProfile = (
  profiles: ReadonlyMap<string, ExecutionProfile>,
  executionProfileId: string
): ExecutionProfile => {
  const profile = profiles.get(executionProfileId);
  if (!profile) throw new LoopRunNotFoundError(`Execution profile ${executionProfileId} was not found.`);
  return profile;
};
const assertRuntimeMatchesProfile = (
  profile: ExecutionProfile,
  runtime: RootExecutionSnapshot["runtimes"][number]["runtime"]
): void => {
  if (runtime.provider !== profile.provider || runtime.model !== profile.model
    || runtime.reasoning !== profile.reasoningEffort || runtime.policy.network !== profile.networkAccess) {
    throw new Error(`Runtime binding does not match execution profile ${profile.id}.`);
  }
};
const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left), Buffer.from(right));
