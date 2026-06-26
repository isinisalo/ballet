// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../../backend/shared/domain";
import type { FlowViewModel } from "../../backend/shared/flow";
import { RuntimeConsolePage } from "../src/features/runtime-console/RuntimeConsolePage";

const at = "2026-06-25T08:00:00.000Z";
const data = {
  projects: [], goals: [], adrs: [], agents: [{ id: "developer", name: "Developer", description: "Dev.", instructions: "Dev.", skills: [], enabled: true, status: "online", createdAt: at, updatedAt: at }],
  skills: [], runtimes: [], contracts: [], operations: [], policies: [], emissionPolicies: [], loopDefinitions: [], loopInstances: [], eventDefinitions: [], events: [],
  agentRuns: [{ runId: "run-1", triggerEventId: "event-1", policyId: "route", policyVersion: 1, agentRole: "developer", operationId: "developer/implement", operationVersion: 1, status: "failed", attempt: 1, createdAt: at, updatedAt: at }]
} satisfies AppData;
const flows: FlowViewModel[] = [{ id: "delivery-loop", version: 1, name: "Delivery loop", description: "Flow.", active: true, entryEvents: [], terminalEvents: [], nodes: [], edges: [], safetyLimits: { maxHops: 20, maxRuns: 20, maxIterationsPerStep: 3 }, diagnostics: [], health: "ready" }];

afterEach(() => cleanup());

describe("RuntimeConsolePage", () => {
  it("renders logs, filters entries, runs safe commands, navigates, and reports unknown commands", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<RuntimeConsolePage data={data} flows={flows} navigate={navigate} />);

    expect(screen.getByText(/developer\/implement failed/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "error" }));
    expect(screen.getByText(/developer\/implement failed/i)).toBeVisible();

    const command = screen.getByLabelText("Runtime command");
    await user.type(command, "show flows{Enter}");
    expect(screen.getAllByText(/1 flows: Delivery loop/i)[0]).toBeVisible();
    await user.type(command, "open run run-1{Enter}");
    expect(navigate).toHaveBeenCalledWith("/runs/run-1");
    await user.type(command, "rm -rf workspace{Enter}");
    expect(screen.getAllByText(/Unknown safe command/i)[0]).toBeVisible();
  });
});
