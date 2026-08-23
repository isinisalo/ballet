import type {
  DecisionOptionModelRowV2,
  DecisionStateDefinitionV2,
  PolicyPreviewV2,
  ProjectCapabilityModelV2
} from "@shared/api/workspace-contracts";

export const PROBABILITY_PPM_TOTAL = 1_000_000;
export const COST_MICROS_PER_UNIT = 1_000_000;

export interface DecisionActionView {
  id: string;
  description?: string;
}

export type DecisionMatrixCellStatus = "configured" | "missing" | "unavailable" | "terminal";

export interface DecisionMatrixCellView {
  stateId: string;
  actionId: string;
  status: DecisionMatrixCellStatus;
  row?: DecisionOptionModelRowV2;
  rowIndex?: number;
  guardDenied: boolean;
  guardReason?: string;
}

export interface DecisionMatrixRowView {
  state: DecisionStateDefinitionV2;
  cells: DecisionMatrixCellView[];
}

export interface DecisionMatrixView {
  actions: DecisionActionView[];
  rows: DecisionMatrixRowView[];
}

export interface RankedDecisionAction {
  actionId: string;
  qMicros?: number;
  recommended: boolean;
}

export function decisionActionsFromContracts(contracts: Array<{ id: string; description?: string }>): DecisionActionView[] {
  return contracts.map(({ id, description }) => ({ id, description }));
}

export function projectDecisionMatrix(input: {
  states: DecisionStateDefinitionV2[];
  actions: DecisionActionView[];
  stateActions: DecisionOptionModelRowV2[];
  capabilityActions: ProjectCapabilityModelV2["actions"];
}): DecisionMatrixView {
  const ruleIndex = new Map<string, { row: DecisionOptionModelRowV2; index: number }>();
  input.stateActions.forEach((row, index) => {
    const key = ruleKey(row.stateId, row.actionId);
    if (!ruleIndex.has(key)) ruleIndex.set(key, { row, index });
  });
  const capabilityIndex = new Map(input.capabilityActions.map((action) => [action.actionId, action]));

  return {
    actions: [...input.actions],
    rows: input.states.map((state) => ({
      state,
      cells: input.actions.map(({ id: actionId }) => {
        if (state.terminal) return { stateId: state.id, actionId, status: "terminal", guardDenied: false };
        const rule = ruleIndex.get(ruleKey(state.id, actionId));
        const capability = capabilityIndex.get(actionId);
        const deniedGuards = capability?.guards.filter((guard) => !guard.allowedValues.includes(state.values[guard.featureId] ?? "")) ?? [];
        const guardDenied = deniedGuards.length > 0;
        const guardReason = guardDenied
          ? deniedGuards.map((guard) => `${guard.featureId}: ${state.values[guard.featureId] ?? "missing"} is not allowed`).join("; ")
          : undefined;
        return {
          stateId: state.id,
          actionId,
          status: rule ? "configured" : capability ? "missing" : "unavailable",
          row: rule?.row,
          rowIndex: rule?.index,
          guardDenied,
          guardReason
        };
      })
    }))
  };
}

export function rankPreviewActions(actions: DecisionActionView[], preview?: PolicyPreviewV2): RankedDecisionAction[] {
  if (!preview) return [];
  const order = new Map(actions.map((action, index) => [action.id, index]));
  const qValues = new Map(preview.actionValues.map((value) => [value.actionId, value.qMicros]));
  return preview.admissibleActionIds
    .filter((actionId) => order.has(actionId))
    .map((actionId) => ({ actionId, qMicros: qValues.get(actionId), recommended: actionId === preview.selectedActionId }))
    .sort((left, right) => {
      if (left.qMicros === undefined && right.qMicros !== undefined) return 1;
      if (left.qMicros !== undefined && right.qMicros === undefined) return -1;
      if (left.qMicros !== undefined && right.qMicros !== undefined && left.qMicros !== right.qMicros) return left.qMicros - right.qMicros;
      return (order.get(left.actionId) ?? 0) - (order.get(right.actionId) ?? 0);
    });
}

export function findDecisionCell(matrix: DecisionMatrixView, stateId: string, actionId: string): DecisionMatrixCellView | undefined {
  return matrix.rows.find(({ state }) => state.id === stateId)?.cells.find((cell) => cell.actionId === actionId);
}

export function defaultDecisionSelection(matrix: DecisionMatrixView, preview?: PolicyPreviewV2): { stateId: string; actionId: string } | undefined {
  if (preview?.state?.stateId && preview.selectedActionId && findDecisionCell(matrix, preview.state.stateId, preview.selectedActionId)) {
    return { stateId: preview.state.stateId, actionId: preview.selectedActionId };
  }
  for (const row of matrix.rows) {
    const cell = row.cells.find((candidate) => candidate.status === "configured")
      ?? row.cells.find((candidate) => candidate.status === "missing" && !candidate.guardDenied);
    if (cell) return { stateId: cell.stateId, actionId: cell.actionId };
  }
  return undefined;
}

export function probabilityTotalPpm(row: DecisionOptionModelRowV2): number {
  return row.successors.reduce((total, branch) => total + branch.probabilityPpm, 0);
}

export function isProbabilityTotalValid(row: DecisionOptionModelRowV2): boolean {
  return probabilityTotalPpm(row) === PROBABILITY_PPM_TOTAL;
}

export function decisionRuleIssues(issues: Array<{ path: string; message: string }>, cell: DecisionMatrixCellView): Array<{ path: string; message: string }> {
  if (cell.rowIndex === undefined) return [];
  const indexMarkers = [`stateActions.${cell.rowIndex}`, `stateActions[${cell.rowIndex}]`, `/stateActions/${cell.rowIndex}`];
  return issues.filter((issue) => indexMarkers.some((marker) => issue.path.includes(marker))
    || (issue.message.includes(cell.stateId) && issue.message.includes(cell.actionId)));
}

export function ppmToPercentageText(ppm: number): string {
  return scaledIntegerToText(ppm, 10_000, 4);
}

export function percentageTextToPpm(value: string): number | undefined {
  return parseScaledDecimal(value, 4, PROBABILITY_PPM_TOTAL, false);
}

export function microsToCostText(micros: number): string {
  return scaledIntegerToText(micros, COST_MICROS_PER_UNIT, 6);
}

export function costTextToMicros(value: string): number | undefined {
  return parseScaledDecimal(value, 6, Number.MAX_SAFE_INTEGER, true);
}

function ruleKey(stateId: string, actionId: string): string {
  return `${stateId}\u0000${actionId}`;
}

function scaledIntegerToText(value: number, scale: number, decimals: number): string {
  if (!Number.isSafeInteger(value)) return "";
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / scale);
  const fraction = String(absolute % scale).padStart(decimals, "0").replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

function parseScaledDecimal(value: string, decimals: number, maximum: number, positive: boolean): number | undefined {
  const match = value.trim().match(new RegExp(`^(\\d+)(?:\\.(\\d{1,${decimals}}))?$`));
  if (!match) return undefined;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(decimals, "0"));
  const result = whole * 10 ** decimals + fraction;
  if (!Number.isSafeInteger(result) || result > maximum || (positive && result <= 0)) return undefined;
  return result;
}
