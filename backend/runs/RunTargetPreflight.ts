import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { defaultProjectConfiguration } from "../../shared/domain/projectConfig.js";
import type { RunTargetIssue } from "../../shared/domain/runs.js";
import {
  ExecutionCompositionError,
  resolveExecutionResourcesFromCatalog
} from "../execution/ExecutionComposition.js";
import { preflightExecutionPrompts } from "./LoopExecutionPreflight.js";
import {
  providerCompositionsForLoops,
  reachableExecutionGraph,
  reachableProviderCompositions
} from "./LoopExecutionSnapshot.js";

export type RunTargetPreflightData = Pick<
  AppData,
  "automation" | "executionProfiles" | "instructions" | "skills" | "resourceIssues" | "loopTheme"
>;

export interface ReachableProfileReference {
  executionProfileId: string;
  nodeId?: string;
}

export const compositionIssuesForLoop = (
  data: RunTargetPreflightData,
  rootLoopId: string,
  rootKind: "graph" | "loop" = "loop"
): RunTargetIssue[] => {
  try {
    const graph = reachableExecutionGraph(data.automation, rootLoopId, rootKind);
    const compositions = [
      ...(data.automation.orchestrator.repairRouter
        ? [{ id: "orchestrator", ...data.automation.orchestrator.repairRouter }]
        : []),
      ...providerCompositionsForLoops(graph.loops).map(({ id, composition }) => ({ id, ...composition }))
    ];
    const profileIds = new Set(compositions.map(({ executionProfileId }) => executionProfileId));
    const executionProfiles = data.executionProfiles.filter(({ id }) => profileIds.has(id));
    const missingProfileId = [...profileIds].find((id) =>
      !executionProfiles.some((profile) => profile.id === id));
    if (missingProfileId) return [{
      code: "missing_resource",
      message: `Execution profile ${missingProfileId} does not exist.`,
      executionProfileId: missingProfileId
    }];
    const resources = resolveExecutionResourcesFromCatalog({
      instructions: data.instructions,
      skills: data.skills,
      issues: data.resourceIssues
    }, compositions);
    const snapshot: RootExecutionSnapshot = {
      version: 6,
      rootKind,
      rootLoopId,
      project: { checkoutRoot: "", headSha: "", configHash: "", snapshotHash: "" },
      orchestrator: data.automation.orchestrator,
      issueTracker: defaultProjectConfiguration().issueTracker,
      graph: graph.graph,
      loops: graph.loops,
      theme: data.loopTheme,
      executionProfiles,
      runtimes: [],
      resources,
      createdAt: ""
    };
    preflightExecutionPrompts(snapshot);
    return [];
  } catch (error) {
    if (error instanceof ExecutionCompositionError) return [{
      code: error.code === "resource_too_large" ? "invalid_resource" : error.code,
      message: error.message
    }];
    return [{ code: "invalid_config", message: error instanceof Error ? error.message : String(error) }];
  }
};

export const reachableProfileReferences = (
  data: RunTargetPreflightData,
  rootLoopId: string,
  rootKind: "graph" | "loop" = "loop"
): ReachableProfileReference[] => {
  const references: ReachableProfileReference[] = reachableProviderCompositions(data.automation, rootLoopId, rootKind).map((value) => ({
    executionProfileId: value.composition.executionProfileId,
    nodeId: value.nodeId
  }));
  if (data.automation.orchestrator.repairRouter) references.push({
    executionProfileId: data.automation.orchestrator.repairRouter.executionProfileId
  });
  const unique = new Map(references.map((reference) => [
    `${reference.executionProfileId}\0${reference.nodeId ?? "orchestrator"}`,
    reference
  ]));
  return [...unique.values()];
};
