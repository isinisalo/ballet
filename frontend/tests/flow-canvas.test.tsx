// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowViewModel } from "../../backend/shared/flow";
import { FlowCanvas } from "../src/features/flows/canvas/FlowCanvas";

const flow: FlowViewModel = {
  id: "delivery-loop",
  version: 1,
  name: "Delivery loop",
  description: "Coordinates work.",
  active: true,
  entryEvents: [{ kind: "event", id: "plan-approved", eventType: "plan.approved.v1", name: "Plan approved", description: "Plan approved.", active: true }],
  terminalEvents: [{ kind: "event", id: "qa-failed", eventType: "qa.failed.v1", name: "QA failed", description: "Failed.", active: true }],
  nodes: [
    { kind: "event", id: "plan-approved", eventType: "plan.approved.v1", name: "Plan approved", description: "Plan approved.", active: true },
    { kind: "operation", id: "implement-op-node", operationId: "developer/implement", version: 1, name: "Implement change", description: "Implement.", agentId: "developer", agentName: "Developer", inputContract: { id: "input", version: 1 }, outputContract: { id: "output", version: 1 }, active: true },
    { kind: "event", id: "change-implemented", eventType: "change.implemented.v1", name: "Change implemented", description: "Implemented.", active: true },
    { kind: "operation", id: "qa-op-node", operationId: "qa/review", version: 1, name: "QA verification", description: "Verify.", agentId: "qa", agentName: "QA", inputContract: { id: "input", version: 1 }, outputContract: { id: "output", version: 1 }, active: true },
    { kind: "event", id: "qa-passed", eventType: "qa.passed.v1", name: "QA passed", description: "Passed.", active: true },
    { kind: "event", id: "qa-failed", eventType: "qa.failed.v1", name: "QA failed", description: "Failed.", active: true }
  ],
  edges: [
    { kind: "routing", id: "route-implement", from: "plan-approved", to: "implement-op-node", policyId: "route-implement", policyName: "Route implementation", active: true },
    { kind: "emission", id: "emit-implemented", from: "implement-op-node", to: "change-implemented", policyId: "emit-implemented", policyVersion: 1, slot: "completed", policyName: "Publish implemented", active: true },
    { kind: "routing", id: "route-qa", from: "change-implemented", to: "qa-op-node", policyId: "route-qa", policyName: "Route QA", active: true },
    { kind: "emission", id: "emit-qa-passed", from: "qa-op-node", to: "qa-passed", policyId: "emit-qa-passed", policyVersion: 1, slot: "completed", policyName: "Publish QA passed", active: true },
    { kind: "emission", id: "emit-qa-failed", from: "qa-op-node", to: "qa-failed", policyId: "emit-qa-failed", policyVersion: 1, slot: "failed", policyName: "Publish QA failed", active: false }
  ],
  safetyLimits: { maxHops: 20, maxRuns: 20, maxIterationsPerStep: 3 },
  diagnostics: [{ severity: "warning", title: "Missing QA retry", explanation: "Retry branch is not configured.", affectedResource: { type: "emission-policy", id: "emit-qa-failed", version: 1 } }],
  health: "warning"
};

afterEach(() => cleanup());

describe("FlowCanvas", () => {
  it("renders event, routing, operation, emission, terminal, branch, and dense layout controls", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FlowCanvas flow={flow} onSelect={onSelect} />);

    expect(screen.getByRole("region", { name: "Delivery loop Flow Canvas" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /GIVE THE AGENT\s+Input mapping/i })[0]).toBeVisible();
    expect(screen.getByRole("button", { name: /ASK\s+Developer\s+Implement change/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /WHEN FAILED\s+QA failed/i })).toBeVisible();
    expect(screen.getByText("Terminal event")).toBeVisible();
    expect(screen.getAllByText("Result branch")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /dense view/i })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /ASK\s+Developer\s+Implement change/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "operation", id: "implement-op-node" });
  });
});
