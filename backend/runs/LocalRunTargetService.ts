import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { RunTarget, RunTargetsResponse } from "../../shared/domain/runs.js";
import type { ExecutionProfileRuntimeConfiguration } from "../execution/RuntimeConfigurationService.js";
import type { RuntimeConfigurationIssue } from "../../shared/domain/runtime.js";
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
      }
      void configurations;
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
