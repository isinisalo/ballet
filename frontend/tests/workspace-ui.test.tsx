import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, AppData, ProjectAutomationConfig } from "../../backend/shared/domain";
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
    enabled: true,
    createdAt: now,
    updatedAt: now,
    config: { args: "[]", outputEvents: "{}" }
  }],
  policies: [{
    id: "policy-1",
    name: "Assign existing agent",
    description: "",
    active: true,
    match: { eventTypes: ["task.created"], projectId: "*", source: "*" },
    action: { type: "start_agent_run", targetAgentId: "agent-1" },
    projectId: "*",
    eventTypes: ["task.created"],
    source: "*",
    payloadMetadata: {},
    targetAgentId: "agent-1",
    createdAt: now,
    updatedAt: now
  }],
  eventDefinitions: [{
    id: "task.created",
    name: "Task created",
    description: "Task created event",
    active: true,
    eventType: "task.created",
    source: "user",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now
  }, {
    id: "task.updated",
    name: "Task updated",
    description: "Task updated event",
    active: true,
    eventType: "task.updated",
    source: "user",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now
  }],
  events: [],
  agentRuns: [],
  automation: {
    version: 1,
    events: [
      { id: "task.created", title: "Task created", source: "user" },
      { id: "task.updated", title: "Task updated", source: "user" },
      { id: "agent.output.completed", title: "Agent output completed", source: "runtime" }
    ],
    policies: [{
      id: "policy-1",
      title: "Assign existing agent",
      on: "task.created",
      run: { agent: "agent-1", runtime: "runtime-1" },
      enabled: true
    }],
    workflows: [{
      id: "workflow-1",
      title: "Default workflow",
      steps: ["policy-1"]
    }],
    runtimes: [{
      id: "runtime-1",
      title: "codex-cli",
      command: "codex",
      args: [],
      outputEvents: { completed: "agent.output.completed" }
    }]
  },
  automationIssues: [],
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
  let failNextSave = options.failNextSave ?? false;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};

    if (url === "/api/data" && method === "GET") return jsonResponse(data);
    if (failNextSave && (method === "POST" || method === "PUT")) {
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

    if (url === "/api/automation" && method === "PUT") {
      const saved = body as ProjectAutomationConfig;
      data.automation = saved;
      data.eventDefinitions = saved.events.map((event) => ({
        id: event.id,
        name: event.title,
        description: event.description ?? "",
        active: true,
        eventType: event.id,
        source: event.source,
        tags: [],
        producers: [],
        payloadExample: {},
        createdAt: now,
        updatedAt: now
      }));
      data.policies = saved.policies.map((policy) => ({
        id: policy.id,
        name: policy.title,
        description: "",
        active: policy.enabled,
        match: { eventTypes: [policy.on], projectId: "*", source: "*" },
        action: { type: "start_agent_run", targetAgentId: policy.run.agent },
        projectId: "*",
        eventTypes: [policy.on],
        source: "*",
        payloadMetadata: {},
        targetAgentId: policy.run.agent,
        createdAt: now,
        updatedAt: now
      }));
      data.runtimes = saved.runtimes.map((runtime) => ({
        id: runtime.id,
        name: runtime.title,
        type: runtime.command === "codex" ? "codex-cli" : "custom",
        command: runtime.command,
        config: { args: JSON.stringify(runtime.args), outputEvents: JSON.stringify(runtime.outputEvents) },
        enabled: true,
        createdAt: now,
        updatedAt: now
      }));
      data.automationIssues = [];
      return jsonResponse(saved);
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

  it("edits automation policies and derives workflow cards from policy data", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/automation");

    await user.click(screen.getByRole("tab", { name: /workflows/i }));
    expect(screen.getByText("task.created")).toBeInTheDocument();
    expect(screen.getByText("agent-1")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /policies/i }));
    await user.click(screen.getByLabelText("On event"));
    await user.click(await screen.findByText("task.updated · Task updated"));

    await user.click(screen.getByRole("tab", { name: /workflows/i }));
    expect(screen.getByText("task.updated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.policies[0]?.on).toBe("task.updated"));
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"steps\":[\"policy-1\"]")
    }));
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
