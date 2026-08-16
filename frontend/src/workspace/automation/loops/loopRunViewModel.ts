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
  const canvasLoop = root?.executionSnapshot.loops.find((candidate) => candidate.id === loop.id)
    ?? details?.snapshot
    ?? loop;
  const activeNode = responseNode(details, root);
  return {
    rootActive,
    terminal: Boolean(details && !rootActive),
    canvasLoop,
    canvasConfig: root ? { ...config, loops: root.executionSnapshot.loops } : config,
    canvasProfiles: root?.executionSnapshot.executionProfiles ?? executionProfiles,
    canvasTheme: root?.executionSnapshot.theme ?? theme,
    responseNode: activeNode && canRespond(canvasLoop, activeNode) ? activeNode : undefined,
    displayStatus: root?.status ?? details?.status,
    bypassesSchedule: canvasLoop.nodes.find((node) => node.id === canvasLoop.startNodeId)?.work.type === "scheduled"
  };
};

const responseNode = (details?: LoopRunDetails | null, root?: RootRunDetail): NodeRun | undefined => {
  if (root) return details?.nodeRuns.find((node) => node.nodeRunId === root.current?.nodeRunId);
  return [...(details?.nodeRuns ?? [])].reverse().find((node) => node.status === "waiting_for_input");
};

const canRespond = (loop: ProjectLoop, nodeRun: NodeRun): boolean => {
  if (nodeRun.outcome?.state === "needs_input") return true;
  const definition = loop.nodes.find((node) => node.id === nodeRun.workLoopNodeId);
  return nodeRun.role === "work"
    ? definition?.work.type === "human"
    : nodeRun.role === "validation" && definition?.validation.type === "human";
};
