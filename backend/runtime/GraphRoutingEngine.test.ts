import { describe, expect, it } from "vitest";
import {
  hasRepairCapacity, resolveOrchestratorOutcome, resolveRepairOutcome, resolveValidation
} from "./GraphRoutingEngine.js";

const dispatch = (target: string) => ({
  role: "orchestrator" as const, state: "completed" as const, action: "dispatch" as const,
  summary: "Route", target, reason: "Evidence"
});

describe("GraphRoutingEngine", () => {
  it("allows only an exact snapshotted candidate", () => {
    expect(resolveOrchestratorOutcome({
      outcome: dispatch("job-node:build"), candidateKeys: ["job-node:build"],
      attempt: 1, maxAttempts: 3, repairAvailable: true
    })).toEqual({ kind: "dispatch", target: "job-node:build" });
    expect(resolveOrchestratorOutcome({
      outcome: dispatch("job-node:outside"), candidateKeys: ["job-node:build"],
      attempt: 1, maxAttempts: 3, repairAvailable: true
    })).toEqual({ kind: "retry_orchestrator" });
  });

  it("retries invalid routing three times and then delegates bounded repair", () => {
    expect(resolveOrchestratorOutcome({
      outcome: dispatch("job-node:outside"), candidateKeys: ["job-node:build"],
      attempt: 2, maxAttempts: 3, repairAvailable: true
    }).kind).toBe("retry_orchestrator");
    expect(resolveOrchestratorOutcome({
      outcome: dispatch("job-node:outside"), candidateKeys: ["job-node:build"],
      attempt: 3, maxAttempts: 3, repairAvailable: true
    })).toEqual({ kind: "delegate_repair" });
  });

  it("keeps retry inside a Job Node and sends exhausted FAIL to repair", () => {
    expect(resolveValidation("PASS", 1, 3)).toBe("pass");
    expect(resolveValidation("FAIL", 1, 3)).toBe("retry_work");
    expect(resolveValidation("FAIL", 4, 3)).toBe("request_repair");
  });

  it("returns repair to Validation and escalates local repair only to Graph scope", () => {
    expect(resolveRepairOutcome({
      outcome: { role: "repair", state: "completed", action: "revalidate", summary: "Fixed", artifacts: {} },
      candidateKeys: [], scope: "graph_node", parentEscalationAvailable: true
    })).toEqual({ kind: "revalidate" });
    expect(resolveRepairOutcome({
      outcome: { role: "repair", state: "completed", action: "escalate", summary: "Hard", reason: "Hard" },
      candidateKeys: [], scope: "graph_node", parentEscalationAvailable: true
    })).toEqual({ kind: "escalate" });
    expect(resolveRepairOutcome({
      outcome: { role: "repair", state: "completed", action: "escalate", summary: "Hard", reason: "Hard" },
      candidateKeys: [], scope: "graph", parentEscalationAvailable: false
    })).toEqual({ kind: "needs_input" });
  });

  it("caps repair attempt and depth at three even when project data is looser", () => {
    const repair = {
      id: "repair", description: "Repair", task: "Repair", nodeStyle: "sol" as const, nodeSize: "medium" as const,
      executionProfileId: "sol", primaryInstructionId: "project:repair", skillIds: [],
      maxRepairAttempts: 100, maxRepairDepth: 100
    };
    expect(hasRepairCapacity(repair, 3, 3)).toBe(true);
    expect(hasRepairCapacity(repair, 4, 3)).toBe(false);
    expect(hasRepairCapacity(repair, 3, 4)).toBe(false);
  });
});

