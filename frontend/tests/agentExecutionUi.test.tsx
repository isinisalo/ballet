import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentExecutionForm } from "../src/workspace/agents/execution/AgentExecutionForm";
import { agentRuntimeConfiguration, runtimeDevice } from "./runtimeFixtures";

describe("agent runtime configuration UI", () => {
  it("restores portable intent from a fresh clone and only requires attaching a compatible computer", async () => {
    const user = userEvent.setup();
    const device = runtimeDevice();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === "/api/agents/agent-1/runtime" && !init?.method) return Response.json({
        intent: { provider: "codex", model: "gpt-test", reasoning: "high", policy: { network: true } },
        issues: [{ code: "missing_attachment", path: "attachments.agent-1", agentId: "agent-1", message: "No compatible computer is attached on this machine." }]
      });
      if (url === "/api/agents/agent-1/runtime" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as { runtimeBackendId: string; model: string; reasoning: string; policy: { network: boolean; readOnlyRoots: string[] } };
        return Response.json(agentRuntimeConfiguration({ backendId: payload.runtimeBackendId, model: payload.model, reasoning: payload.reasoning, network: payload.policy.network, readOnlyRoots: payload.policy.readOnlyRoots }));
      }
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentExecutionForm agentId="agent-1" />);

    expect(await screen.findByText(/Portable intent: Codex CLI · gpt-test · high · network on/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Runtime"));
    await user.click(await screen.findByRole("option", { name: /Iiro's MacBook Pro/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1/runtime",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ runtimeBackendId: "backend-codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: [] } }) })
    ));
  });

  it("saves a valid device, provider, model and reasoning selection automatically", async () => {
    const user = userEvent.setup();
    const device = runtimeDevice();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === "/api/agents/agent-1/runtime" && !init?.method) return Response.json({ issues: [] });
      if (url === "/api/agents/agent-1/runtime" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as { runtimeBackendId: string; model: string; reasoning: string; policy: { network: boolean; readOnlyRoots: string[] } };
        return Response.json(agentRuntimeConfiguration({ backendId: payload.runtimeBackendId, model: payload.model, reasoning: payload.reasoning, network: payload.policy.network, readOnlyRoots: payload.policy.readOnlyRoots }));
      }
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentExecutionForm agentId="agent-1" />);

    expect(screen.queryByRole("button", { name: "Save execution" })).not.toBeInTheDocument();
    expect(screen.getByText("Select runtime")).toBeInTheDocument();
    const runtime = screen.getByLabelText("Runtime");
    await waitFor(() => expect(runtime).toBeEnabled());
    await user.click(runtime);
    await user.click(await screen.findByRole("option", { name: /Iiro's MacBook Pro/ }));
    await user.click(screen.getByLabelText("Provider"));
    await user.click(await screen.findByRole("option", { name: "Codex CLI" }));
    await user.click(screen.getByLabelText("Model"));
    await user.click(await screen.findByRole("option", { name: "GPT Test" }));
    await user.click(screen.getByLabelText("Reasoning effort"));
    await user.click(await screen.findByRole("option", { name: "high" }));
    expect(screen.getByText("current project checkout only")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Advanced policy/ }));
    await user.click(screen.getByRole("switch", { name: /Network access/ }));
    await user.type(screen.getByLabelText("Additional read-only roots"), "/shared/reference");
    await user.tab();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1/runtime",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ runtimeBackendId: "backend-codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: ["/shared/reference"] } }) })
    ));
  });
});
