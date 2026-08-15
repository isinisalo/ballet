import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { RunTarget, RunTargetsResponse } from "../../shared/domain/runs.js";
import type { ExecutionProfileRuntimeConfiguration } from "../execution/RuntimeConfigurationService.js";
import type { RuntimeConfigurationIssue } from "../../shared/domain/runtime.js";
import { reachableExecutionSteps } from "./LoopExecutionSnapshot.js";
import type { RootRunStore } from "./RootRunStore.js";
import { compositionIssuesForLoop } from "./RunTargetPreflight.js";

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
        for (const { step } of reachableExecutionSteps(data.automation, loop.id)) {
          const profile = profiles.get(step.executionProfileId);
          if (!profile) {
            issues.push({
              code: "missing_resource",
              message: `Execution profile ${step.executionProfileId} does not exist.`,
              executionProfileId: step.executionProfileId,
              stepId: step.id
            });
            continue;
          }
          const configuration = configurations[profile.id];
          if (!configuration) {
            issues.push({
              code: "invalid_runtime_config",
              message: `Execution profile ${profile.id} has not been resolved locally.`,
              executionProfileId: profile.id,
              stepId: step.id
            });
            continue;
          }
          issues.push(...configuration.issues.map((issue) => ({
            code: "invalid_runtime_config" as const,
            message: issue.message,
            executionProfileId: profile.id,
            stepId: step.id,
            path: issue.path
          })));
        }
      }
      const start = loop.nodes.find((node) => node.id === loop.start);
      return target(this.roots, loop.id, start && "description" in start ? start.description : undefined, issues);
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
  /^loops\.\d+\.nodes\.\d+\.(?:primaryInstructionId|skillIds(?:\.\d+)?)$/.test(path);
