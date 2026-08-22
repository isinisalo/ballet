import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { RunTarget, RunTargetsResponse } from "../../shared/domain/runs.js";
import type { ExecutionProfileRuntimeConfiguration } from "../execution/RuntimeConfigurationService.js";
import type { RuntimeConfigurationIssue } from "../../shared/domain/runtime.js";
import type { RootRunStore } from "./RootRunStore.js";

type TargetData = Pick<
  AppData,
  "executionProfiles" | "automation" | "automationIssues" | "canvasThemeIssues"
  | "resourceIssues"
>;

export class LocalRunTargetService {
  constructor(private readonly roots: RootRunStore) {}

  list(
    data: TargetData,
    configurations: Readonly<Record<string, ExecutionProfileRuntimeConfiguration>>,
    globalRuntimeIssues: readonly RuntimeConfigurationIssue[] = []
  ): RunTargetsResponse {
    const common: RunTarget["issues"] = [
      ...data.automationIssues.map((issue) => ({
        code: "invalid_config" as const, message: issue.message, path: issue.path
      })),
      ...data.canvasThemeIssues.map((issue) => ({
        code: "invalid_config" as const, message: issue.message, path: issue.path
      })),
      ...data.resourceIssues.map((issue) => ({
        code: "invalid_resource" as const, message: issue.message, path: issue.relativePath
      })),
      ...globalRuntimeIssues.map((issue) => ({
        code: "invalid_runtime_config" as const, message: issue.message, path: issue.path
      }))
    ];
    const profileIssues = data.executionProfiles.flatMap((profile) =>
      (configurations[profile.id]?.issues ?? []).map((issue) => ({
        code: "invalid_runtime_config" as const,
        message: issue.message,
        path: issue.path,
        executionProfileId: profile.id
      })));
    const issues = [...common, ...profileIssues];
    return {
      graph: target(this.roots, "graph", data.automation.graph.id, data.automation.graph.name,
        data.automation.graph.state.description, issues),
      graphNodes: data.automation.graph.graphNodes.map((graphNode) =>
        target(this.roots, "graph_node", graphNode.id, graphNode.id, graphNode.description, issues))
    };
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
  kind, id, name, description, ready: issues.length === 0, issues,
  activeRootRunId: roots.active(kind, id)?.rootRunId,
  latestRootRunId: roots.latest(kind, id)?.rootRunId
});
