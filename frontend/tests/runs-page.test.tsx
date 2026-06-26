// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData, AgentRun } from "../../backend/shared/domain";
import type { FlowViewModel, TraceViewModel } from "../../backend/shared/flow";
import { RunsPage } from "../src/features/runs/RunsPage";

const apiMocks = vi.hoisted(() => ({
  getRunTrace: vi.fn(),
  retryAgentRun: vi.fn()
}));

vi.mock("@/api", () => ({
  api: apiMocks
}));

const at = "2026-06-25T08:00:00.000Z";

const run = (overrides: Partial<AgentRun>): AgentRun => ({
  runId: "run-1",
  triggerEventId: "event-1",
  policyId: "policy-1",
  policyVersion: 1,
  agentRole: "developer-agent",
  correlationId: "correlation-1",
  operationId: "developer-agent/implement-change",
  operationVersion: 1,
  loopDefinitionId: "delivery-loop",
  loopDefinitionVersion: 1,
  status: "failed",
  attempt: 1,
  error: "Tests failed",
  createdAt: at,
  updatedAt: at,
  ...overrides
});

const data: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [
    {
      id: "developer-agent",
      name: "Developer Agent",
      description: "Implements changes.",
      instructions: "Implement changes.",
      skills: [],
      enabled: true,
      status: "offline",
      createdAt: at,
      updatedAt: at
    },
    {
      id: "qa-agent",
      name: "QA Agent",
      description: "Verifies changes.",
      instructions: "Verify changes.",
      skills: [],
      enabled: true,
      status: "offline",
      createdAt: at,
      updatedAt: at
    }
  ],
  skills: [],
  runtimes: [],
  contracts: [],
  operations: [
    {
      id: "developer-agent/implement-change",
      version: 1,
      name: "Implement change",
      description: "Implement.",
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
      id: "qa-agent/verify-change",
      version: 1,
      name: "Verify change evidence",
      description: "Verify.",
      active: true,
      agentId: "qa-agent",
      instructions: "Verify.",
      inputContract: { id: "verify-input", version: 1 },
      outputContract: { id: "verify-output", version: 1 },
      emissionRequired: true,
      createdAt: at,
      updatedAt: at
    },
    {
      id: "developer-agent/ungrouped-task",
      version: 1,
      name: "Ungrouped task",
      description: "Standalone.",
      active: true,
      agentId: "developer-agent",
      instructions: "Do standalone work.",
      inputContract: { id: "standalone-input", version: 1 },
      outputContract: { id: "standalone-output", version: 1 },
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
    run({ runId: "run-dev", operationId: "developer-agent/implement-change", agentRole: "developer-agent", status: "failed", error: "Tests failed" }),
    run({ runId: "run-qa", operationId: "qa-agent/verify-change", operationVersion: 1, agentRole: "qa-agent", status: "queued", error: undefined }),
    run({
      runId: "run-standalone",
      operationId: "developer-agent/ungrouped-task",
      operationVersion: 1,
      agentRole: "developer-agent",
      loopDefinitionId: undefined,
      loopDefinitionVersion: undefined,
      correlationId: "correlation-2",
      triggerEventId: "event-2",
      status: "completed",
      error: undefined,
      createdAt: "2026-06-24T08:00:00.000Z",
      updatedAt: "2026-06-24T08:30:00.000Z"
    })
  ]
};

const flows: FlowViewModel[] = [{
  id: "delivery-loop",
  version: 1,
  name: "Delivery loop",
  description: "Delivery.",
  active: true,
  entryEvents: [],
  terminalEvents: [],
  nodes: [
    {
      kind: "operation",
      id: "operation:developer-agent/implement-change@1",
      operationId: "developer-agent/implement-change",
      version: 1,
      name: "Implement change",
      description: "Implement.",
      agentId: "developer-agent",
      agentName: "Developer Agent",
      inputContract: { id: "implement-input", version: 1 },
      outputContract: { id: "implement-output", version: 1 },
      active: true
    },
    {
      kind: "operation",
      id: "operation:qa-agent/verify-change@1",
      operationId: "qa-agent/verify-change",
      version: 1,
      name: "Verify change evidence",
      description: "Verify.",
      agentId: "qa-agent",
      agentName: "QA Agent",
      inputContract: { id: "verify-input", version: 1 },
      outputContract: { id: "verify-output", version: 1 },
      active: true
    }
  ],
  edges: [],
  safetyLimits: { maxHops: 20, maxRuns: 20, maxIterationsPerStep: 3 },
  diagnostics: [],
  health: "ready"
}];

const trace: TraceViewModel = {
  scope: "run",
  id: "run-dev",
  entries: [
    {
      id: "event:event-1",
      at,
      scope: "run",
      kind: "event_received",
      title: "Event received",
      summary: "Plan approved for feature-1",
      status: "received",
      eventId: "event-1",
      technicalDetails: { eventType: "plan.approved.v1", correlationId: "correlation-1" }
    },
    {
      id: "routing:event-1:policy-1",
      at,
      scope: "run",
      kind: "routing_matched",
      title: "Routing matched",
      summary: "The delivery rule matched.",
      status: "routed",
      runId: "run-dev",
      technicalDetails: { policyId: "policy-1" }
    },
    {
      id: "input-validation:event-1:policy-1",
      at,
      scope: "run",
      kind: "input_validated",
      title: "Input validated",
      summary: "Operation input satisfied implement-input@1.",
      status: "valid",
      runId: "run-dev",
      technicalDetails: { inputContractId: "implement-input", inputContractVersion: 1 }
    },
    {
      id: "run:run-dev",
      at,
      scope: "run",
      kind: "agent_failed",
      title: "Agent failed",
      summary: "Implement change is failed.",
      status: "failed",
      runId: "run-dev",
      technicalDetails: { runId: "run-dev", policyId: "policy-1" }
    },
    {
      id: "emission:run-dev:emit-change-implemented",
      at,
      scope: "run",
      kind: "emission_evaluated",
      title: "Emission evaluated",
      summary: "Result branch was evaluated.",
      status: "failed",
      runId: "run-dev",
      technicalDetails: { emissionPolicyId: "emit-change-implemented" }
    },
    {
      id: "gate:run-dev:emit-change-implemented:0",
      at,
      scope: "run",
      kind: "gate_failed",
      title: "Gate failed",
      summary: "required_value value_missing.",
      status: "failed",
      runId: "run-dev",
      technicalDetails: { gate: { type: "required_value", path: "/output/result/gitSha" } }
    }
  ]
};

beforeEach(() => {
  apiMocks.getRunTrace.mockReset();
  apiMocks.retryAgentRun.mockReset();
  apiMocks.getRunTrace.mockResolvedValue(trace);
  apiMocks.retryAgentRun.mockResolvedValue(run({ runId: "run-dev", status: "queued", error: undefined }));
});

afterEach(() => {
  cleanup();
});

describe("RunsPage human run view", () => {
  it("filters by Flow, status, agent, and date while keeping technical IDs collapsed", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<RunsPage data={data} flows={flows} selectedRunId="run-dev" refresh={async () => undefined} navigate={navigate} />);

    expect(await screen.findByText("Events and routing")).toBeVisible();
    expect(screen.getByText("Agent branches")).toBeVisible();
    expect(screen.getByText("Result handling")).toBeVisible();
    expect(screen.getByText("Input validated")).toBeVisible();
    expect(screen.getByText("Gate failed")).toBeVisible();
    expect(screen.getAllByText("Event").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Agent task").length).toBeGreaterThan(0);
    expect(screen.getByText("Result branch")).toBeVisible();
    expect(screen.getByText("Check")).toBeVisible();
    expect(screen.queryByText("event received")).not.toBeInTheDocument();
    expect(screen.queryByText("agent failed")).not.toBeInTheDocument();
    expect(screen.queryByText("emission evaluated")).not.toBeInTheDocument();
    expect(screen.getByText("Related branch runs")).toBeVisible();
    expect(screen.getByRole("button", { name: "Open related branch run Verify change evidence" })).toBeVisible();
    expect(screen.getAllByText("Failed: Tests failed").length).toBeGreaterThan(0);

    const technicalDetails = screen.getAllByText("Technical details").at(-1)!.closest("details");
    expect(technicalDetails).not.toHaveAttribute("open");
    expect(within(technicalDetails!).getByText(/run-dev/)).not.toBeVisible();

    await user.selectOptions(screen.getByLabelText("Flow"), "delivery-loop");
    expect(screen.getByRole("button", { name: "Open run Implement change" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open run Verify change evidence" })).toBeVisible();
    expect(screen.queryByText("Ungrouped task")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status"), "queued");
    expect(screen.queryByRole("button", { name: "Open run Implement change" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open run Verify change evidence" })).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Agent"), "qa-agent");
    expect(screen.getByRole("button", { name: "Open run Verify change evidence" })).toBeVisible();

    await user.clear(screen.getByLabelText("Date"));
    await user.type(screen.getByLabelText("Date"), "2026-06-24");
    expect(screen.getByText("No runs match the filters.")).toBeVisible();
  });

  it("retries failed runs and navigates to related branches", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();
    render(<RunsPage data={data} flows={flows} selectedRunId="run-dev" refresh={refresh} navigate={navigate} />);

    await screen.findByText("Events and routing");
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(apiMocks.retryAgentRun).toHaveBeenCalledWith("run-dev");
    expect(refresh).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Open related branch run Verify change evidence" }));
    expect(navigate).toHaveBeenCalledWith("/runs/run-qa");
  });
});
