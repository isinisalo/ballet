import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { RunTarget, RunTargetsResponse } from "../../shared/domain/runs.js";
import type { ExecutionProfileRuntimeConfiguration } from "../execution/RuntimeConfigurationService.js";
import type { RuntimeConfigurationIssue } from "../../shared/domain/runtime.js";
import type { RootRunStore } from "./RootRunStore.js";
import { compositionIssuesForLoop, reachableProfileReferences } from "./RunTargetPreflight.js";

type TargetData = Pick<
  AppData,
  "executionProfiles" | "automation" | "automationIssues" | "loopTheme" | "loopThemeIssues"
  | "instructions" | "skills" | "resourceIssues"
>;

export class LocalRunTargetService {
  constructor(private readonly roots: RootRunStore) {}

  list(
    data: TargetData,
    configurations: Readonly<Record<string, ExecutionProfileRuntimeConfiguration>>,
    globalRuntimeIssues: readonly RuntimeConfigurationIssue[] = []
  ): RunTargetsResponse {
    const profiles = new Map(data.executionProfiles.map((profile) => [profile.id, profile]));
    const globalAutomationIssues = data.automationIssues.filter((issue) =>
      !isStepResourceReferenceIssue(issue.path));
    const loops = data.automation.loops.map((loop): RunTarget => {
      const issues: RunTarget["issues"] = [
        ...globalAutomationIssues.map((issue) => ({
          code: "invalid_config" as const,
          message: issue.message,
          path: issue.path
        })),
        ...data.loopThemeIssues.map((issue) => ({
          code: "invalid_config" as const,
          message: issue.message,
          path: issue.path
        })),
        ...globalRuntimeIssues.map((issue) => ({
          code: "invalid_runtime_config" as const,
          message: issue.message,
          path: issue.path
        }))
      ];
      if (globalAutomationIssues.length === 0) {
        issues.push(...compositionIssuesForLoop(data, loop.id));
        for (const reference of reachableProfileReferences(data, loop.id)) {
          const profile = profiles.get(reference.executionProfileId);
          const configuration = profile ? configurations[profile.id] : undefined;
          if (!profile || !configuration) {
            issues.push({
              code: profile ? "invalid_runtime_config" : "missing_resource",
              message: profile
                ? `Execution profile ${profile.id} has not been resolved locally.`
                : `Execution profile ${reference.executionProfileId} does not exist.`,
              executionProfileId: reference.executionProfileId,
              nodeId: reference.nodeId
            });
            continue;
          }
          issues.push(...configuration.issues.map((issue) => ({
            code: "invalid_runtime_config" as const,
            message: issue.message,
            executionProfileId: profile.id,
            nodeId: reference.nodeId,
            path: issue.path
          })));
        }
      }
      return target(this.roots, loop.id, loop.description, issues);
    });
    return { loops };
  }
}

const target = (
  roots: RootRunStore,
  id: string,
  description: string | undefined,
  issues: RunTarget["issues"]
): RunTarget => ({
  kind: "loop",
  id,
  name: id,
  description,
  ready: issues.length === 0,
  issues,
  activeRootRunId: roots.active("loop", id)?.rootRunId,
  latestRootRunId: roots.latest("loop", id)?.rootRunId
});

const isStepResourceReferenceIssue = (path: string): boolean =>
  /^(?:orchestrator|loops\.\d+\.nodes\.\d+\.(?:work|validation))\.(?:primaryInstructionId|skillIds(?:\.\d+)?)$/.test(path);
