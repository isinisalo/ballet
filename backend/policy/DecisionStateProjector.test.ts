import { describe, expect, it } from "vitest";
import type { DecisionProjectionContextV1, ProjectSspDecisionModelV1 } from "../../shared/domain/decisionModel.js";
import { DecisionStateProjectionError, projectDecisionState } from "./DecisionStateProjector.js";

const model: ProjectSspDecisionModelV1 = {
  version: 1,
  features: [
    { id: "epoch", domain: ["start"], missingValue: "start", source: { kind: "runtime", fact: "epoch_kind" } },
    { id: "phase", domain: ["unknown", "ready"], missingValue: "unknown", source: { kind: "project_state", pointer: "/phase" } },
    { id: "permit", domain: ["no", "yes"], missingValue: "no", source: { kind: "authorization", pointer: "/permit" } }
  ],
  states: [
    { id: "unknown", values: { epoch: "start", phase: "unknown", permit: "no" } },
    { id: "ready-denied", values: { epoch: "start", phase: "ready", permit: "no" } },
    { id: "ready-authorized", values: { epoch: "start", phase: "ready", permit: "yes" } }
  ],
  stateActions: [],
  solver: { algorithm: "ssp_value_iteration_v1", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 },
  projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 }
};

const context = (overrides: Partial<DecisionProjectionContextV1> = {}): DecisionProjectionContextV1 => ({
  epochKind: "start", graphNodeInvocationCount: 0, stateRevision: 3,
  projectState: { phase: "ready", permit: "no" }, authorizationFacts: { permit: "yes" },
  evidenceRefs: ["graph-state:3"], ...overrides
});

describe("bounded Decision State projection", () => {
  it("keeps project State and authorization facts as distinct canonical sources", () => {
    expect(projectDecisionState(model, context())).toMatchObject({
      stateId: "ready-authorized", features: { epoch: "start", phase: "ready", permit: "yes" },
      sourceStateRevision: 3, evidenceRefs: ["graph-state:3"]
    });
  });

  it("uses configured missing values without reading provider prose", () => {
    expect(projectDecisionState(model, context({ projectState: {}, authorizationFacts: {} }))).toMatchObject({
      stateId: "unknown", features: { epoch: "start", phase: "unknown", permit: "no" }
    });
  });

  it("fails closed when a projected scalar is outside its finite domain", () => {
    expect(() => projectDecisionState(model, context({ projectState: { phase: "unbounded" } })))
      .toThrow(DecisionStateProjectionError);
  });
});
