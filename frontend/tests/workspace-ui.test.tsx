import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, AppData, ProjectAutomationConfig } from "../../backend/shared/domain";
import { policyOutputEventTypes } from "../../backend/shared/policy-actions";
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
    config: { args: "[]" }
  }],
  policies: [{
    id: "policy-1",
    name: "Assign existing agent",
    description: "",
    active: true,
    match: { eventTypes: ["existing.implementation.failed.v1"], projectId: "*", source: "*" },
    action: { type: "start_agent_run", targetAgentId: "agent-1" },
    projectId: "*",
    eventTypes: ["existing.implementation.failed.v1"],
    source: "*",
    payloadMetadata: {},
    targetAgentId: "agent-1",
    createdAt: now,
    updatedAt: now
  }],
  eventDefinitions: [{
    id: "existing.implementation.complete.v1",
    name: "existing.implementation.complete.v1",
    description: "Generated agent action output event.",
    active: true,
    eventType: "existing.implementation.complete.v1",
    source: "agentd",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now
  }, {
    id: "existing.implementation.failed.v1",
    name: "existing.implementation.failed.v1",
    description: "Generated agent action output event.",
    active: true,
    eventType: "existing.implementation.failed.v1",
    source: "agentd",
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
    triggers: [{
      id: "manual-start",
      description: "Manual workflow start"
    }],
    actions: [{
      id: "implementation",
      description: "Implement work"
    }],
    policies: [{
      id: "on.existing.implementation.failed.v1.then.existing.start.implementation",
      source: "event",
      event: "existing.implementation.failed.v1",
      agent: "existing",
      action: "implementation",
      enabled: true
    }],
    workflows: [{
      id: "workflow-1",
      title: "Default workflow",
      steps: ["on.existing.implementation.failed.v1.then.existing.start.implementation"]
    }],
    runtimes: [{
      id: "runtime-1",
      title: "codex-cli",
      command: "codex",
      args: []
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
      data.eventDefinitions = [...new Set(data.agents.flatMap((agent) =>
        saved.actions.flatMap((action) => policyOutputEventTypes({ agent: agent.name.split(/\s+/)[0]?.toLowerCase() ?? agent.id, action: action.id }))
      ))].map((eventType) => ({
        id: eventType,
        name: eventType,
        description: "Generated agent action output event.",
        active: true,
        eventType,
        source: "agentd",
        tags: [],
        producers: [],
        payloadExample: {},
        createdAt: now,
        updatedAt: now
      }));
      data.policies = saved.policies.map((policy) => ({
        id: policy.id,
        name: policy.id,
        description: "",
        active: policy.enabled,
        match: { eventTypes: [policy.source === "trigger" ? `trigger.${policy.trigger}` : policy.event ?? ""], projectId: "*", source: "*" },
        action: { type: "start_agent_run", targetAgentId: policy.agent },
        projectId: "*",
        eventTypes: [policy.source === "trigger" ? `trigger.${policy.trigger}` : policy.event ?? ""],
        source: "*",
        payloadMetadata: {},
        targetAgentId: policy.agent,
        createdAt: now,
        updatedAt: now
      }));
      data.runtimes = saved.runtimes.map((runtime) => ({
        id: runtime.id,
        name: runtime.title,
        type: runtime.command === "codex" ? "codex-cli" : "custom",
        command: runtime.command,
        config: { args: JSON.stringify(runtime.args) },
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

    expect(screen.queryByRole("tab", { name: /events/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add event/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /policies/i })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: /workflows/i }));
    expect(screen.getByLabelText("Policy: on.existing.implementation.failed.v1.then.existing.start.implementation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Agent: existing")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Events: existing.implementation.complete.v1")).not.toBeInTheDocument();
    expect(screen.getAllByText("on:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("then:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("start:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("existing.implementation.failed.v1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("existing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("implementation").length).toBeGreaterThan(0);
    expect(screen.getByText("existing.implementation.complete.v1")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add policy step for/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Output events")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /policies/i }));
    await user.click(screen.getByLabelText("Event"));
    await user.click(await screen.findByText("existing.implementation.blocked.v1 · output"));

    await user.click(screen.getByRole("tab", { name: /workflows/i }));
    expect(screen.getByLabelText("Policy: on.existing.implementation.blocked.v1.then.existing.start.implementation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation).not.toHaveProperty("events"));
    expect(data.automation.policies[0]?.event).toBe("existing.implementation.blocked.v1");
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"steps\":[\"on.existing.implementation.blocked.v1.then.existing.start.implementation\"]")
    }));
  });

  it("edits workflow policy agent and action from the canvas", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.agents.push({
      id: "agent-2",
      name: "Review Agent",
      description: "Reviews work",
      instructions: "Review work",
      skills: [],
      enabled: true,
      status: "online",
      createdAt: now,
      updatedAt: now,
      relativePath: ".codex/agents/review-agent.toml",
      frontmatter: { runtime: "runtime-1" }
    });
    workflowData.automation.actions.push({
      id: "review-pass",
      description: "Review output"
    });
    const { data, fetchMock } = await renderRoute("/automation/workflows", workflowData);

    expect(screen.queryByLabelText("Workflow policy agent")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit workflow policy" }));

    await user.selectOptions(screen.getByLabelText("Workflow policy agent"), "review");
    await user.selectOptions(screen.getByLabelText("Workflow policy action"), "review-pass");

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.policies[0]).toMatchObject({
      agent: "review",
      action: "review-pass",
      id: "on.existing.implementation.failed.v1.then.review.start.review-pass"
    }));
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"steps\":[\"on.existing.implementation.failed.v1.then.review.start.review-pass\"]")
    }));
  });

  it("creates an automation action and selects it from policy actions", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/actions");

    expect(screen.getByRole("tab", { name: /actions/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByDisplayValue("Implement work")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add action" }));
    await screen.findByDisplayValue("New action");
    await user.clear(screen.getByLabelText("Action ID"));
    await user.type(screen.getByLabelText("Action ID"), "review-pass");
    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Review output");
    expect(screen.getByDisplayValue("Review output")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions.some((action) => action.id === "review-pass" && action.description === "Review output")).toBe(true));

    await user.click(screen.getByRole("tab", { name: /policies/i }));
    await user.click(screen.getByLabelText("Action"));
    await user.click(await screen.findByRole("option", { name: /review-pass/i }));

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.policies[0]?.action).toBe("review-pass"));
    expect(data.automation.policies[0]?.id).toBe("on.existing.implementation.failed.v1.then.existing.start.review-pass");
    expect(data.automation.policies).toHaveLength(1);
  });

  it("creates, edits, deletes, and saves automation triggers", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/triggers");

    expect(screen.getByRole("tab", { name: /triggers/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByDisplayValue("Manual workflow start")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add trigger" }));
    await user.clear(screen.getByLabelText("Trigger ID"));
    await user.type(screen.getByLabelText("Trigger ID"), "release-ready");
    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Release can start.");
    expect(screen.getByLabelText("Trigger ID")).toHaveValue("release-ready");
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.triggers.some((trigger) => trigger.id === "release-ready")).toBe(true));

    await confirmDelete(user, "Delete trigger");
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.triggers.some((trigger) => trigger.id === "release-ready")).toBe(false));
  });

  it("switches a policy from event source to trigger source and updates workflow references", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/policies");

    await user.click(screen.getByLabelText("Source"));
    await user.click(await screen.findByText("Trigger"));
    expect(screen.getByLabelText("Trigger")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /workflows/i }));
    expect(screen.getByLabelText("Policy: on.trigger.manual-start.then.existing.start.implementation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.policies[0]).toMatchObject({
      source: "trigger",
      trigger: "manual-start",
      id: "on.trigger.manual-start.then.existing.start.implementation"
    }));
    expect(data.automation.workflows[0]?.steps).toEqual(["on.trigger.manual-start.then.existing.start.implementation"]);
  });

  it("falls back from the removed automation events route", async () => {
    await renderRoute("/automation/events");

    expect(screen.queryByRole("tab", { name: /events/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Ballet").length).toBeGreaterThan(0);
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
