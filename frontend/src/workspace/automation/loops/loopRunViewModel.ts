import type {
  ExecutionProfile,
  LoopRunDetails,
  LoopTheme,
  NodeRun,
  ProjectAutomationConfig,
  ProjectLoop,
  RootRunDetail
} from "@shared/api/workspace-contracts";

export const resolveLoopRunView = (
  config: ProjectAutomationConfig,
  loop: ProjectLoop,
  executionProfiles: ExecutionProfile[],
  theme: LoopTheme,
  details?: LoopRunDetails | null,
  root?: RootRunDetail
) => {
  const rootActive = Boolean(root && [
    "queued", "running", "waiting_for_input", "finalizing"
  ].includes(root.status));
  const canvasLoop = details?.snapshot
    ?? root?.executionSnapshot.loops.find((candidate) => candidate.id === loop.id)
    ?? loop;
  const activeNode = responseNode(details, root);
  return {
    rootActive,
    terminal: Boolean(details && !rootActive),
    canvasLoop,
    canvasConfig: root ? {
      ...config,
      orchestrator: root.executionSnapshot.orchestrator,
      loops: root.executionSnapshot.loops,
      graph: root.executionSnapshot.graph
    } : config,
    canvasProfiles: root?.executionSnapshot.executionProfiles ?? executionProfiles,
    canvasTheme: root?.executionSnapshot.theme ?? theme,
    responseNode: activeNode && canRespond(canvasLoop, activeNode) ? activeNode : undefined,
    displayStatus: root?.status ?? details?.status,
    bypassesSchedule: canvasLoop.workflow.jobNodes.find((node) => node.id === canvasLoop.workflow.startJobNodeId)?.type === "scheduled"
  };
};

const responseNode = (details?: LoopRunDetails | null, root?: RootRunDetail): NodeRun | undefined => {
  if (root) return details?.nodeRuns.find((node) => node.nodeRunId === root.current?.nodeRunId);
  return [...(details?.nodeRuns ?? [])].reverse().find((node) => node.status === "waiting_for_input");
};

const canRespond = (loop: ProjectLoop, nodeRun: NodeRun): boolean => {
  if (nodeRun.outcome?.state === "needs_input") return true;
  if (nodeRun.role === "job") return loop.workflow.jobNodes.find((node) => node.id === nodeRun.workflowNodeId)?.type === "human";
  if (nodeRun.role !== "validation") return false;
  return loop.workflow.validationNodes.find((node) => node.id === nodeRun.workflowNodeId)?.type === "human";
};
