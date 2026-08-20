import type { ControlFlowEvent, NodeRun, RootRunDetail } from "@shared/api/workspace-contracts";

export interface RunTimelineEntry {
  id: string;
  at: string;
  title: string;
  detail: string;
  stateRevision: number;
  tone: "neutral" | "job" | "validation" | "repair" | "terminal";
}

export const buildRunTimeline = (root: RootRunDetail): RunTimelineEntry[] => {
  const nodes = root.loopRuns.flatMap(({ nodeRuns }) => nodeRuns);
  const entries = [
    ...nodes.flatMap(nodeEntry),
    ...root.controlFlowEvents.flatMap((event) => eventEntry(event, root, nodes))
  ];
  return entries.sort((left, right) => left.at.localeCompare(right.at) || left.id.localeCompare(right.id));
};

const nodeEntry = (node: NodeRun): RunTimelineEntry[] => {
  const outcome = node.outcome;
  if (!outcome) return [];
  const revision = node.stateRevisionAfter ?? node.stateRevisionBefore;
  const delta = node.stateRevisionAfter !== undefined && node.stateRevisionAfter !== node.stateRevisionBefore
    ? ` · State r${node.stateRevisionBefore} → r${node.stateRevisionAfter}`
    : ` · State r${revision}`;
  if (outcome.role === "job") return [jobEntry(node, outcome, revision, delta)];
  if (outcome.role === "orchestrator") return [orchestratorEntry(node, outcome, revision, delta)];
  return [validationEntry(node, outcome, revision, delta)];
};

const jobEntry = (
  node: NodeRun,
  outcome: Extract<NonNullable<NodeRun["outcome"]>, { role: "job" }>,
  revision: number,
  delta: string
): RunTimelineEntry => ({
    id: `node:${node.nodeRunId}`, at: node.completedAt ?? node.updatedAt,
    title: `Job ${outcome.state}`, detail: `${outcome.summary}${delta}`,
    stateRevision: revision, tone: outcome.state === "blocked" || outcome.state === "failed" ? "terminal" : "job"
  });

const orchestratorEntry = (
  node: NodeRun,
  outcome: Extract<NonNullable<NodeRun["outcome"]>, { role: "orchestrator" }>,
  revision: number,
  delta: string
): RunTimelineEntry => ({
    id: `node:${node.nodeRunId}`, at: node.completedAt ?? node.updatedAt,
    title: `Orchestrator ${outcome.state}`,
    detail: outcome.state === "completed" ? `${outcome.routeReason} · target ${outcome.targetLoopId}${delta}` : `${outcome.summary}${delta}`,
    stateRevision: revision, tone: outcome.state === "completed" ? "repair" : outcome.state === "needs_input" ? "neutral" : "terminal"
  });

const validationEntry = (
  node: NodeRun,
  outcome: Extract<NonNullable<NodeRun["outcome"]>, { role: "validation" }>,
  revision: number,
  delta: string
): RunTimelineEntry => {
  const decision = outcome.state === "completed" ? ` · ${outcome.decision}` : "";
  const repair = outcome.state === "completed" && outcome.decision === "FAIL"
    ? ` · Correction: ${outcome.feedback} · Expected: ${outcome.expectedCorrection} · Escalation: ${outcome.escalation.reason}`
    : "";
  return {
    id: `node:${node.nodeRunId}`, at: node.completedAt ?? node.updatedAt,
    title: `Validation ${outcome.state}${decision}`, detail: `${outcome.summary}${repair}${delta}`,
    stateRevision: revision,
    tone: outcome.state === "completed" && outcome.decision === "PASS" ? "validation"
      : outcome.state === "blocked" || outcome.state === "failed" ? "terminal" : "repair"
  };
};

const eventEntry = (
  event: ControlFlowEvent,
  root: RootRunDetail,
  nodes: NodeRun[]
): RunTimelineEntry[] => {
  if (!["repair_call", "repair_return", "repair_terminal", "root_cancelled", "root_terminal", "execution_interrupted"].includes(event.kind)) return [];
  const request = root.repair.requests.find(({ repairRequestId }) => repairRequestId === event.repairRequestId);
  const frame = root.repair.continuations.find(({ frameId }) => frameId === event.orchestrationFrameId);
  const targetRun = root.loopRuns.find(({ loopRunId }) => loopRunId === event.targetLoopRunId);
  const source = nodes.find(({ nodeRunId }) => nodeRunId === event.sourceNodeRunId);
  const label = eventLabel(event.kind, root, request, frame, targetRun?.loopId, source);
  return label ? [{
    id: `event:${event.id}`, at: event.createdAt, title: label[0], detail: label[1],
    stateRevision: event.stateRevision,
    tone: event.kind === "repair_call" || event.kind === "repair_return" ? "repair" : "terminal"
  }] : [];
};

const eventLabel = (
  kind: ControlFlowEvent["kind"],
  root: RootRunDetail,
  request: RootRunDetail["repair"]["requests"][number] | undefined,
  frame: RootRunDetail["repair"]["continuations"][number] | undefined,
  targetLoopId: string | undefined,
  source: NodeRun | undefined
): [string, string] | undefined => {
  if (kind === "repair_call") return ["Repair Loop called", `${firstText(request?.returnLoopId, source?.loopId, "unknown")} → ${firstText(targetLoopId, request?.routedTargetLoopId, "pending target")}`];
  if (kind === "repair_return") return ["Repair returned to Validation", `${firstText(targetLoopId, "repair Loop")} → ${firstText(frame?.returnLoopId, request?.returnLoopId, "caller")}/${firstText(frame?.returnJobNodeId, request?.returnJobNodeId, "Validation")}`];
  if (kind === "repair_terminal") return ["Repair Loop terminal", firstText(targetLoopId, request?.routedTargetLoopId, "repair target")];
  if (kind === "root_cancelled") return ["Root Run cancelled", "The active repair chain and Node Runs were cancelled."];
  if (kind === "root_terminal") return ["Root Run terminal", root.status];
  if (kind === "execution_interrupted") return ["Provider execution interrupted", firstText(source?.nodeDefinitionId, "unknown Node")];
  return undefined;
};

const firstText = (...values: Array<string | undefined>): string => values.find((value) => value !== undefined) ?? "";
