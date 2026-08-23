import { describe, expect, it } from "vitest";
import type {
  DecisionOptionModelRowV2, DecisionStateDefinitionV2, PolicyPreviewV2, ProjectCapabilityModelV2
} from "@shared/api/workspace-contracts";
import {
  costTextToMicros, decisionActionsFromContracts, defaultDecisionSelection, findDecisionCell, isProbabilityTotalValid, microsToCostText,
  percentageTextToPpm, ppmToPercentageText, probabilityTotalPpm, projectDecisionMatrix, rankPreviewActions
} from "../src/workspace/automation/decisionModelView";

describe("Decision Model view projection", () => {
  it.each([1, 2, 5, 20])("projects exactly %i configured actions in authoritative order", (count) => {
    const actions = Array.from({ length: count }, (_, index) => ({ id: `route-${String(index).padStart(2, "0")}` }));
    const matrix = projectDecisionMatrix({ states: states(), actions, stateActions: [], capabilityActions: capabilities(actions.map(({ id }) => id)) });
    expect(matrix.actions.map(({ id }) => id)).toEqual(actions.map(({ id }) => id));
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]!.cells).toHaveLength(count);
  });

  it("distinguishes configured, missing, guard-denied, unavailable, and terminal cells", () => {
    const actions = ["alpha", "omega", "route-x", "manual-review"].map((id) => ({ id }));
    const capabilityActions: ProjectCapabilityModelV2["actions"] = [
      { actionId: "alpha", guards: [] },
      { actionId: "omega", guards: [{ featureId: "mode", allowedValues: ["closed"] }] },
      { actionId: "route-x", guards: [] }
    ];
    const matrix = projectDecisionMatrix({ states: states(), actions, stateActions: [rule("open", "alpha")], capabilityActions });
    expect(findDecisionCell(matrix, "open", "alpha")?.status).toBe("configured");
    expect(findDecisionCell(matrix, "open", "omega")).toMatchObject({ status: "missing", guardDenied: true });
    expect(findDecisionCell(matrix, "open", "route-x")?.status).toBe("missing");
    expect(findDecisionCell(matrix, "open", "manual-review")?.status).toBe("unavailable");
    expect(findDecisionCell(matrix, "done", "alpha")?.status).toBe("terminal");
  });

  it("ranks only preview-admissible actions by supplied Q and preserves configured order for missing Q", () => {
    const actions = ["alpha", "omega", "route-x", "manual-review"].map((id) => ({ id }));
    const ranked = rankPreviewActions(actions, preview({
      admissibleActionIds: ["alpha", "omega", "route-x"], selectedActionId: "omega",
      actionValues: [{ actionId: "alpha", qMicros: 9 }, { actionId: "omega", qMicros: 2 }]
    }));
    expect(ranked).toEqual([
      { actionId: "omega", qMicros: 2, recommended: true },
      { actionId: "alpha", qMicros: 9, recommended: false },
      { actionId: "route-x", qMicros: undefined, recommended: false }
    ]);
  });

  it("does not synthesize, drop, or interpret action semantics in a 20-action stress projection", () => {
    const ids = ["manual-review", "alpha", "omega", ...Array.from({ length: 17 }, (_, index) => `choice-${index}`)];
    const modelStates = Array.from({ length: 30 }, (_, index) => ({ id: `state-${index}`, values: { mode: "open" } }));
    const matrix = projectDecisionMatrix({ states: modelStates, actions: ids.map((id) => ({ id })), stateActions: [rule("state-17", "omega")], capabilityActions: capabilities(ids) });
    expect(matrix.actions.map(({ id }) => id)).toEqual(ids);
    expect(matrix.rows).toHaveLength(30);
    expect(findDecisionCell(matrix, "state-17", "omega")?.row?.actionId).toBe("omega");
  });

  it("derives Graph-scope actions from configured GraphNodes", () => {
    const graphNodes = [{ id: "ideate", description: "Explore" }, { id: "manual-review", description: "Inspect" }];
    expect(decisionActionsFromContracts(graphNodes)).toEqual(graphNodes);
  });

  it("derives GraphNode-scope actions from that node's configured JobNodes", () => {
    const jobNodes = [{ id: "collect" }, { id: "route-x" }, { id: "finish" }];
    expect(decisionActionsFromContracts(jobNodes).map(({ id }) => id)).toEqual(["collect", "route-x", "finish"]);
  });

  it("selects preview evidence rather than action position and looks up the exact rule", () => {
    const actions = ["alpha", "omega"].map((id) => ({ id }));
    const matrix = projectDecisionMatrix({ states: states(), actions, stateActions: [rule("open", "omega")], capabilityActions: capabilities(["alpha", "omega"]) });
    const selection = defaultDecisionSelection(matrix, preview({ state: {
      stateId: "open", features: {}, featureVectorSha256: "vector", sourceStateRevision: 1, evidenceRefs: []
    }, selectedActionId: "omega" }));
    expect(selection).toEqual({ stateId: "open", actionId: "omega" });
    expect(findDecisionCell(matrix, selection!.stateId, selection!.actionId)?.row?.actionId).toBe("omega");
  });
});

describe("Decision Model exact authoring conversions", () => {
  it("round-trips every ppm-representable percentage without floating point loss", () => {
    for (const ppm of [0, 1, 12_345, 500_001, 999_999, 1_000_000]) expect(percentageTextToPpm(ppmToPercentageText(ppm))).toBe(ppm);
    expect(percentageTextToPpm("0.0001")).toBe(1);
    expect(percentageTextToPpm("100.0000")).toBe(1_000_000);
    expect(percentageTextToPpm("33.33333")).toBeUndefined();
    expect(percentageTextToPpm("100.0001")).toBeUndefined();
  });

  it("validates the exact one-million-ppm branch total", () => {
    const valid = rule("open", "alpha", [750_000, 250_000]);
    const invalid = rule("open", "alpha", [750_000, 249_999]);
    expect(probabilityTotalPpm(valid)).toBe(1_000_000);
    expect(isProbabilityTotalValid(valid)).toBe(true);
    expect(isProbabilityTotalValid(invalid)).toBe(false);
  });

  it("round-trips positive micro-unit costs exactly", () => {
    for (const micros of [1, 999_999, 1_000_000, 30_250_001]) expect(costTextToMicros(microsToCostText(micros))).toBe(micros);
    expect(costTextToMicros("0")).toBeUndefined();
    expect(costTextToMicros("1.0000001")).toBeUndefined();
  });
});

const states = (): DecisionStateDefinitionV2[] => [
  { id: "open", values: { mode: "open" } },
  { id: "done", values: { mode: "closed" }, terminal: "success" }
];
const capabilities = (ids: string[]): ProjectCapabilityModelV2["actions"] => ids.map((actionId) => ({ actionId, guards: [] }));
const rule = (stateId: string, actionId: string, probabilities = [1_000_000]): DecisionOptionModelRowV2 => ({
  stateId, actionId, expectedCostMicros: 5_000_000,
  successors: probabilities.map((probabilityPpm, index) => ({ outcomeId: `outcome-${index}`, expectedNextStateId: "done", probabilityPpm }))
});
const preview = (patch: Partial<PolicyPreviewV2>): PolicyPreviewV2 => ({
  derived: true, persisted: false, scope: "graph", scopeKey: "graph", admissibleActionIds: [], excludedActions: [],
  actionValues: [], solverStatus: "converged", modelVersion: 2, modelSha256: "hash", ...patch
});
