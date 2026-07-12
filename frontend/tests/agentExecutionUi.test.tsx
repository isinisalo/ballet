import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AgentRuntimeConfiguration } from "@shared/api/workspace-contracts";
import { AgentExecutionForm } from "../src/workspace/agents/execution/AgentExecutionForm";
import { agentRuntimeConfiguration, localRuntime } from "./runtimeFixtures";

describe("agent execution configuration UI", () => {
  it("restores portable intent and exposes the local provider without a computer selector", () => {
    const configuration: AgentRuntimeConfiguration = {
      ...agentRuntimeConfiguration({ network: true }),
      resolved: undefined,
      issues: [{ code: "provider_unavailable", path: "agents.agent-1", agentId: "agent-1", message: "Codex CLI needs attention on this machine." }]
    };
    render(<AgentExecutionForm agentId="agent-1" runtime={localRuntime()} configuration={configuration} />);

    expect(screen.queryByLabelText("Runtime")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toHaveTextContent("Codex CLI");
    expect(screen.getByLabelText("Model")).toHaveTextContent("GPT Test");
    expect(screen.getByLabelText("Reasoning effort")).toHaveTextContent("high");
    expect(screen.getByRole("link", { name: "Open Runtimes" })).toHaveAttribute("href", "/runtimes");
  });

  it("autosaves provider, model, reasoning, network and local roots", async () => {
    const user = userEvent.setup();
    const empty: AgentRuntimeConfiguration = { localPolicy: { readOnlyRoots: [] }, issues: [] };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { provider: "codex"; model: string; reasoning: string; policy: { network: boolean; readOnlyRoots: string[] } };
      return Response.json(agentRuntimeConfiguration({ provider: payload.provider, model: payload.model, reasoning: payload.reasoning, network: payload.policy.network, readOnlyRoots: payload.policy.readOnlyRoots }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentExecutionForm agentId="agent-1" runtime={localRuntime()} configuration={empty} />);

    expect(screen.queryByRole("button", { name: "Save execution" })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Provider"));
    await user.click(await screen.findByRole("option", { name: "Codex CLI" }));
    await user.click(screen.getByLabelText("Model"));
    await user.click(await screen.findByRole("option", { name: "GPT Test" }));
    await user.click(screen.getByLabelText("Reasoning effort"));
    await user.click(await screen.findByRole("option", { name: "high" }));
    await user.click(screen.getByRole("switch", { name: "Network access" }));
    await user.click(screen.getByRole("button", { name: /Advanced policy/ }));
    await user.type(screen.getByLabelText("Additional read-only roots"), "/shared/reference");
    await user.tab();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1/runtime",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ provider: "codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: ["/shared/reference"] } }) })
    ));
  });
});
