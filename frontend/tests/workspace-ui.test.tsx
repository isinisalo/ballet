import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData, MarkdownDocument, ProjectDocumentTreeNode } from "../../shared/api/workspace-contracts";
import type { Agent } from "../../shared/api/workspace-contracts";
import type { ProjectAutomationConfig } from "../../shared/api/workspace-contracts";
import type { Skill } from "../../shared/api/workspace-contracts";
import { policyOutputEventTypes } from "../../shared/policy-actions";
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
    match: { eventTypes: ["existing.implementation.failed"], projectId: "*", source: "*" },
    action: { type: "start_agent_run", targetAgentId: "agent-1" },
    projectId: "*",
    eventTypes: ["existing.implementation.failed"],
    source: "*",
    payloadMetadata: {},
    targetAgentId: "agent-1",
    createdAt: now,
    updatedAt: now
  }],
  eventDefinitions: [{
    id: "existing.implementation.complete",
    name: "existing.implementation.complete",
    description: "Generated agent action output event.",
    active: true,
    eventType: "existing.implementation.complete",
    source: "agentd",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now
  }, {
    id: "existing.implementation.failed",
    name: "existing.implementation.failed",
    description: "Generated agent action output event.",
    active: true,
    eventType: "existing.implementation.failed",
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
      id: "on.existing.implementation.failed.then.existing.start.implementation",
      source: "event",
      event: "existing.implementation.failed",
      agent: "existing",
      action: "implementation",
      enabled: true
    }],
    workflows: [{
      id: "workflow-1",
      title: "Default workflow",
      steps: ["on.existing.implementation.failed.then.existing.start.implementation"]
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

const documentTreeFile = (collection: string, title: string, relativePath: string) => ({
  type: "file" as const,
  label: title,
  document: {
    id: relativePath,
    collection,
    title,
    frontmatter: { title },
    body: `# ${title}`,
    absolutePath: `/workspace/${relativePath}`,
    relativePath,
    slug: slug(title)
  }
});

const dataWithProjectDocumentTree = () => {
  const data = baseData();
  data.projectDocumentTree = [{
    type: "directory",
    label: "ADR",
    relativePath: ".ballet/adr",
    children: [documentTreeFile("adrs", "ADR One", ".ballet/adr/one.md")]
  }, {
    type: "directory",
    label: "Goals",
    relativePath: ".ballet/goals",
    children: [documentTreeFile("goals", "Goal One", ".ballet/goals/one.md")]
  }, {
    type: "directory",
    label: "Instructions",
    relativePath: ".ballet/instructions",
    children: [documentTreeFile("documents", "Instruction One", ".ballet/instructions/one.md")]
  }];
  return data;
};

const dataWithSkill = () => {
  const data = baseData();
  data.skills = [{
    id: "fixture-skill",
    name: "Fixture Skill",
    description: "Writes specs.",
    metadata: {},
    body: "# Fixture Skill\n\nOriginal body.",
    relativePath: ".agents/skills/fixture-skill/SKILL.md",
    slug: "SKILL",
    frontmatter: {
      name: "Fixture Skill",
      description: "Writes specs.",
      tags: ["docs"]
    }
  }];
  return data;
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" }
  });

const noContent = () => new Response(null, { status: 204 });

const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

const updateProjectTreeDocument = (
  nodes: ProjectDocumentTreeNode[],
  document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">
): MarkdownDocument | undefined => {
  for (const node of nodes) {
    if (node.type === "file" && node.document.relativePath === document.relativePath) {
      node.document = {
        ...node.document,
        frontmatter: document.frontmatter,
        body: document.body,
        title: typeof document.frontmatter.title === "string" ? document.frontmatter.title : node.document.title
      };
      return node.document;
    }

    if (node.type === "directory") {
      const updated = updateProjectTreeDocument(node.children, document);
      if (updated) return updated;
    }
  }

  return undefined;
};

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

    if (url === "/api/skills" && method === "POST") {
      const incoming = body as Partial<Skill>;
      const saved: Skill = {
        id: incoming.id ?? slug(incoming.name ?? "skill"),
        name: incoming.name ?? "",
        description: incoming.description ?? "",
        metadata: incoming.metadata ?? {},
        body: incoming.body ?? "",
        relativePath: incoming.relativePath ?? `.agents/skills/${slug(incoming.name ?? "skill")}/SKILL.md`,
        slug: incoming.slug ?? "SKILL",
        frontmatter: incoming.frontmatter
      };
      data.skills = [...data.skills.filter((skill) => skill.id !== saved.id), saved];
      return jsonResponse(saved);
    }

    if (url.startsWith("/api/skills/") && method === "DELETE") {
      const id = decodeURIComponent(url.split("/").pop() ?? "");
      data.skills = data.skills.filter((skill) => skill.id !== id);
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

    if (url === "/api/project-documents" && method === "POST") {
      const incoming = body as Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;
      const saved = updateProjectTreeDocument(data.projectDocumentTree ?? [], incoming);
      return saved ? jsonResponse(saved) : jsonResponse({ error: "Document not found" }, { status: 404 });
    }

    return jsonResponse({ error: `Unhandled ${method} ${url}` }, { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, data };
}

async function renderRoute(path: string, data = baseData(), options?: { failNextSave?: boolean }) {
  cleanup();
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

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("workspace entity UI flows", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("does not render the removed sidebar theme selector", async () => {
    await renderRoute("/automation");

    expect(screen.queryByRole("button", { name: "Light theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dark theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "System theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();
  });

  it("toggles project document sidebar menus closed after they have been opened", async () => {
    const user = userEvent.setup();
    await renderRoute("/projects/project-1/adrs", dataWithProjectDocumentTree());

    const projectToggle = screen.getByRole("button", { name: "Project" });
    expect(projectToggle).toHaveAttribute("aria-expanded", "true");
    const adrToggle = screen.getByRole("button", { name: "ADR" });
    expect(adrToggle).toHaveAttribute("aria-expanded", "true");
    expect(adrToggle.querySelector(".lucide-chevron-right")).not.toBeNull();
    await user.click(adrToggle);
    expect(adrToggle).toHaveAttribute("aria-expanded", "false");

    for (const label of ["Instructions", "Goals"]) {
      const toggle = screen.getByRole("button", { name: label });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle.querySelector(".lucide-chevron-right")).not.toBeNull();
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
  });

  it.each([
    { route: "/projects/project-1/adrs", title: "ADR One", relativePath: ".ballet/adr/one.md" },
    { route: "/projects/project-1/goals", title: "Goal One", relativePath: ".ballet/goals/one.md" }
  ])("renders the Markdown workbench for $route and saves the selected document", async ({ route, title, relativePath }) => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute(route, dataWithProjectDocumentTree());

    const frontmatter = screen.getByLabelText(/yaml frontmatter/i);
    const markdownBody = screen.getByLabelText(/markdown body/i);
    expect(frontmatter).toHaveValue(`title: ${title}`);
    expect(markdownBody).toHaveValue(`# ${title}`);
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeInTheDocument();

    await user.clear(frontmatter);
    await user.type(frontmatter, `title: Updated ${title}`);
    await user.clear(markdownBody);
    await user.type(markdownBody, `# Updated ${title}\n\nDocument body`);
    await user.click(screen.getByRole("button", { name: "Save Markdown" }));

    await waitFor(() => expect(data.projectDocumentTree?.some((node) =>
      node.type === "directory" && node.children.some((child) =>
        child.type === "file" && child.document.relativePath === relativePath && child.document.body === `# Updated ${title}\n\nDocument body`
      )
    )).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/project-documents", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining(`"relativePath":"${relativePath}"`)
    }));
  });

  it("renders, previews, and saves skills through the Markdown workbench", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/skills", dataWithSkill());

    const frontmatter = screen.getByLabelText(/yaml frontmatter/i);
    const markdownBody = screen.getByLabelText(/markdown body/i);
    expect(screen.getByText("Markdown Workbench")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save skill" })).toBeInTheDocument();
    expect((frontmatter as HTMLTextAreaElement).value).toContain("name: Fixture Skill");
    expect(markdownBody).toHaveValue("# Fixture Skill\n\nOriginal body.");

    await user.clear(frontmatter);
    await user.type(frontmatter, "name: Updated Skill\ndescription: Updated description\ntags:\n  - docs\n  - review");
    await user.clear(markdownBody);
    await user.type(markdownBody, "# Updated Skill\n\nDraft body marker.");
    expect(screen.getAllByText("Updated Skill").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft body marker.").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Save skill" }));

    await waitFor(() => expect(data.skills[0]).toMatchObject({
      id: "fixture-skill",
      name: "Updated Skill",
      description: "Updated description",
      relativePath: ".agents/skills/fixture-skill/SKILL.md",
      body: "# Updated Skill\n\nDraft body marker."
    }));
    expect(data.skills[0]?.frontmatter).toMatchObject({
      name: "Updated Skill",
      description: "Updated description",
      tags: ["docs", "review"]
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/skills", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"relativePath\":\".agents/skills/fixture-skill/SKILL.md\"")
    }));
  });

  it("blocks invalid or unnamed skill frontmatter before saving", async () => {
    const user = userEvent.setup();
    const { fetchMock } = await renderRoute("/skills", dataWithSkill());
    const frontmatter = screen.getByLabelText(/yaml frontmatter/i);

    fireEvent.change(frontmatter, { target: { value: "name: [" } });
    await user.click(screen.getByRole("button", { name: "Save skill" }));
    expect((await screen.findAllByText(/Flow sequence/)).length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/skills", expect.anything());

    fireEvent.change(frontmatter, { target: { value: "description: Missing name" } });
    await user.click(screen.getByRole("button", { name: "Save skill" }));
    expect(await screen.findByText("Skill frontmatter name is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/skills", expect.anything());
  });

  it("resets new skills and deletes existing skills from the workbench header", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/skills", dataWithSkill());

    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByLabelText(/yaml frontmatter/i)).toHaveValue("name: \"\"\ndescription: \"\"");
    expect(screen.getByLabelText(/markdown body/i)).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Delete skill" })).not.toBeInTheDocument();

    await renderRoute("/skills", data);
    await confirmDelete(user, "Delete skill");

    await waitFor(() => expect(data.skills).toHaveLength(0));
    expect(window.location.pathname).toBe("/skills");
  });

  it("defaults automation to workflows and locks policy input fields on the canvas", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/automation");

    expect(screen.queryByRole("tab", { name: /events/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    const automationToggle = screen.getByRole("button", { name: "Automation" });
    const environmentToggle = screen.getByRole("button", { name: "Environment" });
    const projectToggle = screen.getByRole("button", { name: "Project" });
    expect(automationToggle).toHaveAttribute("aria-expanded", "true");
    expect(environmentToggle).toHaveAttribute("aria-expanded", "false");
    expect(automationToggle.compareDocumentPosition(environmentToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(environmentToggle.compareDocumentPosition(projectToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();

    expect(screen.getByLabelText("Policy: on.existing.implementation.failed.then.existing.start.implementation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Agent: existing")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Events: existing.implementation.complete")).not.toBeInTheDocument();
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
    expect(screen.getAllByText("on:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("then:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("start:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("existing.implementation.failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("existing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("implementation").length).toBeGreaterThan(0);
    expect(screen.getByText("existing.implementation.complete")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add policy step for/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Output events")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit workflow policy" }));
    expect(screen.queryByLabelText("Workflow policy source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy event")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy trigger")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Workflow policy agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow policy action")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save workflow policy" }));
    expect(screen.getByLabelText("Policy: on.existing.implementation.failed.then.existing.start.implementation")).toBeInTheDocument();

    await waitFor(() => expect(data.automation).not.toHaveProperty("events"));
    expect(data.automation.policies[0]).toMatchObject({
      source: "event",
      event: "existing.implementation.failed",
      id: "on.existing.implementation.failed.then.existing.start.implementation"
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"steps\":[\"on.existing.implementation.failed.then.existing.start.implementation\"]")
    }));
  });

  it("selects automation entities from the sidebar and stores query ids", async () => {
    const user = userEvent.setup();
    await renderRoute("/automation");

    let actionsToggle = screen.getByRole("link", { name: "Actions" });
    expect(actionsToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(actionsToggle);
    actionsToggle = screen.getByRole("link", { name: "Actions" });
    expect(actionsToggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("link", { name: "implementation" }));
    expect(window.location.pathname).toBe("/automation/actions");
    expect(window.location.search).toBe("?id=implementation");
    expect(screen.getByDisplayValue("Implement work")).toBeInTheDocument();

    let triggersToggle = screen.getByRole("link", { name: "Triggers" });
    expect(triggersToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(triggersToggle);
    triggersToggle = screen.getByRole("link", { name: "Triggers" });
    expect(triggersToggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("link", { name: "manual-start" }));
    expect(window.location.pathname).toBe("/automation/triggers");
    expect(window.location.search).toBe("?id=manual-start");
    expect(screen.getByDisplayValue("Manual workflow start")).toBeInTheDocument();

    let workflowsToggle = screen.getByRole("link", { name: "Workflows" });
    expect(workflowsToggle).toHaveAttribute("aria-expanded", "true");
    await user.click(workflowsToggle);
    workflowsToggle = screen.getByRole("link", { name: "Workflows" });
    expect(workflowsToggle).toHaveAttribute("aria-expanded", "true");
    await user.click(workflowsToggle);
    workflowsToggle = screen.getByRole("link", { name: "Workflows" });
    expect(workflowsToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "workflow-1" })).not.toBeInTheDocument();
    await user.click(workflowsToggle);
    await user.click(screen.getByRole("link", { name: "workflow-1" }));
    expect(window.location.pathname).toBe("/automation/workflows");
    expect(window.location.search).toBe("?id=workflow-1");
    expect(screen.getByLabelText("Policy: on.existing.implementation.failed.then.existing.start.implementation")).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Edit workflow policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove workflow step" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save workflow policy" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Workflow policy agent"), "review");
    await user.selectOptions(screen.getByLabelText("Workflow policy action"), "review-pass");

    await user.click(screen.getByRole("button", { name: "Save workflow policy" }));
    await waitFor(() => expect(data.automation.policies[0]).toMatchObject({
      agent: "review",
      action: "review-pass",
      id: "on.existing.implementation.failed.then.review.start.review-pass"
    }));
    expect(screen.queryByLabelText("Workflow policy agent")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save workflow policy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit workflow policy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove workflow step" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"steps\":[\"on.existing.implementation.failed.then.review.start.review-pass\"]")
    }));
  });

  it("creates an automation action and selects it from policy actions", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/actions");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Actions" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("link", { name: "Workflows" }));
    await user.click(screen.getByRole("button", { name: "Edit workflow policy" }));
    await user.selectOptions(screen.getByLabelText("Workflow policy action"), "review-pass");
    await user.click(screen.getByRole("button", { name: "Save workflow policy" }));
    await waitFor(() => expect(data.automation.policies[0]?.action).toBe("review-pass"));
    expect(data.automation.policies[0]?.id).toBe("on.existing.implementation.failed.then.existing.start.review-pass");
    expect(data.automation.policies).toHaveLength(1);
  });

  it("renames an automation action and rewrites derived policy events", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.actions.push({
      id: "review",
      description: "Review implementation output."
    });
    workflowData.automation.policies.push({
      id: "on.existing.implementation.complete.then.existing.start.review",
      source: "event",
      event: "existing.implementation.complete",
      agent: "existing",
      action: "review",
      enabled: true
    });
    workflowData.automation.workflows[0]!.steps = [
      "on.existing.implementation.failed.then.existing.start.implementation",
      "on.existing.implementation.complete.then.existing.start.review"
    ];
    const { data } = await renderRoute("/automation/actions", workflowData);

    await user.clear(screen.getByLabelText("Action ID"));
    await user.type(screen.getByLabelText("Action ID"), "implement");
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions[0]?.id).toBe("implement"));
    expect(screen.queryByText("Automation config is invalid.")).not.toBeInTheDocument();
    expect(data.automation.policies[0]).toMatchObject({
      id: "on.existing.implement.failed.then.existing.start.implement",
      event: "existing.implement.failed",
      action: "implement"
    });
    expect(data.automation.policies[1]).toMatchObject({
      id: "on.existing.implement.complete.then.existing.start.review",
      event: "existing.implement.complete",
      action: "review"
    });
    expect(data.automation.workflows[0]?.steps).toEqual([
      "on.existing.implement.failed.then.existing.start.implement",
      "on.existing.implement.complete.then.existing.start.review"
    ]);
  });

  it("creates, edits, deletes, and saves automation triggers", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/triggers");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Triggers" })).toBeInTheDocument();
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

  it("creates a policy from a ghost event and keeps its input event read-only", async () => {
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
    const { data } = await renderRoute("/automation/policies", workflowData);

    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add policy step for existing.implementation.complete" }));
    expect(screen.getByLabelText("Policy: on.existing.implementation.complete.then.existing.start.implementation")).toBeInTheDocument();

    const editButtons = screen.getAllByRole("button", { name: "Edit workflow policy" });
    await user.click(editButtons[1]!);
    expect(screen.queryByLabelText("Workflow policy source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy event")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy trigger")).not.toBeInTheDocument();
    expect(screen.getAllByText("existing.implementation.complete").length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("Workflow policy agent"), "review");
    await user.selectOptions(screen.getByLabelText("Workflow policy action"), "review-pass");
    await user.click(screen.getByRole("button", { name: "Save workflow policy" }));
    expect(screen.getByLabelText("Policy: on.existing.implementation.complete.then.review.start.review-pass")).toBeInTheDocument();

    await waitFor(() => expect(data.automation.policies).toContainEqual(expect.objectContaining({
      source: "event",
      event: "existing.implementation.complete",
      agent: "review",
      action: "review-pass",
      id: "on.existing.implementation.complete.then.review.start.review-pass"
    })));
    expect(data.automation.workflows[0]?.steps).toEqual([
      "on.existing.implementation.failed.then.existing.start.implementation",
      "on.existing.implementation.complete.then.review.start.review-pass"
    ]);
  });

  it("routes legacy policies paths to workflow configuration", async () => {
    await renderRoute("/policies");

    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.existing.implementation.failed.then.existing.start.implementation")).toBeInTheDocument();
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
  });

  it("routes the removed agent runs page to workflow configuration", async () => {
    await renderRoute("/agent-runs");

    expect(screen.queryByRole("link", { name: /agent runs/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Agent runs")).not.toBeInTheDocument();
    expect(screen.queryByText("Run detail")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.existing.implementation.failed.then.existing.start.implementation")).toBeInTheDocument();
  });

  it("creates the first workflow policy from the workflow canvas", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.policies = [];
    workflowData.automation.workflows[0]!.steps = [];
    const { data } = await renderRoute("/automation/workflows", workflowData);

    await user.click(screen.getByRole("button", { name: "Add first policy" }));
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.policies).toHaveLength(1));
    expect(data.automation.policies[0]).toMatchObject({
      source: "trigger",
      trigger: "manual-start",
      agent: "existing",
      action: "implementation",
      id: "on.trigger.manual-start.then.existing.start.implementation"
    });
    expect(data.automation.workflows[0]?.steps).toEqual(["on.trigger.manual-start.then.existing.start.implementation"]);
  });

  it("falls back from the removed automation events route", async () => {
    await renderRoute("/automation/events");

    expect(screen.queryByRole("tab", { name: /events/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Ballet").length).toBeGreaterThan(0);
  });

  it("renders runtimes as a standalone page and routes legacy automation runtimes there", async () => {
    await renderRoute("/runtimes");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Environment" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Runtimes" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Add runtime" })).toBeInTheDocument();
    expect(screen.getByLabelText("Runtime ID")).toHaveValue("runtime-1");
    expect(screen.getByLabelText("Title")).toHaveValue("codex-cli");

    await renderRoute("/automation/runtimes");
    expect(screen.getByRole("button", { name: "Add runtime" })).toBeInTheDocument();
    expect(screen.getByLabelText("Runtime ID")).toHaveValue("runtime-1");
  });

  it("shows save failures as auto-dismissing floating notifications", async () => {
    const user = userEvent.setup();
    await renderRoute("/agents", baseData(), { failNextSave: true });

    await user.type(screen.getByLabelText("Name"), "Failing Agent");
    await user.type(screen.getByLabelText("Instructions"), "Try to save.");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save agent" }));
    await flushAsyncUpdates();

    const message = screen.getByText("Injected save failure");
    expect(message.closest("ol")).toHaveAttribute("aria-label", "Notifications");

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.queryByText("Injected save failure")).not.toBeInTheDocument();
  });

  it("shows successful saves as auto-dismissing floating notifications", async () => {
    const user = userEvent.setup();
    await renderRoute("/agents");

    await user.type(screen.getByLabelText("Name"), "Notify Agent");
    await user.type(screen.getByLabelText("Instructions"), "Save and notify.");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save agent" }));
    await flushAsyncUpdates();

    const message = screen.getByText("Saved.");
    expect(message.closest("ol")).toHaveAttribute("aria-label", "Notifications");

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
  });

  it("keeps clicked notifications visible until dismissed", async () => {
    const user = userEvent.setup();
    await renderRoute("/agents", baseData(), { failNextSave: true });

    await user.type(screen.getByLabelText("Name"), "Pinned Agent");
    await user.type(screen.getByLabelText("Instructions"), "Try to save.");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save agent" }));
    await flushAsyncUpdates();

    const message = screen.getByText("Injected save failure");
    const notification = message.closest("li");
    expect(notification).not.toBeNull();

    fireEvent.click(notification!);
    expect(notification).toHaveAttribute("data-pinned", "true");

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.getByText("Injected save failure")).toBeInTheDocument();
    fireEvent.click(within(notification!).getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Injected save failure")).not.toBeInTheDocument();
  });

  it("keeps automation config issues inline", async () => {
    const issueData = baseData();
    issueData.automationIssues = [{
      path: "automation.policies[0].event",
      message: "Automation config is invalid."
    }];

    await renderRoute("/automation", issueData);

    const issue = screen.getByText("automation.policies[0].event: Automation config is invalid.");
    expect(issue.closest("[role='alert']")).toBeInTheDocument();
    expect(issue.closest("ol")).toBeNull();
  });
});
