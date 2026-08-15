import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { RunTargetIssue } from "../../shared/domain/runs.js";
import { workLoopRuntimeUnavailableMessage } from "../runtime/LoopRunErrors.js";

export type RunTargetPreflightData = Pick<
  AppData,
  "automation" | "executionProfiles" | "instructions" | "skills" | "resourceIssues" | "loopTheme"
>;

export const compositionIssuesForLoop = (
  _data: RunTargetPreflightData,
  _rootLoopId: string
): RunTargetIssue[] => {
  void _data;
  void _rootLoopId;
  return [{
    code: "invalid_config",
    message: workLoopRuntimeUnavailableMessage,
    path: "runtime"
  }];
};
