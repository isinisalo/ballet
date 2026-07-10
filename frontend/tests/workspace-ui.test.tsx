import type { Agent, AppData, MarkdownDocument, ProjectAutomationConfig, ProjectDocumentTreeNode, Skill } from "@shared/api/workspace-contracts";
import { actionOutputEventType, actionOutputEventTypes, eventTypeFromLoopId } from "@shared/policy-actions";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceApp } from "../src/WorkspaceApp";

const now = "2026-06-26T10:00:00.000Z";
const loopId = "project-brief-gate.approved.loop";
const implementationActionId = "implementation";
const reviewActionId = "review";
const humanGateActionId = "project-brief-gate";
const manualStartLoopId = "manual-start.loop";
const actionOutputStepName = (eventType: string) => `Add action step for ${eventType}`;
const actionOutputEvent = (actionId: string, outputId: string, scopedLoopId = loopId) =>
  actionOutputEventType({ actionId, loopId: scopedLoopId }, outputId);

const testAction = ({
  id,
  humanGate = false,
  agentId = "agent-1",
  description
}: {
  id?: string;
  humanGate?: boolean;
  agentId?: string;
  description?: string;
}): ProjectAutomationConfig["actions"][number] => ({
  id: id ?? implementationActionId,
  description: description ?? `${id ?? implementationActionId} action`,
  ...(!humanGate && agentId ? { agentId } : {}),
  ...(humanGate ? { humanGate: true } : {})
});

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
    match: { eventTypes: ["implementation.rejected"], projectId: "*", source: "*" },
    action: { type: "start_agent_run", targetAgentId: "agent-1" },
    projectId: "*",
    eventTypes: ["implementation.rejected"],
    source: "*",
    payloadMetadata: {},
    targetAgentId: "agent-1",
    createdAt: now,
    updatedAt: now
  }],
  eventDefinitions: [{
    id: actionOutputEvent(implementationActionId, "approved"),
    name: actionOutputEvent(implementationActionId, "approved"),
    description: "Generated agent action output event.",
    active: true,
    eventType: actionOutputEvent(implementationActionId, "approved"),
    source: "agentd",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now
  }, {
    id: actionOutputEvent(implementationActionId, "rejected"),
    name: actionOutputEvent(implementationActionId, "rejected"),
    description: "Generated agent action output event.",
    active: true,
    eventType: actionOutputEvent(implementationActionId, "rejected"),
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
    actions: [{
      id: implementationActionId,
      description: "Implement work",
      agentId: "agent-1"
    }, {
      id: humanGateActionId,
      description: "Approve project brief",
      humanGate: true
    }],
    outputRoutes: [],
    humanGateResponses: [],
    loops: [{
      id: loopId,
      steps: [implementationActionId]
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

const loopEdgeConnectors = () => Array.from(document.querySelectorAll<HTMLElement>("[data-loop-connector=\"true\"]"));

const loopEdgeLabelTexts = () => loopEdgeConnectors()
  .map((edge) => edge.dataset.loopEdgeLabelValue)
  .filter((value): value is string => Boolean(value));

const loopEdgeDisplayLabelTexts = () => Array.from(document.querySelectorAll<HTMLElement>("[data-loop-edge-display-label]"))
  .map((label) => label.dataset.loopEdgeDisplayLabel)
  .filter((value): value is string => Boolean(value));

const activateLoopNode = (element: HTMLElement) => {
  fireEvent.pointerDown(element, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerUp(element, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.click(element);
};

const expectActionSelectValue = (actionId: string) => {
  expect(screen.getByLabelText("Handler action")).toHaveTextContent(actionId);
};

const selectOption = async (user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, optionName: string) => {
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: optionName }));
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
      data.eventDefinitions = [...new Set([
        ...saved.loops.map((loop) => eventTypeFromLoopId(loop.id)),
        ...saved.actions.flatMap((action) => actionOutputEventTypes({ actionId: action.id }, [action])),
        ...saved.outputRoutes.map((route) => actionOutputEventType({ loopId: route.sourceLoopId, actionId: route.sourceActionId }, route.outputId))
      ])].map((eventType) => ({
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

    if (url === "/api/events/intake" && method === "POST") {
      const incoming = body as Partial<AppData["events"][number]> & { projectId: string; eventType: string };
      const saved: AppData["events"][number] = {
        id: `event-${data.events.length + 1}`,
        projectId: incoming.projectId,
        source: incoming.source ?? "test",
        eventType: incoming.eventType,
        subject: incoming.subject,
        correlationId: incoming.correlationId,
        causationId: incoming.causationId,
        dedupeKey: incoming.dedupeKey,
        correlationDepth: incoming.correlationDepth,
        occurredAt: incoming.occurredAt,
        tags: incoming.tags ?? [],
        payload: incoming.payload ?? {},
        status: "received",
        createdAt: now,
        relativePath: `.ballet/events/event-${data.events.length + 1}.json`,
        frontmatter: {},
        body: typeof body.body === "string" ? body.body : ""
      };
      data.events = [...data.events, saved];
      return jsonResponse(saved, { status: 201 });
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

async function confirmDelete(user: ReturnType<typeof userEvent.setup>, entityName: string) {
  await user.click(screen.getByRole("button", { name: entityName }));
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
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
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

  it("renders compact automation loops without policy or action input fields", async () => {
    const { data } = await renderRoute(`/automation/loops?id=${loopId}`);

    expect(screen.queryByRole("tab", { name: /events/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
    const workspace = screen.getByRole("region", { name: "Loop canvas workspace" });
    const saveButton = screen.getByRole("button", { name: "Save automation" });
    const deleteButton = screen.getByRole("button", { name: "Delete loop" });
    expect(workspace).toContainElement(saveButton);
    expect(workspace).toContainElement(deleteButton);
    expect(saveButton.closest("[data-loop-canvas-actions]")).toBeInTheDocument();
    expect(workspace.closest('[data-slot="card"]')?.querySelector('[data-slot="card-header"]')).toBeNull();

    const implementationNode = screen.getByLabelText(`Action: ${implementationActionId}`);
    expect(implementationNode.querySelector("[data-loop-agent-icon]")).toBeInTheDocument();
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy event")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy agent")).not.toBeInTheDocument();

    await waitFor(() => expect(loopEdgeLabelTexts()).toContain("approved"));
    expect(loopEdgeLabelTexts()).toContain("rejected");
    await waitFor(() => expect(loopEdgeDisplayLabelTexts()).toContain(implementationActionId));
    expect(loopEdgeDisplayLabelTexts()).toContain("rejected");
    expect(screen.getAllByRole("button", { name: /add action step for/i }).length).toBeGreaterThan(0);

    activateLoopNode(implementationNode);
    const dialog = screen.getByRole("dialog", { name: "Loop handler" });
    const instructions = within(dialog).getByRole("complementary", { name: "Agent instructions" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).queryByText("Loop handler")).not.toBeInTheDocument();
    expect(within(instructions).queryByRole("heading", { name: "Agent instructions" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveClass("absolute");
    expectActionSelectValue(implementationActionId);
    expect(within(dialog).queryByText("Input")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy action")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit loop policy" })).not.toBeInTheDocument();
    expect(data.automation.actions[0]).not.toHaveProperty("key");
    expect(data.automation.actions[0]).not.toHaveProperty("event");
    expect(data.automation.actions[0]).not.toHaveProperty("loopId");
    expect(data.automation.actions[0]).not.toHaveProperty("enabled");
  });

  it("shows the selected handler agent instructions beside the editor and updates them with the action", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.agents[0]!.instructions = "## Implementation workflow\n\n- Inspect the change\n- Implement it";
    loopData.agents[0]!.model = "gpt-5.4";
    loopData.agents[0]!.modelReasoningEffort = "high";
    loopData.agents.push({
      ...loopData.agents[0]!,
      id: "agent-2",
      name: "Review Agent",
      instructions: "## Review workflow\n\nConfirm **acceptance criteria**."
    });
    loopData.automation.actions.push(testAction({
      id: reviewActionId,
      description: "Review implementation output.",
      agentId: "agent-2"
    }));
    await renderRoute(`/automation/loops?id=${loopId}`, loopData);

    activateLoopNode(screen.getByLabelText(`Action: ${implementationActionId}`));
    const dialog = screen.getByRole("dialog", { name: "Loop handler" });
    const workspace = screen.getByRole("region", { name: "Loop canvas workspace" });
    const instructions = within(dialog).getByRole("complementary", { name: "Agent instructions" });
    const editor = within(dialog).getByRole("region", { name: "Loop handler editor" });

    expect(workspace).toHaveClass("md:grid-cols-2");
    expect(dialog).toHaveClass("w-full", "md:w-auto");
    expect(instructions.parentElement).toHaveClass("sm:grid-cols-[3fr_2fr]");
    expect(instructions.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const runtimeMetadata = within(instructions).getByLabelText("Existing Agent runtime");
    expect(within(runtimeMetadata).getByText("codex-cli")).toBeInTheDocument();
    expect(within(runtimeMetadata).getByText("gpt-5.4")).toBeInTheDocument();
    expect(within(runtimeMetadata).getByText("high")).toBeInTheDocument();
    expect(runtimeMetadata.closest("header")).toHaveClass("border-b");
    expect(within(instructions).getByRole("heading", { name: "Implementation workflow" })).toBeInTheDocument();
    expect(within(instructions).getByText("Inspect the change")).toBeInTheDocument();

    await selectOption(user, within(editor).getByLabelText("Handler action"), `${reviewActionId} · Review implementation output.`);

    expect(within(instructions).getByRole("heading", { name: "Review Agent" })).toBeInTheDocument();
    expect(within(instructions).getByRole("heading", { name: "Review workflow" })).toBeInTheDocument();
    expect(within(instructions).getByText("acceptance criteria")).toBeInTheDocument();
    expect(within(instructions).queryByRole("heading", { name: "Implementation workflow" })).not.toBeInTheDocument();
  });

  it("selects compact automation entities from the sidebar and stores query ids", async () => {
    const user = userEvent.setup();
    await renderRoute("/automation");

    await user.click(screen.getByRole("link", { name: "Actions" }));
    await user.click(screen.getByRole("link", { name: implementationActionId }));
    expect(window.location.pathname).toBe("/automation/actions");
    expect(window.location.search).toBe(`?id=${implementationActionId}`);
    expect(screen.getByDisplayValue("Implement work")).toBeInTheDocument();
    expect(screen.queryByLabelText("Action key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Input event")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Loops" }));
    await user.click(screen.getByRole("link", { name: "All loops" }));
    expect(window.location.pathname).toBe("/automation/loops");
    expect(window.location.search).toBe("?view=all");
    await user.click(screen.getByRole("link", { name: loopId }));
    expect(window.location.pathname).toBe("/automation/loops");
    expect(window.location.search).toBe(`?id=${loopId}`);
    expect(screen.getByLabelText(`Action: ${implementationActionId}`)).toBeInTheDocument();
  });

  it("creates, saves, and deletes human gate actions without action key or input event", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/actions");

    expect(screen.queryByLabelText("Action key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Input event")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Action ID"), { target: { value: "human-review" } });
    await user.type(screen.getByLabelText("Description"), "Review generated evidence.");
    await user.click(screen.getByRole("switch", { name: "Human gate" }));
    expect(screen.getByText("Human operator")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions.find((action) => action.id === "human-review")).toEqual(expect.objectContaining({
      id: "human-review",
      description: "Review generated evidence.",
      humanGate: true
    })));
    const savedAction = data.automation.actions.find((action) => action.id === "human-review") as Record<string, unknown> | undefined;
    expect(savedAction).not.toHaveProperty("key");
    expect(savedAction).not.toHaveProperty("event");
    expect(savedAction).not.toHaveProperty("loopId");
    expect(savedAction).not.toHaveProperty("enabled");
    expect(window.location.search).toBe("?id=human-review");

    await confirmDelete(user, "Delete action");
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions.some((action) => action.id === "human-review")).toBe(false));
  });

  it("creates a scoped output route only after selecting the pending loop canvas handler action", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.actions = [loopData.automation.actions[0]!, testAction({
      id: reviewActionId,
      description: "Review implementation output.",
      agentId: "agent-1"
    })];
    const { data, fetchMock } = await renderRoute(`/automation/loops?id=${loopId}`, loopData);

    await user.click(screen.getByRole("button", { name: actionOutputStepName(actionOutputEvent(implementationActionId, "approved")) }));
    const dialog = screen.getByRole("dialog", { name: "Output handler" });
    const actionSelect = within(dialog).getByLabelText("Handler action");
    expect(actionSelect.querySelector("[data-placeholder]")).toBeEmptyDOMElement();
    expect(within(dialog).queryByText("Description")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Agent")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Outputs")).not.toBeInTheDocument();

    await selectOption(user, actionSelect, `${reviewActionId} · Review implementation output.`);
    expectActionSelectValue(reviewActionId);
    expect(within(dialog).getByText("Description")).toBeInTheDocument();
    expect(within(dialog).getByText("Agent")).toBeInTheDocument();
    expect(within(dialog).getByText("Outputs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions.map((action) => action.id)).toEqual([implementationActionId, reviewActionId]));
    expect(data.automation.loops[0]?.steps).toEqual([implementationActionId, reviewActionId]);
    expect(data.automation.outputRoutes).toContainEqual({
      sourceLoopId: loopId,
      sourceActionId: implementationActionId,
      outputId: "approved",
      targetLoopId: loopId,
      targetActionId: reviewActionId
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.not.stringContaining('"key"')
    }));
  });

  it("selects output action targets by loop before action", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    const triageActionId = "triage";
    const reworkActionId = "rework";
    const returnLoopId = "return.loop";
    loopData.automation.actions = [
      loopData.automation.actions[0]!,
      testAction({
        id: triageActionId,
        description: "Triage rejected output.",
        agentId: "agent-1"
      }),
      testAction({
        id: reworkActionId,
        description: "Rework implementation.",
        agentId: "agent-1"
      })
    ];
    loopData.automation.loops.push({ id: returnLoopId, steps: [triageActionId, reworkActionId] });
    const { data } = await renderRoute(`/automation/loops?id=${loopId}`, loopData);

    activateLoopNode(screen.getByLabelText(`Action: ${implementationActionId}`));
    const dialog = screen.getByRole("dialog", { name: "Loop handler" });
    expect(within(dialog).getByLabelText("Target loop for rejected")).toHaveTextContent(loopId);
    expect(within(dialog).getByLabelText("Target action for rejected")).toHaveTextContent("Action");

    await selectOption(user, within(dialog).getByLabelText("Target loop for rejected"), returnLoopId);
    expect(within(dialog).getByLabelText("Target loop for rejected")).toHaveTextContent(returnLoopId);
    expect(within(dialog).getByLabelText("Target action for rejected")).toHaveTextContent(triageActionId);

    await selectOption(user, within(dialog).getByLabelText("Target action for rejected"), `${reworkActionId} · Rework implementation.`);
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.outputRoutes).toContainEqual({
      sourceLoopId: loopId,
      sourceActionId: implementationActionId,
      outputId: "rejected",
      targetLoopId: returnLoopId,
      targetActionId: reworkActionId
    }));
  });

  it("deletes the selected loop from the automation header after confirmation", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.loops.push({ id: manualStartLoopId, steps: [humanGateActionId] });
    const { data } = await renderRoute(`/automation/loops?id=${loopId}`, loopData);

    await user.click(screen.getByRole("button", { name: "Delete loop" }));
    const confirmDialog = screen.getByRole("dialog", { name: "Delete loop?" });
    expect(within(confirmDialog).getByText(loopId)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(window.location.search).toBe(`?id=${manualStartLoopId}`));
    expect(screen.getByLabelText(`Action: ${humanGateActionId}`).querySelector("[data-loop-human-gate-icon]")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.loops.map((loop) => loop.id)).toEqual([manualStartLoopId]));
    expect(data.automation.outputRoutes).toEqual([]);
  });

  it("routes legacy policies paths to loop configuration", async () => {
    await renderRoute("/policies");

    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
  });

  it("routes the removed agent runs page to loop configuration", async () => {
    await renderRoute("/agent-runs");

    expect(screen.queryByRole("link", { name: /agent runs/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
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
      path: "automation.outputRoutes[0].targetActionId",
      message: "Automation config is invalid."
    }];

    await renderRoute("/automation", issueData);

    const issue = screen.getByText("automation.outputRoutes[0].targetActionId: Automation config is invalid.");
    expect(issue.closest("[role='alert']")).toBeInTheDocument();
    expect(issue.closest("ol")).toBeNull();
  });
});
