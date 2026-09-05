import type { ActionProjection, JsonRow, RunDetail, StateProjection } from "./runTypes";

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

export const criticDecisionRequest = (proposal: JsonRow, decision: "approved" | "rejected") => {
  return { decision, expectedContentHash: String(proposal.content_hash), expectedVersion: 2 as const };
};

export const refinementDecisionRequest = (proposal: JsonRow, decision: "approved" | "rejected") => ({
  decision, expectedContentHash: String(proposal.change_list_hash), expectedVersion: 2 as const,
  expectedChangeHashes: (proposal.files as JsonRow[] ?? []).map((file) => String(file.proposed_content_hash)).sort(),
  expectedImpactActionIds: strings(parseJson(proposal.impact_scope_json).actionIds).sort(),
  acknowledgeLocalCommitAndContinuation: decision === "approved"
});

export const diffPresentation = (file: JsonRow) => {
  const operation = String(file.operation); const before = typeof file.preimage_content === "string" ? file.preimage_content : "";
  const after = typeof file.proposed_content === "string" ? file.proposed_content : "";
  return { operation, path: String(file.relative_path), preimage: String(file.expected_preimage_hash),
    result: String(file.proposed_content_hash), lines: exactLineDiff(before, after) };
};

type ExactDiffLine = { key: string; oldLine?: number; newLine?: number; marker: " " | "+" | "-"; text: string };

const exactLineDiff = (before: string, after: string): ExactDiffLine[] => {
  const previous = before ? before.split("\n") : []; const proposed = after ? after.split("\n") : [];
  let prefix = 0;
  while (prefix < previous.length && prefix < proposed.length && previous[prefix] === proposed[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < previous.length - prefix && suffix < proposed.length - prefix
    && previous[previous.length - 1 - suffix] === proposed[proposed.length - 1 - suffix]) suffix += 1;
  const rows: ExactDiffLine[] = [];
  for (let index = 0; index < prefix; index += 1) rows.push({ key: `=${index}`, oldLine: index + 1, newLine: index + 1, marker: " ", text: previous[index]! });
  for (let index = prefix; index < previous.length - suffix; index += 1) rows.push({ key: `-${index}`, oldLine: index + 1, marker: "-", text: previous[index]! });
  for (let index = prefix; index < proposed.length - suffix; index += 1) rows.push({ key: `+${index}`, newLine: index + 1, marker: "+", text: proposed[index]! });
  for (let offset = suffix; offset > 0; offset -= 1) {
    const oldIndex = previous.length - offset; const newIndex = proposed.length - offset;
    rows.push({ key: `=${oldIndex}:${newIndex}`, oldLine: oldIndex + 1, newLine: newIndex + 1, marker: " ", text: previous[oldIndex]! });
  }
  return rows;
};

export const parseJson = (value: unknown): JsonRow => { try { return typeof value === "string" ? JSON.parse(value) as JsonRow : (value ?? {}) as JsonRow; } catch { return {}; } };
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

export const validRunSelection = (run: RunDetail, stateId?: string, actionId?: string): boolean => {
  const states = stateId ? run.states.filter((state) => state.stateDefinitionId === stateId || state.stateExecutionId === stateId) : run.states;
  return (!stateId || states.length > 0) && (!actionId || states.some((state) => state.actions.some((action) => action.actionDefinitionId === actionId || action.actionExecutionId === actionId)));
};
