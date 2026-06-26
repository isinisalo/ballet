// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData, AgentRun } from "../../backend/shared/domain";
import { AgentsPage } from "../src/features/agents/AgentsPage";

const at = "2026-06-25T08:00:00.000Z";

const run = (input: Partial<AgentRun> & Pick<AgentRun, "runId" | "operationId" | "updatedAt" | "status">): AgentRun => ({
  runId: input.runId,
  triggerEventId: `${input.runId}-event`,
  policyId: "route-work",
  policyVersion: 1,
  agentRole: input.agentRole ?? "developer-agent",
  operationId: input.operationId,
  operationVersion: input.operationVersion ?? 1,
  status: input.status,
  attempt: input.attempt ?? 1,
  createdAt: input.createdAt ?? at,
  updatedAt: input.updatedAt
});

const data: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [{
    id: "developer-agent",
    name: "Developer",
    description: "Implements product changes.",
    instructions: "Reusable implementation guidance.",
    skills: [{ id: "typescript", name: "TypeScript", description: "TypeScript work.", metadata: {}, enabled: true }],
    enabled: true,
    status: "offline",
    model: "gpt-5-codex",
    createdAt: at,
    updatedAt: at
  }],
  skills: [],
  runtimes: [],
  contracts: [],
  operations: [
    {
      id: "developer-agent/implement",
      version: 1,
      name: "Implement change",
      description: "Implement the requested change.",
      active: true,
      agentId: "developer-agent",
      instructions: "Task-specific implementation instructions.",
      inputContract: { id: "implement-input", version: 1 },
      outputContract: { id: "implement-output", version: 1 },
      emissionRequired: false,
      createdAt: at,
      updatedAt: at
    },
    {
      id: "developer-agent/fix-tests",
      version: 1,
      name: "Fix failing tests",
      description: "Repair failing verification.",
      active: true,
      agentId: "developer-agent",
      instructions: "Task-specific test repair instructions.",
      inputContract: { id: "fix-tests-input", version: 1 },
      outputContract: { id: "fix-tests-output", version: 1 },
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
    run({ runId: "old-run", operationId: "developer-agent/implement", updatedAt: "2026-06-25T08:00:00.000Z", status: "completed" }),
    run({ runId: "new-run", operationId: "developer-agent/fix-tests", updatedAt: "2026-06-25T09:00:00.000Z", status: "failed" })
  ]
};

afterEach(() => {
  cleanup();
});

describe("AgentsPage", () => {
  it("shows plain agent purpose, model, operations, skills, and most recent runs first", () => {
    const navigate = vi.fn();

    render(<AgentsPage data={data} selectedAgentId="developer-agent" navigate={navigate} />);

    expect(screen.getByRole("heading", { name: "Agents" })).toBeVisible();
    expect(screen.getByText("Purpose")).toBeVisible();
    expect(screen.getAllByText("Implements product changes.")[0]).toBeVisible();
    expect(screen.getByText("Model")).toBeVisible();
    expect(screen.getByText("gpt-5-codex")).toBeVisible();
    expect(screen.getByText("Operations implemented by this agent")).toBeVisible();
    expect(screen.getAllByText("Implement change")[0]).toBeVisible();
    expect(screen.getByText("TypeScript")).toBeVisible();

    const recentRuns = screen.getByLabelText("Recent runs for Developer");
    const runNames = within(recentRuns).getAllByText(/Fix failing tests|Implement change/).map((node) => node.textContent);
    expect(runNames).toEqual(["Fix failing tests", "Implement change"]);
    expect(within(recentRuns).getByText("failed")).toBeVisible();
  });
});
