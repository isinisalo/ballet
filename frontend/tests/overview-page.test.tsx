// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRun, AppData } from "../../backend/shared/domain";
import type { FlowViewModel } from "../../backend/shared/flow";
import { OverviewPage } from "../src/features/overview/OverviewPage";

const at = "2026-06-25T08:00:00.000Z";

const run = (overrides: Partial<AgentRun> & Pick<AgentRun, "runId" | "operationId" | "status" | "updatedAt">): AgentRun => ({
  runId: overrides.runId,
  triggerEventId: `${overrides.runId}-event`,
  policyId: "policy-1",
  policyVersion: 1,
  agentRole: overrides.agentRole ?? "developer-agent",
  operationId: overrides.operationId,
  operationVersion: overrides.operationVersion ?? 1,
  status: overrides.status,
  attempt: overrides.attempt ?? 1,
  error: overrides.error,
  createdAt: overrides.createdAt ?? at,
  updatedAt: overrides.updatedAt
});

const data: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [{
    id: "developer-agent",
    name: "Developer Agent",
    description: "Implements changes.",
    instructions: "Implement changes.",
    skills: [],
    enabled: true,
    status: "offline",
    createdAt: at,
    updatedAt: at
  }],
  skills: [],
  runtimes: [],
  contracts: [],
  operations: [
    {
      id: "developer-agent/implement-change",
      version: 1,
      name: "Implement change",
      description: "Implement the approved work.",
      active: true,
      agentId: "developer-agent",
      instructions: "Implement.",
      inputContract: { id: "implement-input", version: 1 },
      outputContract: { id: "implement-output", version: 1 },
      emissionRequired: true,
      createdAt: at,
      updatedAt: at
    },
    {
      id: "developer-agent/review-change",
      version: 1,
      name: "Review change",
      description: "Review completed work.",
      active: true,
      agentId: "developer-agent",
      instructions: "Review.",
      inputContract: { id: "review-input", version: 1 },
      outputContract: { id: "review-output", version: 1 },
      emissionRequired: false,
      createdAt: at,
      updatedAt: at
    }
  ],
  policies: [],
  emissionPolicies: [],
  loopDefinitions: [],
  loopInstances: [],
  eventDefinitions: [],
  events: [],
  agentRuns: [
    run({
      runId: "run-waiting",
      operationId: "developer-agent/implement-change",
      status: "needs_input",
      updatedAt: "2026-06-25T09:00:00.000Z"
    }),
    run({
      runId: "run-failed",
      operationId: "developer-agent/implement-change",
      status: "failed",
      error: "Output did not match the contract.",
      updatedAt: "2026-06-25T08:00:00.000Z"
    }),
    run({
      runId: "run-completed",
      operationId: "developer-agent/review-change",
      status: "completed",
      updatedAt: "2026-06-25T10:00:00.000Z"
    })
  ]
};

const flows: FlowViewModel[] = [{
  id: "delivery-loop",
  version: 2,
  name: "Delivery loop",
  description: "Coordinates delivery work.",
  active: true,
  entryEvents: [],
  terminalEvents: [],
  nodes: [],
  edges: [],
  safetyLimits: { maxHops: 20, maxRuns: 20, maxIterationsPerStep: 3 },
  diagnostics: [{
    severity: "error",
    title: "Missing result handling",
    explanation: "The Flow needs a result branch.",
    affectedResource: { type: "loop", id: "delivery-loop", version: 2 },
    suggestedFix: "Open the Flow and add result handling."
  }],
  health: "invalid"
}];

afterEach(() => cleanup());

describe("OverviewPage", () => {
  it("exposes clear primary actions for Flow creation, failed runs, and configuration issues", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();

    render(<OverviewPage data={data} flows={flows} navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: /create flow/i }));
    await user.click(screen.getByRole("button", { name: /open failed run/i }));
    await user.click(screen.getByRole("button", { name: /fix configuration issue/i }));

    expect(navigate).toHaveBeenNthCalledWith(1, "/flows?create=1");
    expect(navigate).toHaveBeenNthCalledWith(2, "/runs/run-failed");
    expect(navigate).toHaveBeenNthCalledWith(3, "/flows/delivery-loop?version=2");
  });

  it("shows human-readable run names and statuses without leaking operation IDs", () => {
    render(<OverviewPage data={data} flows={flows} navigate={vi.fn()} />);

    expect(screen.getAllByText("Implement change").length).toBeGreaterThan(0);
    expect(screen.getByText("Needs input")).toBeVisible();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.queryByText("developer-agent/implement-change")).not.toBeInTheDocument();

    const recentOutcomes = screen.getByText("Recent Outcomes").closest("section");
    const outcomeNames = within(recentOutcomes!).getAllByRole("button").map((button) => button.textContent);
    expect(outcomeNames).toEqual(["Review changeCompleted", "Implement changeFailed"]);
  });
});
