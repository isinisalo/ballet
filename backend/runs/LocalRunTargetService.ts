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
      !isNodeResourceReferenceIssue(issue.path));
    const issuesFor = (loopId: string, rootKind: "graph" | "loop"): RunTarget["issues"] => {
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
        issues.push(...compositionIssuesForLoop(data, loopId, rootKind));
        for (const reference of reachableProfileReferences(data, loopId, rootKind)) {
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
      return issues;
    };
    const loops = data.automation.loops.map((loop): RunTarget => target(
      this.roots, "loop", loop.id, loop.id, loop.description, issuesFor(loop.id, "loop")
    ));
    const hasStart = data.automation.loops.some(({ id }) => id === data.automation.graph.startLoopId);
    const graphIssues = hasStart
      ? issuesFor(data.automation.graph.startLoopId, "graph")
      : [{ code: "invalid_config" as const, message: "Graph start Loop does not exist." }];
    const graph = target(
      this.roots,
      "graph",
      data.automation.graph.id,
      data.automation.graph.name,
      "Run the immutable Graph Engineering RunBook from its configured start Loop.",
      graphIssues
    );
    return { graph, loops };
  }
}

const target = (
  roots: RootRunStore,
  kind: RunTarget["kind"],
  id: string,
  name: string,
  description: string | undefined,
  issues: RunTarget["issues"]
): RunTarget => ({
  kind,
  id,
  name,
  description,
  ready: issues.length === 0,
  issues,
  activeRootRunId: roots.active(kind, id)?.rootRunId,
  latestRootRunId: roots.latest(kind, id)?.rootRunId
});

const isNodeResourceReferenceIssue = (path: string): boolean =>
  /^(?:orchestrator|loops\.\d+\.workflow\.(?:jobNodes|validationNodes)\.\d+)\.(?:primaryInstructionId|skillIds(?:\.\d+)?)$/.test(path);
