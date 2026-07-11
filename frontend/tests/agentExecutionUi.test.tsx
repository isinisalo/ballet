import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentExecutionForm } from "../src/workspace/agents/execution/AgentExecutionForm";
import { now, runtimeDevice } from "./runtimeFixtures";

describe("agent execution binding UI", () => {
  it("requires explicit device, provider, model and reasoning before saving", async () => {
    const user = userEvent.setup();
    const device = runtimeDevice();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === "/api/agents/agent-1/execution-binding" && !init?.method) return Response.json(null);
      if (url === "/api/agents/agent-1/execution-binding" && init?.method === "PUT") return Response.json({
        id: "binding-1", projectId: "project-1", agentId: "agent-1", runtimeBackendId: "backend-codex", deviceId: "device-1", provider: "codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: ["/shared/reference"] }, createdAt: now, updatedAt: now
      });
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentExecutionForm agentId="agent-1" />);

    const save = await screen.findByRole("button", { name: "Save execution" });
    expect(save).toBeDisabled();
    expect(screen.getByText("Select computer")).toBeInTheDocument();
    const computer = screen.getByLabelText("Computer");
    await waitFor(() => expect(computer).toBeEnabled());
    await user.click(computer);
    await user.click(await screen.findByRole("option", { name: /Iiro's MacBook Pro/ }));
    await user.click(screen.getByLabelText("Provider"));
    await user.click(await screen.findByRole("option", { name: "Codex CLI" }));
    expect(save).toBeDisabled();
    await user.click(screen.getByLabelText("Model"));
    await user.click(await screen.findByRole("option", { name: "GPT Test" }));
    await user.click(screen.getByLabelText("Reasoning"));
    await user.click(await screen.findByRole("option", { name: "high" }));
    expect(screen.getByText("current project checkout only")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Advanced policy/ }));
    await user.click(screen.getByRole("switch", { name: /Network access/ }));
    await user.type(screen.getByLabelText("Additional read-only roots"), "/shared/reference");
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1/execution-binding",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ runtimeBackendId: "backend-codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: ["/shared/reference"] } }) })
    ));
  });
});
