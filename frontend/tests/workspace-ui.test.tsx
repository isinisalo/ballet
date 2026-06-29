import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, AppData, EventDefinition, Policy } from "../../backend/shared/domain";
import { WorkspaceApp } from "../src/WorkspaceApp";

const now = "2026-06-26T10:00:00.000Z";

const baseData = (): AppData => ({
  projects: [{
    id: "project-1",
    name: "Ballet",
    description: "AgentOps project",
    status: "active",
    createdAt: now,
    updatedAt: now,
    relativePath: ".ballet/project.md",
    frontmatter: { title: "Ballet" },
    body: "# Ballet"
  }],
  goals: [],
  adrs: [],
  agents: [{
    id: "agent-1",
    name: "Existing Agent",
    description: "Handles work",
    instructions: "Do work",
    skills: [],
    enabled: true,
    status: "online",
    createdAt: now,
    updatedAt: now,
    relativePath: ".codex/agents/existing-agent.toml",
    frontmatter: { runtime: "runtime-1" }
  }],
  skills: [],
  runtimes: [{
    id: "runtime-1",
    name: "codex-cli",
    type: "codex-cli",
    command: "codex",
    config: { cwd: "." },
    enabled: true,
    createdAt: now,
    updatedAt: now,
    relativePath: ".ballet/runtimes/codex-cli.md"
  }],
  policies: [],
  eventDefinitions: [{
    id: "event-1",
    name: "Plan approved",
    description: "Plan approved event",
    active: true,
    eventType: "plan.approved.v1",
    source: "agentd",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now,
    relativePath: ".ballet/events/plan-approved.md"
  }],
  events: [],
  agentRuns: [],
  projectDocumentTree: []
});

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" }
  });

const noContent = () => new Response(null, { status: 204 });

const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

function installApi(data: AppData, options: { failNextSave?: boolean } = {}) {
  let agentCounter = data.agents.length + 1;
  let policyCounter = data.policies.length + 1;
  let eventCounter = data.eventDefinitions.length + 1;
  let failNextSave = options.failNextSave ?? false;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};

    if (url === "/api/data" && method === "GET") return jsonResponse(data);
    if (failNextSave && method === "POST") {
      failNextSave = false;
      return jsonResponse({ error: "Injected save failure" }, { status: 500 });
    }

    if (url === "/api/agents" && method === "POST") {
      const incoming = body as Partial<Agent>;
      const saved: Agent = {
        id: incoming.id ?? `agent-${agentCounter++}`,
        name: incoming.name ?? "",
        description: incoming.description ?? "",
        instructions: incoming.instructions ?? "",
        skills: [],
        enabled: incoming.enabled ?? true,
        status: incoming.status ?? "offline",
        model: incoming.model,
        modelReasoningEffort: incoming.modelReasoningEffort,
        createdAt: now,
        updatedAt: now,
        relativePath: `.codex/agents/${slug(incoming.name ?? "agent")}.toml`,
        frontmatter: incoming.frontmatter
      };
      data.agents = [...data.agents.filter((agent) => agent.id !== saved.id), saved];
      return jsonResponse(saved);
    }

    if (url.startsWith("/api/agents/") && method === "DELETE") {
      const id = decodeURIComponent(url.split("/").pop() ?? "");
      data.agents = data.agents.filter((agent) => agent.id !== id);
      return noContent();
    }

    if (url === "/api/policies" && method === "POST") {
      const incoming = body as Partial<Policy>;
      const saved: Policy = {
        id: incoming.id ?? `policy-${policyCounter++}`,
        name: incoming.name ?? "",
        description: incoming.description ?? "",
        active: incoming.active ?? true,
        match: incoming.match,
        action: incoming.action,
        projectId: incoming.projectId ?? "*",
        eventTypes: incoming.eventTypes ?? [],
        source: incoming.source ?? "*",
        payloadMetadata: incoming.payloadMetadata ?? {},
        targetAgentId: incoming.targetAgentId ?? "agent-1",
        createdAt: now,
        updatedAt: now,
        relativePath: `.ballet/policies/${slug(incoming.name ?? "policy")}.md`
      };
      data.policies = [...data.policies.filter((policy) => policy.id !== saved.id), saved];
      return jsonResponse(saved);
    }

    if (url.startsWith("/api/policies/") && method === "DELETE") {
      const id = decodeURIComponent(url.split("/").pop() ?? "");
      data.policies = data.policies.filter((policy) => policy.id !== id);
      return noContent();
    }

    if (url === "/api/event-definitions" && method === "POST") {
      const incoming = body as Partial<EventDefinition>;
      const saved: EventDefinition = {
        id: incoming.id ?? `event-${eventCounter++}`,
        name: incoming.name ?? "",
        description: incoming.description ?? "",
        active: incoming.active ?? true,
        eventType: incoming.eventType ?? "",
        source: incoming.source ?? "agentd",
        tags: incoming.tags ?? [],
        producers: incoming.producers ?? [],
        payloadExample: incoming.payloadExample ?? {},
        body: incoming.body,
        createdAt: now,
        updatedAt: now,
        relativePath: `.ballet/events/${slug(incoming.eventType ?? incoming.name ?? "event")}.md`
      };
      data.eventDefinitions = [...data.eventDefinitions.filter((definition) => definition.id !== saved.id), saved];
      return jsonResponse(saved);
    }

    if (url.startsWith("/api/event-definitions/") && method === "DELETE") {
      const id = decodeURIComponent(url.split("/").pop() ?? "");
      data.eventDefinitions = data.eventDefinitions.filter((definition) => definition.id !== id);
      return noContent();
    }

    return jsonResponse({ error: `Unhandled ${method} ${url}` }, { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, data };
}

async function renderRoute(path: string, data = baseData(), options?: { failNextSave?: boolean }) {
  window.history.pushState({}, "", path);
  const api = installApi(data, options);
  render(<WorkspaceApp />);
  await screen.findByText("AgentOps");
  await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith("/api/data", expect.anything()));
  return api;
}

async function confirmDelete(user: ReturnType<typeof userEvent.setup>, triggerName: string) {
  await user.click(screen.getByRole("button", { name: triggerName }));
  const confirmButtons = screen.getAllByRole("button", { name: "Delete" });
  await user.click(confirmButtons[confirmButtons.length - 1]);
}

describe("workspace entity UI flows", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates, edits, deletes, and navigates agents", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/agents");

    await user.type(screen.getByLabelText("Name"), "Review Agent");
    await user.type(screen.getByLabelText("Description"), "Reviews implementation");
    await user.type(screen.getByLabelText("Instructions"), "Review the change.");
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(window.location.pathname).toBe("/agents"));
    expect(window.location.search).toContain(encodeURIComponent(".codex/agents/review-agent.toml"));
    expect(data.agents.some((agent) => agent.name === "Review Agent")).toBe(true);

    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Reviews and summarizes implementation");
    await user.click(screen.getByRole("button", { name: "Save agent" }));
    await waitFor(() => expect(data.agents.find((agent) => agent.name === "Review Agent")?.description).toBe("Reviews and summarizes implementation"));

    await confirmDelete(user, "Delete agent");
    await waitFor(() => expect(data.agents.some((agent) => agent.name === "Review Agent")).toBe(false));
    expect(window.location.pathname).toBe("/agents");
  });

  it("creates, edits, deletes, and navigates policies", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/policies");

    await user.type(screen.getByLabelText("Description"), "Route approved plans.");
    await user.click(screen.getByRole("button", { name: "Save policy" }));

    await waitFor(() => expect(data.policies).toHaveLength(1));
    expect(window.location.pathname).toBe("/policies");
    expect(window.location.search).toContain(".ballet%2Fpolicies%2Fon-plan-approved-start-agent-1-agent.md");

    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Route approved plans to the agent.");
    await user.click(screen.getByRole("button", { name: "Save policy" }));
    await waitFor(() => expect(data.policies[0]?.description).toBe("Route approved plans to the agent."));

    await confirmDelete(user, "Delete policy");
    await waitFor(() => expect(data.policies).toHaveLength(0));
    expect(window.location.pathname).toBe("/policies");
  });

  it("creates, edits, deletes, and navigates event definitions", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/events");

    await user.type(screen.getByLabelText("Name"), "Change ready");
    await user.type(screen.getByLabelText("Description"), "Change is ready.");
    await user.type(screen.getByLabelText("Event type"), "change.ready.v1");
    await user.click(screen.getByRole("button", { name: "Save definition" }));

    await waitFor(() => expect(data.eventDefinitions.some((definition) => definition.eventType === "change.ready.v1")).toBe(true));
    expect(window.location.pathname).toBe("/events");
    expect(window.location.search).toContain(".ballet%2Fevents%2Fchange-ready-v1.md");

    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Change is ready for review.");
    await user.click(screen.getByRole("button", { name: "Save definition" }));
    await waitFor(() => expect(data.eventDefinitions.find((definition) => definition.eventType === "change.ready.v1")?.description).toBe("Change is ready for review."));

    await confirmDelete(user, "Delete event definition");
    await waitFor(() => expect(data.eventDefinitions.some((definition) => definition.eventType === "change.ready.v1")).toBe(false));
    expect(window.location.pathname).toBe("/events");
  });

  it("shows save failures to users", async () => {
    const user = userEvent.setup();
    await renderRoute("/agents", baseData(), { failNextSave: true });

    await user.type(screen.getByLabelText("Name"), "Failing Agent");
    await user.type(screen.getByLabelText("Instructions"), "Try to save.");
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    expect((await screen.findAllByText("Injected save failure")).length).toBeGreaterThan(0);
  });
});
