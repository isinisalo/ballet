import type { ActionProjection, JsonRow, RunDetail, RunSummary, StateProjection } from "./runTypes";

export const orderedRunProjection = (states: StateProjection[]) => [...states].sort((a, b) => a.order - b.order).map((state) => ({ ...state, actions: [...state.actions].sort((a, b) => a.priority - b.priority) }));

export const currentGate = (run: Pick<RunDetail, "states" | "status">) => {
  const states = orderedRunProjection(run.states); const state = states.find((item) => !item.done);
  const action = state?.actions.find((item) => !item.done);
  return { state, action, label: run.status === "blocked" ? "Blocked" : action ? `${state!.stateDefinitionId} / ${action.actionDefinitionId}` : run.status };
};

export const retrySummary = (action: Pick<ActionProjection, "workAttempt" | "maxRetries">) => ({
  attempt: action.workAttempt, total: 1 + action.maxRetries,
  retriesUsed: Math.max(0, action.workAttempt - 1), retriesRemaining: Math.max(0, action.maxRetries - Math.max(0, action.workAttempt - 1))
});

export const timelineForAction = (events: JsonRow[], actionExecutionId: string) => events.filter((event) => event.actionExecutionId === actionExecutionId || event.action_execution_id === actionExecutionId).sort((a, b) => Number(a.sequence) - Number(b.sequence)).map((event) => ({
  sequence: Number(event.sequence), kind: String(event.kind), createdAt: String(event.createdAt ?? event.created_at ?? ""),
  role: String(event.kind).startsWith("work_") ? "Work · subordinate" : String(event.kind).startsWith("validation_") ? "Validation · main" : "Runtime"
}));

const tones = { done: "healthy", completed: "healthy", applied: "healthy", validating: "active", prechecking: "active", postchecking: "active", working: "active", running: "active", retrying: "attention", pending: "neutral", queued: "neutral", blocked: "danger", failed: "danger", apply_failed: "danger", interrupted: "danger", cancelled: "neutral", rejected: "neutral", skipped: "neutral", applying: "active" } as const;
export const statusPresentation = (status: string) => ({ label: status.replaceAll("_", " "), tone: tones[status as keyof typeof tones] ?? "neutral" as const });

export const criticDecisionRequest = (proposal: JsonRow, decision: "approved" | "rejected", runId: string) => {
  const content = parseJson(proposal.content_json); const id = String(proposal.critic_proposal_id);
  return { decision, expectedContentHash: String(proposal.content_hash), expectedVersion: 1 as const,
    ...(decision === "approved" ? { feedback: { feedbackEntryId: `feedback-${id}`, environmentRunId: runId,
      title: String(content.title ?? "Critic finding"), description: String(content.finding ?? "Critic finding"),
      correctiveActions: strings(content.recommendedCorrectiveActions), evidenceRefs: strings(content.evidenceRefs) } } : {}) };
};

export const refinementDecisionRequest = (proposal: JsonRow, decision: "approved" | "rejected") => ({
  decision, expectedContentHash: String(proposal.change_list_hash), expectedVersion: 1 as const,
  expectedChangeHashes: (proposal.files as JsonRow[] ?? []).map((file) => String(file.proposed_content_hash)).sort(),
  expectedImpactActionIds: strings(parseJson(proposal.impact_scope_json).actionIds).sort(),
  acknowledgeLocalCommitAndContinuation: decision === "approved"
});

export const diffPresentation = (file: JsonRow) => ({ operation: String(file.operation), path: String(file.relative_path),
  preimage: String(file.expected_preimage_hash), result: String(file.proposed_content_hash),
  lines: typeof file.proposed_content === "string" ? file.proposed_content.split("\n").map((text, index) => ({ line: index + 1, marker: "+", text })) : [] });

export const reconcileRows = <T extends JsonRow>(current: T[], incoming: T[], id: keyof T): T[] => {
  const values = new Map(current.map((row) => [String(row[id]), row])); for (const row of incoming) values.set(String(row[id]), row);
  return [...values.values()];
};

export const continuationLineage = (run: RunSummary, all: RunSummary[]) => {
  const ancestors: string[] = []; let current = run.previousRunId;
  while (current && !ancestors.includes(current)) { ancestors.push(current); current = all.find((item) => item.environmentRunId === current)?.previousRunId; }
  return ancestors;
};

export const parseJson = (value: unknown): JsonRow => { try { return typeof value === "string" ? JSON.parse(value) as JsonRow : (value ?? {}) as JsonRow; } catch { return {}; } };
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];
