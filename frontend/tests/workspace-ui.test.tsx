import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData, MarkdownDocument, ProjectDocumentTreeNode } from "@shared/api/workspace-contracts";
import type { Agent } from "@shared/api/workspace-contracts";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import type { Skill } from "@shared/api/workspace-contracts";
import { policyOutputEventTypes } from "@shared/policy-actions";
import { WorkspaceApp } from "../src/WorkspaceApp";

const now = "2026-06-26T10:00:00.000Z";

const baseData = (): AppData => ({
  projects: [{
    id: "project-1",
    name: "Ballet",
    description: "Ballet project",
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
    match: { eventTypes: ["implementation.failed"], projectId: "*", source: "*" },
    action: { type: "start_agent_run", targetAgentId: "agent-1" },
    projectId: "*",
    eventTypes: ["implementation.failed"],
    source: "*",
    payloadMetadata: {},
    targetAgentId: "agent-1",
    createdAt: now,
    updatedAt: now
  }],
  eventDefinitions: [{
    id: "implementation.complete",
    name: "implementation.complete",
    description: "Generated agent action output event.",
    active: true,
    eventType: "implementation.complete",
    source: "agentd",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now
  }, {
    id: "implementation.failed",
    name: "implementation.failed",
    description: "Generated agent action output event.",
    active: true,
    eventType: "implementation.failed",
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
      description: "Implement work",
      outputIds: ["complete", "failed"],
      agentIds: ["agent-1"]
    }],
    outputs: [
      { id: "complete" },
      { id: "failed" },
      { id: "summary" }
    ],
    policies: [{
      id: "on.implementation.failed.start.implementation",
      source: "event",
      event: "implementation.failed",
      action: "implementation",
      enabled: true
    }],
    workflows: [{
      id: "workflow-1",
      title: "Default workflow",
      steps: ["on.implementation.failed.start.implementation"]
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

const workflowEdgeLabels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-workflow-edge-label=\"true\"]"));
const workflowEdgeStartLabels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-workflow-edge-start-label=\"true\"]"));
const workflowEdgeEndLabels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-workflow-edge-end-label=\"true\"]"));

const workflowEdgeLabelTexts = () => workflowEdgeLabels()
  .map((label) => label.dataset.workflowEdgeLabelValue ?? label.textContent);

const activateWorkflowNode = (element: HTMLElement) => {
  fireEvent.pointerDown(element, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerUp(element, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.click(element);
};

const expectActionSelectValue = (actionId: string) => {
  expect(screen.getByLabelText("Action ID")).toHaveTextContent(actionId);
};

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

type InstallApiOptions = {
  failNextSave?: boolean;
  failNextDelete?: boolean;
  saveFailureBody?: unknown;
  deleteFailureBody?: unknown;
};

function installApi(data: AppData, options: InstallApiOptions = {}) {
  let agentCounter = data.agents.length + 1;
  let projectDocumentCounter = 1;
  let failNextSave = options.failNextSave ?? false;
  let failNextDelete = options.failNextDelete ?? false;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};

    if (url === "/api/data" && method === "GET") return jsonResponse(data);
    if (failNextSave && (method === "POST" || method === "PUT")) {
      failNextSave = false;
      return jsonResponse(options.saveFailureBody ?? { error: "Injected save failure" }, { status: 500 });
    }
    if (failNextDelete && method === "DELETE") {
      failNextDelete = false;
      return jsonResponse(options.deleteFailureBody ?? { error: "Injected delete failure" }, { status: 500 });
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
      data.eventDefinitions = [...new Set(saved.actions.flatMap((action) =>
        policyOutputEventTypes({ action: action.id }, saved.actions, saved.outputs)
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
      data.policies = saved.policies.flatMap((policy) => {
        const action = saved.actions.find((candidate) => candidate.id === policy.action);
        return (action?.agentIds ?? []).map((agentId) => ({
        id: policy.id,
        name: policy.id,
        description: "",
        active: policy.enabled,
        match: { eventTypes: [policy.source === "trigger" ? `trigger.${policy.trigger}` : policy.event ?? ""], projectId: "*", source: "*" },
        action: { type: "start_agent_run", targetAgentId: agentId },
        projectId: "*",
        eventTypes: [policy.source === "trigger" ? `trigger.${policy.trigger}` : policy.event ?? ""],
        source: "*",
        payloadMetadata: {},
        targetAgentId: agentId,
        createdAt: now,
        updatedAt: now
        }));
      });
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

    if (url === "/api/project-documents/create" && method === "POST") {
      const incoming = body as { directoryPath: string; title: string };
      const relativePath = `${incoming.directoryPath}/${slug(incoming.title)}-${projectDocumentCounter++}.md`;
      const document = documentTreeFile("project", incoming.title, relativePath).document;
      const directory = data.projectDocumentTree?.find((node) =>
        node.type === "directory" && node.relativePath === incoming.directoryPath
      );
      if (directory?.type === "directory") directory.children.push({ type: "file", label: incoming.title, document });
      return jsonResponse(document, { status: 201 });
    }

    return jsonResponse({ error: `Unhandled ${method} ${url}` }, { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, data };
}

async function renderRoute(path: string, data = baseData(), options?: InstallApiOptions) {
  cleanup();
  window.history.pushState({}, "", path);
  const api = installApi(data, options);
  render(<WorkspaceApp />);
  await screen.findByText("Ballet");
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

  it("keeps agent delete confirmation open when the delete request fails", async () => {
    const user = userEvent.setup();
    const data = baseData();
    await renderRoute("/agents?path=.codex%2Fagents%2Fexisting-agent.toml", data, { failNextDelete: true });

    await user.click(screen.getByRole("button", { name: "Delete agent" }));
    const confirmDialog = screen.getByRole("dialog", { name: "Delete agent?" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Delete" }));

    const dialogError = await within(confirmDialog).findByText("Injected delete failure");
    expect(dialogError.closest("[role='alert']")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete agent?" })).toBeInTheDocument();
    expect(data.agents.some((agent) => agent.id === "agent-1")).toBe(true);
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
    { route: "/projects/project-1/adrs?path=.ballet%2Fadr%2Fone.md", title: "ADR One", relativePath: ".ballet/adr/one.md" },
    { route: "/projects/project-1/goals?path=.ballet%2Fgoals%2Fone.md", title: "Goal One", relativePath: ".ballet/goals/one.md" }
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

  it("creates project documents from collection routes without header plus actions", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/projects/project-1/goals", dataWithProjectDocumentTree());

    const frontmatter = screen.getByLabelText(/yaml frontmatter/i);
    const markdownBody = screen.getByLabelText(/markdown body/i);
    expect(frontmatter).toHaveValue("title: \"\"");
    expect(markdownBody).toHaveValue("");
    expect(screen.queryByRole("button", { name: "New goal" })).not.toBeInTheDocument();

    fireEvent.change(frontmatter, { target: { value: "title: Launch Plan" } });
    await user.type(markdownBody, "# Launch Plan\n\nShip it.");
    await user.click(screen.getByRole("button", { name: "Save Markdown" }));

    await waitFor(() => expect(data.projectDocumentTree?.some((node) =>
      node.type === "directory" && node.relativePath === ".ballet/goals" && node.children.some((child) =>
        child.type === "file" && child.document.relativePath === ".ballet/goals/launch-plan-1.md" && child.document.body === "# Launch Plan\n\nShip it."
      )
    )).toBe(true));
    expect(window.location.pathname).toBe("/projects/project-1/goals");
    expect(window.location.search).toBe("?path=.ballet%2Fgoals%2Flaunch-plan-1.md");
    expect(fetchMock).toHaveBeenCalledWith("/api/project-documents/create", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"title\":\"Launch Plan\"")
    }));
  });

  it("renders, previews, and saves skills through the Markdown workbench", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/skills?path=.agents%2Fskills%2Ffixture-skill%2FSKILL.md", dataWithSkill());

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

    expect(screen.getByLabelText(/yaml frontmatter/i)).toHaveValue("name: \"\"\ndescription: \"\"");
    expect(screen.getByLabelText(/markdown body/i)).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Delete skill" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();

    await renderRoute("/skills?path=.agents%2Fskills%2Ffixture-skill%2FSKILL.md", data);
    await confirmDelete(user, "Delete skill");

    await waitFor(() => expect(data.skills).toHaveLength(0));
    expect(window.location.pathname).toBe("/skills");
  });

  it("defaults automation to workflows and locks policy input fields on the canvas", async () => {
    const { data } = await renderRoute("/automation/workflows?id=workflow-1");

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
    expect(screen.getByRole("button", { name: "Delete workflow" })).toBeInTheDocument();

    const triggerReactFlowNode = screen.getByLabelText("Trigger: implementation.failed").closest(".react-flow__node");
    expect(triggerReactFlowNode?.querySelectorAll(".react-flow__handle-right")).toHaveLength(1);
    expect(triggerReactFlowNode?.querySelectorAll(".react-flow__handle-left")).toHaveLength(0);
    expect(triggerReactFlowNode?.querySelectorAll(".react-flow__handle-top")).toHaveLength(0);
    expect(triggerReactFlowNode?.querySelectorAll(".react-flow__handle-bottom")).toHaveLength(0);
    expect(within(triggerReactFlowNode as HTMLElement).queryByText("implementation.failed")).not.toBeInTheDocument();

    expect(screen.getByLabelText("Policy: on.implementation.failed.start.implementation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Agent: existing")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Events: implementation.complete")).not.toBeInTheDocument();
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
    expect(screen.queryByText("type:")).not.toBeInTheDocument();
    const implementationPolicyNode = screen.getByLabelText("Policy: on.implementation.failed.start.implementation");
    expect(implementationPolicyNode.parentElement).toHaveClass("w-full");
    expect(within(implementationPolicyNode).queryByText("on")).not.toBeInTheDocument();
    expect(within(implementationPolicyNode).queryByText("then:")).not.toBeInTheDocument();
    expect(implementationPolicyNode.querySelector("svg")).not.toBeInTheDocument();
    expect(screen.queryByText("start:")).not.toBeInTheDocument();
    expect(screen.getAllByText("implementation").length).toBeGreaterThan(0);
    expect(within(implementationPolicyNode).getByText("implementation")).toHaveAttribute("title", "Implement work");
    await waitFor(() => expect(workflowEdgeLabelTexts()).toContain("failed"));
    const implementationFailedEdgeLabel = workflowEdgeLabels().find((label) =>
      label.dataset.workflowEdgeLabelValue === "failed" &&
      label.dataset.workflowEdgeTargetKind === "policy"
    );
    const implementationFailedStartLabel = workflowEdgeStartLabels().find((label) =>
      label.dataset.workflowEdgeLabelValue === "failed" &&
      label.dataset.workflowEdgeTargetKind === "policy"
    );
    const implementationFailedEndLabel = workflowEdgeEndLabels().find((label) =>
      label.dataset.workflowEdgeLabelValue === "failed" &&
      label.dataset.workflowEdgeTargetKind === "policy"
    );
    expect(implementationFailedStartLabel).toBeDefined();
    expect(implementationFailedStartLabel).toHaveTextContent("on");
    expect(implementationFailedStartLabel).toHaveAttribute("data-workflow-edge-label-value", "failed");
    expect(implementationFailedEdgeLabel).toBeDefined();
    expect(implementationFailedEdgeLabel).toHaveTextContent("failed");
    expect(implementationFailedEdgeLabel).toHaveAttribute("data-workflow-edge-label-value", "failed");
    expect(implementationFailedEndLabel).toBeDefined();
    expect(implementationFailedEndLabel).toHaveTextContent("then");
    expect(implementationFailedEndLabel).toHaveAttribute("data-workflow-edge-label-value", "failed");
    expect(implementationFailedEdgeLabel).not.toHaveTextContent("implementation.failed");
    expect(implementationFailedStartLabel?.children[0]).toHaveTextContent("on");
    expect(implementationFailedStartLabel?.children[0]).toHaveClass("text-foreground");
    expect(implementationFailedEdgeLabel?.children[0]).toHaveTextContent("failed");
    expect(implementationFailedEdgeLabel?.children[0]).toHaveClass("text-primary");
    expect(implementationFailedEndLabel?.children[0]).toHaveTextContent("then");
    expect(implementationFailedEndLabel?.children[0]).toHaveClass("text-foreground");
    expect(await screen.findByText("complete")).toBeInTheDocument();
    expect(screen.queryByText("implementation.blocked")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add policy step for/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Output events")).not.toBeInTheDocument();

    activateWorkflowNode(implementationPolicyNode);
    expect(screen.queryByLabelText("Workflow policy source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy event")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy trigger")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy agent")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    expect(screen.queryByLabelText("Workflow policy action")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit workflow policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save workflow policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove workflow step" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.implementation.failed.start.implementation")).toBeInTheDocument();

    activateWorkflowNode(implementationPolicyNode);
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Action" })).not.toBeInTheDocument());

    await waitFor(() => expect(data.automation).not.toHaveProperty("events"));
    expect(data.automation.policies[0]).toMatchObject({
      source: "event",
      event: "implementation.failed",
      id: "on.implementation.failed.start.implementation"
    });
  });

  it("folds repeated workflow actions into one visible policy node", async () => {
    const workflowData = baseData();
    workflowData.automation.triggers = [{
      id: "project_brief_approved",
      description: "Project brief approved"
    }];
    workflowData.automation.outputs = [
      { id: "ready" },
      { id: "blocked" },
      { id: "approved" },
      { id: "changes_requested" }
    ];
    workflowData.automation.actions = [{
      id: "create-roadmap",
      description: "Create traceable delivery roadmap.",
      outputIds: ["ready", "blocked"],
      agentIds: ["agent-1"]
    }, {
      id: "challenge-roadmap",
      description: "Challenge roadmap.",
      outputIds: ["approved", "changes_requested"],
      agentIds: ["agent-1"]
    }, {
      id: "done",
      description: "Stop.",
      outputIds: [],
      agentIds: []
    }];
    workflowData.automation.policies = [{
      id: "p05.on.project-brief-approved.create-roadmap",
      source: "trigger",
      trigger: "project_brief_approved",
      action: "create-roadmap",
      enabled: true
    }, {
      id: "p06.on.roadmap-ready.challenge-roadmap",
      source: "event",
      event: "create-roadmap.ready",
      action: "challenge-roadmap",
      enabled: true
    }, {
      id: "p07.on.roadmap-rework.create-roadmap",
      source: "event",
      event: "challenge-roadmap.changes_requested",
      action: "create-roadmap",
      enabled: true
    }, {
      id: "p08.on.roadmap-approved.done",
      source: "event",
      event: "challenge-roadmap.approved",
      action: "done",
      enabled: true
    }];
    workflowData.automation.workflows = [{
      id: "roadmap-loop",
      title: "Roadmap loop",
      steps: workflowData.automation.policies.map((policy) => policy.id)
    }];

    await renderRoute("/automation/workflows?id=roadmap-loop", workflowData);

    const createRoadmapNode = await screen.findByLabelText("Policy: p05.on.project-brief-approved.create-roadmap");
    expect(createRoadmapNode).toBeInTheDocument();
    expect(screen.queryByLabelText("Policy: p07.on.roadmap-rework.create-roadmap")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: p06.on.roadmap-ready.challenge-roadmap")).toBeInTheDocument();
    expect(screen.getByLabelText("Policy: p08.on.roadmap-approved.done")).toBeInTheDocument();
    expect(within(createRoadmapNode).getByText("x2")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelectorAll("[data-workflow-edge-tone=\"return\"]")).toHaveLength(1);
    });
    const returnEdgeLabel = workflowEdgeLabels().find((label) =>
      label.dataset.workflowEdgeLabelTone === "return" &&
      label.dataset.workflowEdgeLabelValue === "changes_requested"
    );
    expect(returnEdgeLabel).toBeDefined();
    expect(returnEdgeLabel).toHaveTextContent("changes_requested");
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
    expect(screen.getByLabelText("Policy: on.implementation.failed.start.implementation")).toBeInTheDocument();
  });

  it("renders automation when loaded data is missing newer outputs field", async () => {
    const legacyData = baseData();
    delete (legacyData.automation as Partial<ProjectAutomationConfig>).outputs;

    await renderRoute("/automation/workflows?id=workflow-1", legacyData);

    expect(screen.getByRole("link", { name: "Actions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Outputs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gates" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.implementation.failed.start.implementation")).toBeInTheDocument();
  });

  it("renames the selected workflow from the automation header", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.workflows.push({
      id: "workflow-2",
      title: "Second workflow",
      steps: []
    });
    const { data, fetchMock } = await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    expect(screen.queryByLabelText("Workflow ID")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workflow-1" })).toHaveClass("cursor-pointer");
    await user.click(screen.getByRole("button", { name: "workflow-1" }));

    const workflowNameInput = screen.getByLabelText("Workflow name");
    const saveWorkflowButton = screen.getByRole("button", { name: "Save workflow" });
    expect(workflowNameInput).toHaveValue("workflow-1");
    await user.clear(workflowNameInput);
    expect(saveWorkflowButton).toBeDisabled();
    await user.type(workflowNameInput, "workflow-2");
    expect(saveWorkflowButton).toBeDisabled();
    await user.clear(workflowNameInput);
    await user.type(workflowNameInput, "roadmap-flow");
    expect(saveWorkflowButton).toBeEnabled();

    await user.click(saveWorkflowButton);

    await waitFor(() => expect(data.automation.workflows[0]).toMatchObject({
      id: "roadmap-flow",
      title: "roadmap-flow"
    }));
    expect(window.location.pathname).toBe("/automation/workflows");
    expect(window.location.search).toBe("?id=roadmap-flow");
    expect(screen.getByRole("button", { name: "roadmap-flow" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"id\":\"roadmap-flow\"")
    }));
  });

  it("creates a workflow from the automation header add action", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/automation/workflows");

    expect(screen.queryByRole("button", { name: "Add workflow" })).not.toBeInTheDocument();
    const workflowNameInput = screen.getByLabelText("Workflow ID");
    expect(workflowNameInput).toHaveValue("");
    fireEvent.change(workflowNameInput, { target: { value: "release-flow" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Release flow" } });

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.workflows.some((workflow) =>
      workflow.id === "release-flow" &&
      workflow.title === "Release flow" &&
      workflow.steps.length === 0
    )).toBe(true));
    expect(window.location.pathname).toBe("/automation/workflows");
    expect(window.location.search).toBe("?id=release-flow");
    expect(screen.getByRole("button", { name: "release-flow" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"id\":\"release-flow\"")
    }));
  });

  it("deletes the selected workflow from the automation header after confirmation", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.workflows.push({
      id: "workflow-2",
      title: "Second workflow",
      steps: []
    });
    const { data } = await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    await user.click(screen.getByRole("button", { name: "Delete workflow" }));

    const confirmDialog = screen.getByRole("dialog", { name: "Delete workflow?" });
    expect(confirmDialog).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Default workflow")).toBeInTheDocument();
    expect(within(confirmDialog).getByText(/This action cannot be undone./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(window.location.search).toBe("?id=workflow-2"));
    expect(window.location.pathname).toBe("/automation/workflows");
    expect(screen.getByRole("button", { name: "workflow-2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.workflows.map((workflow) => workflow.id)).toEqual(["workflow-2"]));
    expect(screen.queryByRole("link", { name: "workflow-1" })).not.toBeInTheDocument();
  });

  it("clears workflow selection after deleting the only workflow", async () => {
    const user = userEvent.setup();
    await renderRoute("/automation/workflows?id=workflow-1");

    await confirmDelete(user, "Delete workflow");

    await waitFor(() => expect(window.location.search).toBe(""));
    expect(window.location.pathname).toBe("/automation/workflows");
    expect(screen.queryByRole("button", { name: "Delete workflow" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Workflow ID")).toHaveValue("");
  });

  it("renders the selected workflow action sheet in view mode", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.actions.push({
      id: "review-pass",
      description: "Review output",
      outputIds: ["summary", "failed"],
      agentIds: ["agent-1"]
    });
    const { data, fetchMock } = await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    expect(screen.getByRole("button", { name: "Delete workflow" })).toBeInTheDocument();
    const implementationPolicyNode = screen.getByLabelText("Policy: on.implementation.failed.start.implementation");
    expect(screen.queryByLabelText("Workflow policy agent")).not.toBeInTheDocument();
    activateWorkflowNode(implementationPolicyNode);
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit workflow policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save workflow policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove workflow step" })).not.toBeInTheDocument();

    expectActionSelectValue("implementation");
    expect(screen.getByLabelText("Action ID")).toHaveAttribute("role", "combobox");
    expect(screen.getByLabelText("Description")).toHaveValue("Implement work");
    expect(screen.getByLabelText("Description")).toHaveProperty("readOnly", true);
    expect(screen.queryByRole("button", { name: "Remove agent Existing Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove output complete" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Action" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.policies[0]).toMatchObject({
      action: "implementation",
      event: "implementation.failed",
      id: "on.implementation.failed.start.implementation"
    }));
    expect(data.automation.workflows[0]?.steps).toEqual(["on.implementation.failed.start.implementation"]);
    expect(data.automation.actions[0]).toMatchObject({
      id: "implementation",
      description: "Implement work"
    });
    expect(data.automation.actions[1]).toMatchObject({
      id: "review-pass",
      description: "Review output"
    });
    expect(screen.queryByLabelText("Workflow policy agent")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save workflow policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit workflow policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove workflow step" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"steps\":[\"on.implementation.failed.start.implementation\"]")
    }));
  });

  it("removes the selected action node from the workflow sheet without deleting global config", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/automation/workflows?id=workflow-1");
    const policyId = "on.implementation.failed.start.implementation";

    activateWorkflowNode(screen.getByLabelText(`Policy: ${policyId}`));
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove from workflow" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Action" })).not.toBeInTheDocument());
    expect(screen.queryByLabelText(`Policy: ${policyId}`)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.workflows[0]?.steps).toEqual([]));
    expect(data.automation.policies).toContainEqual(expect.objectContaining({ id: policyId }));
    expect(data.automation.actions).toContainEqual(expect.objectContaining({ id: "implementation" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"steps\":[]")
    }));
  });

  it("switches workflow action sheet content and only closes with the sheet close button", async () => {
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
      description: "Review output",
      outputIds: ["summary", "failed"],
      agentIds: ["agent-2"]
    });
    workflowData.automation.policies.push({
      id: "on.implementation.complete.start.review-pass",
      source: "event",
      event: "implementation.complete",
      action: "review-pass",
      enabled: true
    });
    workflowData.automation.workflows[0]!.steps = [
      "on.implementation.failed.start.implementation",
      "on.implementation.complete.start.review-pass"
    ];
    await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    activateWorkflowNode(screen.getByLabelText("Policy: on.implementation.failed.start.implementation"));
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("implementation");

    activateWorkflowNode(screen.getByLabelText("Policy: on.implementation.complete.start.review-pass"));
    expectActionSelectValue("review-pass");

    const workflowPane = document.querySelector(".react-flow__pane");
    expect(workflowPane).toBeInTheDocument();
    fireEvent.click(workflowPane as Element);
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("review-pass");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Action" })).not.toBeInTheDocument());
  });

  it("opens the workflow action sheet from node click activation", async () => {
    await renderRoute("/automation/workflows?id=workflow-1");

    const implementationPolicyNode = screen.getByLabelText("Policy: on.implementation.failed.start.implementation");
    activateWorkflowNode(implementationPolicyNode);

    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
  });

  it("creates an automation action and keeps workflow action editing sheet-based", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/actions");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Actions" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Implement work")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add action" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Action ID"), "review-pass");
    await user.type(screen.getByLabelText("Description"), "Review output");
    expect(screen.getByDisplayValue("Review output")).toBeInTheDocument();
    expect(screen.getByText("Approval output")).toBeInTheDocument();
    expect(screen.getByText("Rework output")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change approval output" }));
    await user.type(screen.getByLabelText("Search or create output"), "summary");
    await user.click(await screen.findByRole("button", { name: "summary" }));
    await user.click(screen.getByRole("button", { name: "Change rework output" }));
    await user.type(screen.getByLabelText("Search or create output"), "needs-clarification");
    await user.click(await screen.findByRole("button", { name: "Create needs-clarification" }));

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions.some((action) =>
      action.id === "review-pass" &&
      action.description === "Review output" &&
      action.outputIds.join(",") === "summary,needs-clarification" &&
      action.agentIds.join(",") === "agent-1"
    )).toBe(true));
    expect(data.automation.outputs).toContainEqual({ id: "needs-clarification" });

    await user.click(screen.getByRole("link", { name: "Workflows" }));
    await user.click(screen.getByRole("link", { name: "workflow-1" }));
    activateWorkflowNode(screen.getByLabelText("Policy: on.implementation.failed.start.implementation"));
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    expect(screen.queryByLabelText("Workflow policy action")).not.toBeInTheDocument();
    expect(data.automation.policies[0]?.action).toBe("implementation");
    expect(data.automation.policies[0]?.id).toBe("on.implementation.failed.start.implementation");
    expect(data.automation.policies).toHaveLength(1);
  });

  it("allows saving an agentless action without outputs", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    };
    workflowData.automation.workflows[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    const { data } = await renderRoute("/automation/actions?id=implementation", workflowData);

    await user.click(screen.getByRole("button", { name: "Remove agent Existing Agent" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove output complete" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove output failed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add output" })).not.toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions[0]).toMatchObject({
      id: "implementation",
      outputIds: [],
      agentIds: []
    }));
    expect(data.eventDefinitions.map((event) => event.eventType)).not.toContain("implementation.complete");
    expect(data.eventDefinitions.map((event) => event.eventType)).not.toContain("implementation.failed");
  });

  it("selects an agentless workflow action without rendering output events", async () => {
    const workflowData = baseData();
    workflowData.automation.actions.push({
      id: "manual-gate",
      description: "Manual workflow stop",
      outputIds: [],
      agentIds: []
    });
    workflowData.automation.policies[0] = {
      id: "on.implementation.failed.start.manual-gate",
      source: "event",
      event: "implementation.failed",
      action: "manual-gate",
      enabled: true
    };
    workflowData.automation.workflows[0]!.steps = ["on.implementation.failed.start.manual-gate"];
    await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    activateWorkflowNode(screen.getByLabelText("Policy: on.implementation.failed.start.manual-gate"));

    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("manual-gate");
    expect(screen.queryByRole("button", { name: /Add policy step for manual-gate\./ })).not.toBeInTheDocument();
    expect(document.querySelector('[data-workflow-output-event^="manual-gate."]')).not.toBeInTheDocument();
  });

  it("selects, creates, normalizes, and preserves action output slots", async () => {
    const user = userEvent.setup();
    const selectorData = baseData();
    selectorData.automation.outputs = [{ id: "ready" }, { id: "cancelled" }, { id: "warn" }];
    selectorData.automation.actions[0]!.outputIds = ["ready", "warn"];
    const { data } = await renderRoute("/automation/actions?id=implementation", selectorData);

    await user.click(screen.getByRole("button", { name: "Change approval output" }));
    await user.type(screen.getByLabelText("Search or create output"), "cancel");
    await user.keyboard("{Enter}");
    expect(screen.getByText("cancelled")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change rework output" }));
    await user.type(screen.getByLabelText("Search or create output"), "Warm");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Remove output warm" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add output" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions[0]?.outputIds).toEqual(["cancelled", "warm"]));
    expect(data.automation.outputs).toContainEqual({ id: "warm" });
    expect(data.automation.outputs.filter((output) => output.id === "ready")).toHaveLength(1);
  });

  it("allows removing the optional rework output from an agent action", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    };
    workflowData.automation.workflows[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    const { data } = await renderRoute("/automation/actions?id=implementation", workflowData);

    expect(screen.queryByRole("button", { name: "Remove output complete" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove output failed" }));
    expect(screen.queryByRole("button", { name: "Remove output failed" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add rework output" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions[0]?.outputIds).toEqual(["complete"]));
    expect(data.eventDefinitions.map((event) => event.eventType)).toContain("implementation.complete");
    expect(data.eventDefinitions.map((event) => event.eventType)).not.toContain("implementation.failed");
  });

  it("renders every action output as a workflow event endpoint", async () => {
    const workflowData = baseData();
    workflowData.automation.actions[0]!.outputIds = ["failed", "summary"];

    await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    const outputEvent = screen.getByRole("button", { name: "Add policy step for implementation.failed" });
    const summaryOutputEvent = screen.getByRole("button", { name: "Add policy step for implementation.summary" });

    expect(outputEvent).toBeInTheDocument();
    expect(outputEvent).toHaveTextContent("+ Action");
    expect(outputEvent).not.toHaveTextContent("implementation.failed");
    await waitFor(() => expect(workflowEdgeLabelTexts()).toContain("failed"));
    expect(workflowEdgeEndLabels().some((label) =>
      label.dataset.workflowEdgeLabelValue === "failed" &&
      label.dataset.workflowEdgeTargetKind === "output-event"
    )).toBe(false);
    const implementationFailedGhostEdgeLabel = workflowEdgeLabels().find((label) =>
      label.dataset.workflowEdgeLabelValue === "failed" &&
      label.dataset.workflowEdgeTargetKind === "output-event"
    );
    expect(implementationFailedGhostEdgeLabel?.children[0]).toHaveClass("text-primary/55");
    expect(outputEvent.querySelector("svg")).not.toBeInTheDocument();
    expect(summaryOutputEvent).toBeInTheDocument();
    expect(summaryOutputEvent).not.toHaveTextContent("implementation.summary");
    expect(summaryOutputEvent.querySelector("svg")).not.toBeInTheDocument();
    await waitFor(() => expect(workflowEdgeLabelTexts()).toContain("summary"));
    expect(document.querySelector("[data-workflow-gate-output]")).not.toBeInTheDocument();
  });

  it("renders only the approval endpoint for one-output workflow actions", async () => {
    const workflowData = baseData();
    workflowData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    };
    workflowData.automation.workflows[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    workflowData.automation.actions[0]!.outputIds = ["summary"];

    await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    expect(screen.getByRole("button", { name: "Add policy step for implementation.summary" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add policy step for implementation.failed" })).not.toBeInTheDocument();
    await waitFor(() => expect(workflowEdgeLabelTexts()).toContain("summary"));
    expect(workflowEdgeLabelTexts()).not.toContain("failed");
  });

  it("creates done workflow handlers with the done action", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.outputs.push({ id: "done" });
    workflowData.automation.actions[0]!.outputIds = ["failed", "done"];
    workflowData.automation.actions.push({
      id: "done",
      description: "No further actions.",
      outputIds: [],
      agentIds: []
    });
    const { data } = await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    await user.click(screen.getByRole("button", { name: "Add policy step for implementation.done" }));
    expect(screen.getByLabelText("Policy: on.implementation.done.start.done")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("done");
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.policies).toContainEqual(expect.objectContaining({
      id: "on.implementation.done.start.done",
      source: "event",
      event: "implementation.done",
      action: "done"
    })));
    expect(data.automation.workflows[0]?.steps).toContain("on.implementation.done.start.done");
  });

  it("renames an automation action and rewrites derived policy events", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.actions.push({
      id: "review",
      description: "Review implementation output.",
      outputIds: ["complete", "failed"],
      agentIds: ["agent-1"]
    });
    workflowData.automation.policies.push({
      id: "on.implementation.complete.start.review",
      source: "event",
      event: "implementation.complete",
      action: "review",
      enabled: true
    });
    workflowData.automation.workflows[0]!.steps = [
      "on.implementation.failed.start.implementation",
      "on.implementation.complete.start.review"
    ];
    const { data } = await renderRoute("/automation/actions?id=implementation", workflowData);

    fireEvent.change(screen.getByLabelText("Action ID"), { target: { value: "implement" } });
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions[0]?.id).toBe("implement"));
    expect(screen.queryByText("Automation config is invalid.")).not.toBeInTheDocument();
    expect(data.automation.policies[0]).toMatchObject({
      id: "on.implement.failed.start.implement",
      event: "implement.failed",
      action: "implement"
    });
    expect(data.automation.policies[1]).toMatchObject({
      id: "on.implement.complete.start.review",
      event: "implement.complete",
      action: "review"
    });
    expect(data.automation.workflows[0]?.steps).toEqual([
      "on.implement.failed.start.implement",
      "on.implement.complete.start.review"
    ]);
  });

  it("creates, edits, deletes, and saves automation triggers", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/triggers");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Triggers" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Manual workflow start")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add trigger" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Trigger ID"), "release-ready");
    await user.type(screen.getByLabelText("Description"), "Release can start.");
    expect(screen.getByLabelText("Trigger ID")).toHaveValue("release-ready");
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.triggers.some((trigger) => trigger.id === "release-ready")).toBe(true));

    await confirmDelete(user, "Delete trigger");
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.triggers.some((trigger) => trigger.id === "release-ready")).toBe(false));
  });

  it("creates a policy from a ghost event and opens its action sheet", async () => {
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
      description: "Review output",
      outputIds: ["complete", "failed"],
      agentIds: ["agent-2"]
    });
    const { data } = await renderRoute("/automation/policies?id=workflow-1", workflowData);

    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Add policy step for implementation.complete" }));
    const foldedImplementationNode = screen.getByLabelText("Policy: on.implementation.failed.start.implementation");
    expect(foldedImplementationNode).toBeInTheDocument();
    expect(screen.queryByLabelText("Policy: on.implementation.complete.start.implementation")).not.toBeInTheDocument();
    expect(within(foldedImplementationNode).getByText("x2")).toBeInTheDocument();

    expect(screen.queryByLabelText("Workflow policy source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy event")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow policy trigger")).not.toBeInTheDocument();
    await waitFor(() => expect(workflowEdgeLabelTexts()).toContain("complete"));
    expect(screen.queryByLabelText("Workflow policy agent")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Action" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    expect(screen.queryByLabelText("Workflow policy action")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.implementation.failed.start.implementation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Action" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.policies).toContainEqual(expect.objectContaining({
      source: "event",
      event: "implementation.complete",
      action: "implementation",
      id: "on.implementation.complete.start.implementation"
    })));
    expect(data.automation.workflows[0]?.steps).toEqual([
      "on.implementation.failed.start.implementation",
      "on.implementation.complete.start.implementation"
    ]);
  });

  it("does not activate repeated workflow events that already have a policy handler", async () => {
    const workflowData = baseData();
    workflowData.automation.outputs.push({ id: "accepted" }, { id: "rejected" });
    workflowData.automation.actions.push({
      id: "review",
      description: "Review implementation output.",
      outputIds: ["accepted", "rejected"],
      agentIds: ["agent-1"]
    });
    workflowData.automation.policies = [{
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    }, {
      id: "on.implementation.complete.start.review",
      source: "event",
      event: "implementation.complete",
      action: "review",
      enabled: true
    }, {
      id: "on.review.rejected.start.implementation",
      source: "event",
      event: "review.rejected",
      action: "implementation",
      enabled: true
    }];
    workflowData.automation.workflows[0]!.steps = workflowData.automation.policies.map((policy) => policy.id);

    await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    expect(screen.getByLabelText("Policy: on.implementation.complete.start.review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add policy step for implementation.complete" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add policy step for implementation.failed" }).length).toBeGreaterThan(0);
  });

  it("renders workflow edges with the smart step edge type", async () => {
    const workflowData = baseData();
    workflowData.automation.outputs.push({ id: "accepted" }, { id: "rejected" });
    workflowData.automation.actions.push({
      id: "review",
      description: "Review implementation output.",
      outputIds: ["accepted", "rejected"],
      agentIds: ["agent-1"]
    });
    workflowData.automation.policies = [{
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    }, {
      id: "on.implementation.complete.start.review",
      source: "event",
      event: "implementation.complete",
      action: "review",
      enabled: true
    }, {
      id: "on.review.rejected.start.implementation",
      source: "event",
      event: "review.rejected",
      action: "implementation",
      enabled: true
    }];
    workflowData.automation.workflows[0]!.steps = workflowData.automation.policies.map((policy) => policy.id);

    await renderRoute("/automation/workflows?id=workflow-1", workflowData);
    await screen.findByLabelText("Policy: on.trigger.manual-start.start.implementation");
    expect(screen.queryByLabelText("Policy: on.review.rejected.start.implementation")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelectorAll(".react-flow__edge-workflowSmart").length).toBeGreaterThan(0);
    });
    expect(document.querySelectorAll(".react-flow__edge-smoothstep")).toHaveLength(0);
    expect(document.querySelectorAll("[data-workflow-connector=\"true\"]").length).toBeGreaterThan(0);
    const connectionPoints = document.querySelectorAll(".workflow-react-flow-handle");
    expect(connectionPoints.length).toBeGreaterThan(0);
    expect(getComputedStyle(connectionPoints[0]!).opacity).toBe("1");
    const returnSourcePolicyNode = screen.getByLabelText("Policy: on.implementation.complete.start.review").closest(".react-flow__node");
    const returnTargetPolicyNode = screen.getByLabelText("Policy: on.trigger.manual-start.start.implementation").closest(".react-flow__node");
    expect(returnSourcePolicyNode?.querySelectorAll(".react-flow__handle-right")).toHaveLength(1);
    expect(returnSourcePolicyNode?.querySelectorAll(".react-flow__handle-bottom")).toHaveLength(0);
    expect(returnSourcePolicyNode?.querySelectorAll(".react-flow__handle-top")).toHaveLength(0);
    expect(returnTargetPolicyNode?.querySelectorAll(".react-flow__handle-top")).toHaveLength(1);
    expect(returnTargetPolicyNode?.querySelectorAll(".react-flow__handle-bottom")).toHaveLength(0);
    expect(document.querySelectorAll("[data-handleid^=\"right-output-\"]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-workflow-edge-endpoint]").length).toBe(0);
    expect(document.querySelectorAll("[data-workflow-edge-tone=\"return\"]")).toHaveLength(1);
    await waitFor(() => {
      expect(workflowEdgeLabelTexts()).toEqual(expect.arrayContaining([
        "manual-start",
        "complete",
        "rejected"
      ]));
    });
    const returnEdgeLabel = workflowEdgeLabels().find((label) =>
      label.dataset.workflowEdgeLabelTone === "return" &&
      label.dataset.workflowEdgeLabelValue === "rejected"
    );
    const returnEdgeEndLabel = workflowEdgeEndLabels().find((label) =>
      label.dataset.workflowEdgeLabelTone === "return" &&
      label.dataset.workflowEdgeLabelValue === "rejected"
    );
    expect(returnEdgeLabel).toBeDefined();
    expect(returnEdgeLabel).toHaveTextContent("rejected");
    expect(returnEdgeLabel).toHaveAttribute("data-workflow-edge-label-value", "rejected");
    expect(returnEdgeEndLabel).toBeDefined();
    expect(returnEdgeEndLabel).toHaveTextContent("then");
    expect(returnEdgeEndLabel).toHaveAttribute("data-workflow-edge-label-value", "rejected");
    expect(workflowEdgeLabels().some((label) =>
      Array.from(label.classList).some((className) => className === "border" || className.startsWith("border-"))
    )).toBe(false);
  });

  it("toggles the workflow edge animation effect on click", async () => {
    const workflowData = baseData();
    workflowData.automation.policies = [{
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    }, {
      id: "on.implementation.complete.start.review",
      source: "event",
      event: "implementation.complete",
      action: "review",
      enabled: true
    }];
    workflowData.automation.workflows[0]!.steps = workflowData.automation.policies.map((policy) => policy.id);

    await renderRoute("/automation/workflows?id=workflow-1", workflowData);
    await screen.findByLabelText("Policy: on.implementation.complete.start.review");

    await waitFor(() => {
      expect(document.querySelectorAll("[data-workflow-connector=\"true\"]").length).toBeGreaterThan(0);
    });
    const edge = document.querySelector("[data-workflow-connector=\"true\"]");
    expect(edge).not.toBeNull();
    expect(edge).toHaveAttribute("data-workflow-edge-animated", "false");

    fireEvent.click(edge!);

    await waitFor(() => {
      expect(edge).toHaveAttribute("data-workflow-edge-animated", "true");
    });
    expect(edge).toHaveClass("workflow-edge-animated");

    fireEvent.click(edge!);

    await waitFor(() => {
      expect(edge).toHaveAttribute("data-workflow-edge-animated", "false");
    });
    expect(edge).not.toHaveClass("workflow-edge-animated");
  });

  it("routes legacy policies paths to workflow configuration", async () => {
    await renderRoute("/policies");

    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow ID")).toHaveValue("");
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
  });

  it("routes the removed agent runs page to workflow configuration", async () => {
    await renderRoute("/agent-runs");

    expect(screen.queryByRole("link", { name: /agent runs/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Agent runs")).not.toBeInTheDocument();
    expect(screen.queryByText("Run detail")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow ID")).toHaveValue("");
  });

  it("creates the first workflow policy from the workflow canvas", async () => {
    const user = userEvent.setup();
    const workflowData = baseData();
    workflowData.automation.policies = [];
    workflowData.automation.workflows[0]!.steps = [];
    const { data } = await renderRoute("/automation/workflows?id=workflow-1", workflowData);

    await user.click(screen.getByRole("button", { name: "Add first policy" }));
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.policies).toHaveLength(1));
    expect(data.automation.policies[0]).toMatchObject({
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      id: "on.trigger.manual-start.start.implementation"
    });
    expect(data.automation.workflows[0]?.steps).toEqual(["on.trigger.manual-start.start.implementation"]);
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
    expect(screen.queryByRole("button", { name: "Add runtime" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Runtime ID")).toHaveValue("");
    expect(screen.getByLabelText("Title")).toHaveValue("");

    await renderRoute("/automation/runtimes?id=runtime-1");
    expect(screen.queryByRole("button", { name: "Add runtime" })).not.toBeInTheDocument();
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

    const notifications = screen.getByLabelText("Notifications");
    const message = within(notifications).getByText("Injected save failure");
    expect(message.closest("ol")).toHaveAttribute("aria-label", "Notifications");

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.queryByLabelText("Notifications")).not.toBeInTheDocument();
    expect(screen.getByText("Injected save failure")).toBeInTheDocument();
  });

  it("surfaces API validation issues from failed saves", async () => {
    const user = userEvent.setup();
    await renderRoute("/agents", baseData(), {
      failNextSave: true,
      saveFailureBody: {
        error: "Invalid agent",
        issues: [{ path: "name", message: "Agent name already exists." }]
      }
    });

    await user.type(screen.getByLabelText("Name"), "Existing Agent");
    await user.type(screen.getByLabelText("Instructions"), "Try to save.");
    fireEvent.click(screen.getByRole("button", { name: "Save agent" }));
    await flushAsyncUpdates();

    expect(screen.getAllByText("Invalid agent: name: Agent name already exists.").length).toBeGreaterThan(0);
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

    const notifications = screen.getByLabelText("Notifications");
    const message = within(notifications).getByText("Injected save failure");
    const notification = message.closest("li");
    expect(notification).not.toBeNull();

    fireEvent.click(notification!);
    expect(notification).toHaveAttribute("data-pinned", "true");

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(within(notifications).getByText("Injected save failure")).toBeInTheDocument();
    fireEvent.click(within(notification!).getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByLabelText("Notifications")).not.toBeInTheDocument();
    expect(screen.getByText("Injected save failure")).toBeInTheDocument();
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
