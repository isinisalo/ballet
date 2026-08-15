import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import type { ResolvedExecutionProfile, RuntimeConfigurationIssue } from "../../shared/domain/runtime.js";
import type { LocalRuntimeService } from "./LocalRuntimeService.js";
import type { LocalSettingsRepository } from "./LocalSettingsRepository.js";

export interface ExecutionProfileRuntimeConfiguration {
  resolved?: ResolvedExecutionProfile;
  issues: RuntimeConfigurationIssue[];
}

export interface RuntimeConfigurationResolution {
  configurations: Record<string, ExecutionProfileRuntimeConfiguration>;
  globalIssues: RuntimeConfigurationIssue[];
}

export class RuntimeConfigurationService {
  constructor(
    private readonly settings: LocalSettingsRepository,
    private readonly runtime: LocalRuntimeService
  ) {}

  async readOnlyRootsForRun(): Promise<string[]> {
    return this.settings.readOnlyRootsForRun();
  }

  async get(
    profile: ExecutionProfile,
    resolvedReadOnlyRoots?: readonly string[]
  ): Promise<ExecutionProfileRuntimeConfiguration> {
    let readOnlyRoots = resolvedReadOnlyRoots ? [...resolvedReadOnlyRoots] : undefined;
    try {
      readOnlyRoots ??= await this.readOnlyRootsForRun();
    } catch (error) {
      return {
        issues: [{
          code: "legacy_local_settings",
          path: ".git/ballet/settings.json",
          executionProfileId: profile.id,
          message: error instanceof Error ? error.message : String(error)
        }]
      };
    }
    const provider = this.runtime.providerStatus(profile.provider);
    if (provider.health !== "ready") {
      return {
        issues: [{
          code: "provider_unavailable",
          path: `executionProfiles.${profile.id}.provider`,
          executionProfileId: profile.id,
          message: provider.healthMessage ?? `The local ${profile.provider} CLI is not ready.`
        }]
      };
    }
    return {
      resolved: {
        executionProfileId: profile.id,
        provider: profile.provider,
        model: profile.model,
        reasoning: profile.reasoningEffort,
        policy: { network: profile.networkAccess, readOnlyRoots }
      },
      issues: []
    };
  }

  async require(
    profile: ExecutionProfile,
    readOnlyRoots?: readonly string[]
  ): Promise<ResolvedExecutionProfile> {
    const configuration = await this.get(profile, readOnlyRoots);
    if (!configuration.resolved) throw new Error(configuration.issues[0]?.message ?? `Execution profile ${profile.id} is unavailable.`);
    return configuration.resolved;
  }

  async resolveAll(profiles: readonly ExecutionProfile[]): Promise<RuntimeConfigurationResolution> {
    let readOnlyRoots: string[];
    try {
      readOnlyRoots = await this.readOnlyRootsForRun();
    } catch (error) {
      const issue = localSettingsIssue(error);
      return {
        configurations: Object.fromEntries(profiles.map((profile) => [profile.id, { issues: [] }])),
        globalIssues: [issue]
      };
    }
    return {
      configurations: Object.fromEntries(await Promise.all(profiles.map(async (profile) => [
        profile.id,
        await this.get(profile, readOnlyRoots)
      ]))),
      globalIssues: []
    };
  }
}

const localSettingsIssue = (error: unknown): RuntimeConfigurationIssue => {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: message.includes("agentReadOnlyRoots") ? "legacy_local_settings" : "invalid_schema",
    path: ".git/ballet/settings.json",
    message
  };
};
