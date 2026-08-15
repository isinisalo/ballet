import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type { RunTargetIssue } from "../../shared/domain/runs.js";
import {
  composeExecutionPrompt,
  ExecutionCompositionError,
  resolveExecutionResourcesFromCatalog
} from "../execution/ExecutionComposition.js";
import { serializeTaskEnvelopeV1 } from "../integration/TaskEnvelopeV1.js";
import { reachableExecutionSteps, reachableLoops } from "./LoopExecutionSnapshot.js";

export type RunTargetPreflightData = Pick<
  AppData,
  "automation" | "executionProfiles" | "instructions" | "skills" | "resourceIssues" | "loopTheme"
>;

export const compositionIssuesForLoop = (
  data: RunTargetPreflightData,
  rootLoopId: string
): RunTargetIssue[] => {
  let currentStepId: string | undefined;
  try {
    const steps = reachableExecutionSteps(data.automation, rootLoopId);
    const profileIds = new Set(steps.map(({ step }) => step.executionProfileId));
    const executionProfiles = data.executionProfiles.filter((profile) => profileIds.has(profile.id));
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
    }, steps.map(({ step }) => step));
    const snapshot: RootExecutionSnapshot = {
      version: 1,
      rootLoopId,
      project: { checkoutRoot: "", headSha: "", configHash: "", snapshotHash: "" },
      loops: reachableLoops(data.automation, rootLoopId),
      theme: data.loopTheme,
      executionProfiles,
      runtimes: [],
      resources,
      createdAt: ""
    };
    for (const { loopId, step } of steps) {
      currentStepId = step.id;
      composeExecutionPrompt(snapshot, loopId, step.id, serializeTaskEnvelopeV1({
        version: 1,
        loopId,
        stepId: step.id,
        task: step.description,
        runInput: "",
        recentSteps: []
      }));
    }
    return [];
  } catch (error) {
    if (error instanceof ExecutionCompositionError) return [{
      code: error.code === "resource_too_large" ? "invalid_resource" : error.code,
      message: error.message,
      stepId: currentStepId
    }];
    return [{ code: "invalid_config", message: error instanceof Error ? error.message : String(error) }];
  }
};
