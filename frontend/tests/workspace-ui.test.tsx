import type { Agent, AppData, MarkdownDocument, ProjectAutomationConfig, ProjectDocumentTreeNode, Skill } from "@shared/api/workspace-contracts";
import { policyOutputEventTypes, loopIdFromTrigger } from "@shared/policy-actions";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceApp } from "../src/WorkspaceApp";

const now = "2026-06-26T10:00:00.000Z";
const loopTrigger = "project-brief-gate.approved";
const loopId = loopIdFromTrigger(loopTrigger);
const loopStartActionId = "start-loop";
const loopStartPolicyId = `on.trigger.${loopTrigger}.start.${loopStartActionId}`;

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
    id: "implementation.approved",
    name: "implementation.approved",
    description: "Generated agent action output event.",
    active: true,
    eventType: "implementation.approved",
    source: "agentd",
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: now,
    updatedAt: now
  }, {
    id: "implementation.rejected",
    name: "implementation.rejected",
    description: "Generated agent action output event.",
    active: true,
    eventType: "implementation.rejected",
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
      id: "implementation",
      description: "Implement work",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    }, {
      id: loopStartActionId,
      description: "Start loop",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    }, {
      id: "project-brief-gate",
      description: "Approve project brief",
      outputIds: ["approved", "rejected"],
      agentIds: [],
      humanGate: true
    }],
    outputs: [
      { id: "approved" },
      { id: "rejected" },
      { id: "summary" },
      { id: "approved" },
      { id: "rejected" }
    ],
    outputRoutes: [],
    humanGateResponses: [],
    policies: [{
      id: loopStartPolicyId,
      source: "trigger",
      trigger: loopTrigger,
      action: loopStartActionId,
      enabled: true
    }, {
      id: "on.implementation.rejected.start.implementation",
      source: "event",
      event: "implementation.rejected",
      action: "implementation",
      enabled: true
    }],
    loops: [{
      id: loopId,
      steps: [loopStartPolicyId, "on.implementation.rejected.start.implementation"]
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

const loopEdgeLabels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-loop-edge-label=\"true\"]"));
const loopEdgeStartLabels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-loop-edge-start-label=\"true\"]"));
const loopEdgeEndLabels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-loop-edge-end-label=\"true\"]"));

const loopEdgeLabelTexts = () => loopEdgeLabels()
  .map((label) => label.dataset.loopEdgeLabelValue ?? label.textContent);

const badgeWithTextClass = (text: string, className: string) =>
  screen.queryAllByText(text).find((element) =>
    element.closest("[data-slot=\"badge\"]")?.className.includes(className)
  );

const controlWithTextClass = (container: HTMLElement, text: string, className: string) =>
  within(container).queryAllByText(text).find((element) =>
    element.closest("button")?.className.includes(className)
  );

const activateLoopNode = (element: HTMLElement) => {
  fireEvent.pointerDown(element, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerUp(element, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.click(element);
};

const expectActionSelectValue = (actionId: string) => {
  expect(screen.getByLabelText("Handler action")).toHaveTextContent(actionId);
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

  it("defaults automation to loops and locks policy input fields on the canvas", async () => {
    const { data } = await renderRoute("/automation/loops?id=project-brief-gate.approved.loop");

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
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete loop" })).toBeInTheDocument();

    const triggerReactFlowNode = screen.getByLabelText(`Trigger: ${loopTrigger}`).closest(".react-flow__node");
    expect(triggerReactFlowNode?.querySelectorAll(".react-flow__handle").length).toBeGreaterThan(0);
    expect(within(triggerReactFlowNode as HTMLElement).queryByText(loopTrigger)).not.toBeInTheDocument();

    expect(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Agent: existing")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Events: implementation.approved")).not.toBeInTheDocument();
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
    expect(screen.queryByText("type:")).not.toBeInTheDocument();
    const implementationPolicyNode = screen.getByLabelText("Policy: on.implementation.rejected.start.implementation");
    expect(implementationPolicyNode.parentElement).toHaveClass("w-full");
    expect(within(implementationPolicyNode).queryByText("on")).not.toBeInTheDocument();
    expect(within(implementationPolicyNode).queryByText("then:")).not.toBeInTheDocument();
    expect(implementationPolicyNode.querySelector("svg")).not.toBeInTheDocument();
    expect(screen.queryByText("start:")).not.toBeInTheDocument();
    expect(screen.getAllByText("implementation").length).toBeGreaterThan(0);
    expect(within(implementationPolicyNode).getByText("implementation")).toHaveAttribute("title", "Implement work");
    await waitFor(() => expect(loopEdgeLabelTexts()).toContain("rejected"));
    const implementationFailedEdgeLabel = loopEdgeLabels().find((label) =>
      label.dataset.loopEdgeLabelValue === "rejected" &&
      label.dataset.loopEdgeTargetKind === "policy"
    );
    expect(implementationFailedEdgeLabel).toBeDefined();
    expect(implementationFailedEdgeLabel).toHaveTextContent("rejected");
    expect(implementationFailedEdgeLabel).toHaveAttribute("data-loop-edge-label-value", "rejected");
    expect(implementationFailedEdgeLabel).not.toHaveTextContent("implementation.rejected");
    expect(implementationFailedEdgeLabel?.children[0]).toHaveTextContent("rejected");
    expect(implementationFailedEdgeLabel?.children[0]).toHaveClass("text-destructive");
    expect(loopEdgeStartLabels()).toHaveLength(0);
    expect(loopEdgeEndLabels()).toHaveLength(0);
    expect((await screen.findAllByText("approved")).length).toBeGreaterThan(0);
    expect(screen.queryByText("implementation.blocked")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add policy step for/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Output events")).not.toBeInTheDocument();

    activateLoopNode(implementationPolicyNode);
    expect(screen.queryByLabelText("Loop policy source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy event")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy trigger")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy agent")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    expect(screen.queryByLabelText("Loop policy action")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit loop policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save loop policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove loop step" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation")).toBeInTheDocument();

    activateLoopNode(implementationPolicyNode);
    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Loop handler" })).not.toBeInTheDocument());

    await waitFor(() => expect(data.automation).not.toHaveProperty("events"));
    expect(data.automation.policies.find((policy) => policy.id === "on.implementation.rejected.start.implementation")).toMatchObject({
      source: "event",
      event: "implementation.rejected",
      id: "on.implementation.rejected.start.implementation"
    });
  });

  it("renders surrounding loops as compact nodes around the selected loop", async () => {
    const loopData = baseData();
    loopData.automation.actions[0] = {
      id: "implementation",
      description: "Review generated evidence.",
      outputIds: ["approved", "rejected"],
      agentIds: [],
      humanGate: true
    };
    loopData.automation.actions.push({
      id: "next-step",
      description: "Continue the next loop.",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    });
    loopData.automation.policies.push({
      id: "on.trigger.manual-start.start.project-brief-gate",
      source: "trigger",
      trigger: "manual-start",
      action: "project-brief-gate",
      enabled: true
    }, {
      id: "on.trigger.implementation.approved.start.next-step",
      source: "trigger",
      trigger: "implementation.approved",
      action: "next-step",
      enabled: true
    });
    loopData.automation.loops.push({
      id: "manual-start.loop",
      steps: ["on.trigger.manual-start.start.project-brief-gate"]
    }, {
      id: "implementation.approved.loop",
      steps: ["on.trigger.implementation.approved.start.next-step"]
    });

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    expect(screen.getByLabelText("Loop: manual-start.loop")).toHaveTextContent("manual-start.loop");
    expect(screen.getByLabelText("Loop: implementation.approved.loop")).toHaveTextContent("implementation.approved.loop");
    expect(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Policy: on.trigger.manual-start.start.project-brief-gate")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Policy: on.trigger.implementation.approved.start.next-step")).not.toBeInTheDocument();
    await waitFor(() => expect(loopEdgeLabelTexts()).toContain("approved"));
  });

  it("folds repeated loop actions into one visible policy node", async () => {
    const loopData = baseData();
    loopData.automation.outputs = [
      { id: "approved" },
      { id: "rejected" },
      { id: "approved" },
      { id: "rejected" }
    ];
    loopData.automation.actions = [{
      id: "create-roadmap",
      description: "Create traceable delivery roadmap.",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    }, {
      id: "challenge-roadmap",
      description: "Challenge roadmap.",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    }, {
      id: "done",
      description: "Stop.",
      outputIds: [],
      agentIds: []
    }];
    loopData.automation.policies = [{
      id: "p05.on.project-brief-gate-approved.create-roadmap",
      source: "trigger",
      trigger: "project-brief-gate.approved",
      action: "create-roadmap",
      enabled: true
    }, {
      id: "p06.on.roadmap-approved.challenge-roadmap",
      source: "event",
      event: "create-roadmap.approved",
      action: "challenge-roadmap",
      enabled: true
    }, {
      id: "p07.on.roadmap-rework.create-roadmap",
      source: "event",
      event: "challenge-roadmap.rejected",
      action: "create-roadmap",
      enabled: true
    }, {
      id: "p08.on.roadmap-approved.done",
      source: "event",
      event: "challenge-roadmap.approved",
      action: "done",
      enabled: true
    }];
    loopData.automation.loops = [{
      id: loopId,
      title: "Roadmap loop",
      steps: loopData.automation.policies.map((policy) => policy.id)
    }];

    await renderRoute(`/automation/loops?id=${loopId}`, loopData);

    const createRoadmapNode = await screen.findByLabelText("Policy: p05.on.project-brief-gate-approved.create-roadmap");
    expect(createRoadmapNode).toBeInTheDocument();
    expect(screen.queryByLabelText("Policy: p07.on.roadmap-rework.create-roadmap")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: p06.on.roadmap-approved.challenge-roadmap")).toBeInTheDocument();
    expect(screen.getByLabelText("Policy: p08.on.roadmap-approved.done")).toBeInTheDocument();
    expect(within(createRoadmapNode).getByText("x2")).toBeInTheDocument();

    await waitFor(() => expect(loopEdgeLabelTexts()).toContain("rejected"));
    const returnEdgeLabel = loopEdgeLabels().find((label) =>
      label.dataset.loopEdgeLabelTone === "return" &&
      label.dataset.loopEdgeLabelValue === "rejected"
    );
    expect(returnEdgeLabel).toBeDefined();
    expect(returnEdgeLabel).toHaveTextContent("rejected");

    fireEvent.click(returnEdgeLabel!);
    expect(screen.queryByRole("dialog", { name: "Output handler" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Loop handler" })).not.toBeInTheDocument();

    activateLoopNode(createRoadmapNode);
    const loopHandlerDialog = screen.getByRole("dialog", { name: "Loop handler" });
    expect(within(loopHandlerDialog).getAllByText("project-brief-gate.approved").length).toBeGreaterThan(0);
    expect(within(loopHandlerDialog).getAllByText("challenge-roadmap").find((element) => element.className.includes("text-tertiary"))).toBeDefined();
    expect(within(loopHandlerDialog).getAllByText("rejected").find((element) => element.className.includes("text-destructive"))).toBeDefined();
    expect(within(loopHandlerDialog).getAllByLabelText("Handler action")).toHaveLength(2);
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
    expect(badgeWithTextClass("implementation.rejected", "border-primary/60")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Triggers" })).not.toBeInTheDocument();

    let loopsToggle = screen.getByRole("link", { name: "Loops" });
    expect(loopsToggle).toHaveAttribute("aria-expanded", "true");
    await user.click(loopsToggle);
    loopsToggle = screen.getByRole("link", { name: "Loops" });
    expect(loopsToggle).toHaveAttribute("aria-expanded", "true");
    await user.click(loopsToggle);
    loopsToggle = screen.getByRole("link", { name: "Loops" });
    expect(loopsToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "project-brief-gate.approved.loop" })).not.toBeInTheDocument();
    await user.click(loopsToggle);
    await user.click(screen.getByRole("link", { name: "All loops" }));
    expect(window.location.pathname).toBe("/automation/loops");
    expect(window.location.search).toBe("?view=all");
    await user.click(screen.getByRole("link", { name: "project-brief-gate.approved.loop" }));
    expect(window.location.pathname).toBe("/automation/loops");
    expect(window.location.search).toBe("?id=project-brief-gate.approved.loop");
    expect(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation")).toBeInTheDocument();
  });

  it("renders automation when loaded data is missing newer outputs field", async () => {
    const legacyData = baseData();
    delete (legacyData.automation as Partial<ProjectAutomationConfig>).outputs;
    delete (legacyData.automation as Partial<ProjectAutomationConfig>).outputRoutes;
    delete (legacyData.automation as Partial<ProjectAutomationConfig>).humanGateResponses;

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", legacyData);

    expect(screen.getByRole("link", { name: "Actions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Outputs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gates" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation")).toBeInTheDocument();
  });

  it("shows the selected loop id in the automation header without editing", async () => {
    const loopData = baseData();
    loopData.automation.policies.push({
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    });
    loopData.automation.loops.push({
      id: "manual-start.loop",
      steps: ["on.trigger.manual-start.start.implementation"]
    });
    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    expect(screen.queryByLabelText("Loop ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "project-brief-gate.approved.loop" })).not.toBeInTheDocument();
    expect(screen.getAllByText("project-brief-gate.approved.loop").length).toBeGreaterThan(0);
  });

  it("creates a loop from a selected starting trigger", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.policies.push({
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    });
    const { data, fetchMock } = await renderRoute("/automation/loops", loopData);

    expect(screen.queryByRole("button", { name: "Add loop" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Starting trigger")).toHaveTextContent("manual-start");
    expect(screen.getAllByText("manual-start.loop").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.loops.some((loop) =>
      loop.id === "manual-start.loop" &&
      loop.steps[0] === "on.trigger.manual-start.start.implementation"
    )).toBe(true));
    expect(window.location.pathname).toBe("/automation/loops");
    expect(window.location.search).toBe("?id=manual-start.loop");
    expect(screen.getAllByText("manual-start.loop").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("\"id\":\"manual-start.loop\"")
    }));
  });

  it("deletes the selected loop from the automation header after confirmation", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.policies.push({
      id: "on.trigger.manual-start.start.implementation",
      source: "trigger",
      trigger: "manual-start",
      action: "implementation",
      enabled: true
    });
    loopData.automation.loops.push({
      id: "manual-start.loop",
      steps: ["on.trigger.manual-start.start.implementation"]
    });
    const { data } = await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    await user.click(screen.getByRole("button", { name: "Delete loop" }));

    const confirmDialog = screen.getByRole("dialog", { name: "Delete loop?" });
    expect(confirmDialog).toBeInTheDocument();
    expect(within(confirmDialog).getByText("project-brief-gate.approved.loop")).toBeInTheDocument();
    expect(within(confirmDialog).getByText(/This action cannot be undone./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(window.location.search).toBe("?id=manual-start.loop"));
    expect(window.location.pathname).toBe("/automation/loops");
    expect(screen.getAllByText("manual-start.loop").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.loops.map((loop) => loop.id)).toEqual(["manual-start.loop"]));
    expect(screen.queryByRole("link", { name: "project-brief-gate.approved.loop" })).not.toBeInTheDocument();
  });

  it("clears loop selection after deleting the only loop", async () => {
    const user = userEvent.setup();
    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop");

    await confirmDelete(user, "Delete loop");

    await waitFor(() => expect(window.location.search).toBe(""));
    expect(window.location.pathname).toBe("/automation/loops");
    expect(screen.queryByRole("button", { name: "Delete loop" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop ID")).not.toBeInTheDocument();
  });

  it("renders the selected loop action sheet in view mode", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.actions.push({
      id: "review-pass",
      description: "Review output",
      outputIds: ["summary", "rejected"],
      agentIds: ["agent-1"]
    });
    const { data, fetchMock } = await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    expect(screen.getByRole("button", { name: "Delete loop" })).toBeInTheDocument();
    const implementationPolicyNode = screen.getByLabelText("Policy: on.implementation.rejected.start.implementation");
    expect(screen.queryByLabelText("Loop policy agent")).not.toBeInTheDocument();
    activateLoopNode(implementationPolicyNode);
    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit loop policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save loop policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove loop step" })).not.toBeInTheDocument();

    expectActionSelectValue("implementation");
    expect(screen.getByLabelText("Handler action")).toHaveAttribute("role", "combobox");
    expect(screen.getByLabelText("Description")).toHaveValue("Implement work");
    expect(screen.getByLabelText("Description")).toHaveProperty("readOnly", true);
    expect(screen.queryByRole("button", { name: "Remove agent Existing Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove output approved" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Loop handler" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.policies.find((policy) =>
      policy.id === "on.implementation.rejected.start.implementation"
    )).toMatchObject({
      action: "implementation",
      event: "implementation.rejected",
      id: "on.implementation.rejected.start.implementation"
    }));
    expect(data.automation.loops[0]?.steps).toEqual([
      loopStartPolicyId,
      "on.implementation.rejected.start.implementation"
    ]);
    expect(data.automation.actions.find((action) => action.id === "implementation")).toMatchObject({
      id: "implementation",
      description: "Implement work"
    });
    expect(data.automation.actions.find((action) => action.id === "review-pass")).toMatchObject({
      id: "review-pass",
      description: "Review output"
    });
    expect(screen.queryByLabelText("Loop policy agent")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save loop policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit loop policy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove loop step" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining(`"steps":["${loopStartPolicyId}","on.implementation.rejected.start.implementation"]`)
    }));
  });

  it("removes the selected action node from the loop sheet without deleting global config", async () => {
    const user = userEvent.setup();
    const { data, fetchMock } = await renderRoute("/automation/loops?id=project-brief-gate.approved.loop");
    const policyId = "on.implementation.rejected.start.implementation";

    activateLoopNode(screen.getByLabelText(`Policy: ${policyId}`));
    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove from loop" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Loop handler" })).not.toBeInTheDocument());
    expect(screen.queryByLabelText(`Policy: ${policyId}`)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.loops[0]?.steps).toEqual([loopStartPolicyId]));
    expect(data.automation.policies).toContainEqual(expect.objectContaining({ id: policyId }));
    expect(data.automation.actions).toContainEqual(expect.objectContaining({ id: "implementation" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/automation", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining(`"steps":["${loopStartPolicyId}"]`)
    }));
  });

  it("switches loop action sheet content, ignores canvas clicks, and closes with Escape", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.agents.push({
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
    loopData.automation.actions.push({
      id: "review-pass",
      description: "Review output",
      outputIds: ["summary", "rejected"],
      agentIds: ["agent-2"]
    });
    loopData.automation.policies.push({
      id: "on.implementation.approved.start.review-pass",
      source: "event",
      event: "implementation.approved",
      action: "review-pass",
      enabled: true
    });
    loopData.automation.loops[0]!.steps = [
      "on.implementation.rejected.start.implementation",
      "on.implementation.approved.start.review-pass"
    ];
    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    activateLoopNode(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation"));
    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();
    expectActionSelectValue("implementation");

    activateLoopNode(screen.getByLabelText("Policy: on.implementation.approved.start.review-pass"));
    expectActionSelectValue("review-pass");

    const loopPane = document.querySelector(".react-flow__pane");
    expect(loopPane).toBeInTheDocument();
    fireEvent.click(loopPane as Element);
    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();
    expectActionSelectValue("review-pass");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Loop handler" })).not.toBeInTheDocument());
  });

  it("opens the loop action sheet from node click activation", async () => {
    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop");

    const implementationPolicyNode = screen.getByLabelText("Policy: on.implementation.rejected.start.implementation");
    activateLoopNode(implementationPolicyNode);

    const dialog = screen.getByRole("dialog", { name: "Loop handler" });
    expect(dialog).toBeInTheDocument();
    expectActionSelectValue("implementation");
    expect(within(dialog).getByLabelText("Handler action")).toHaveClass("border-primary/60", "bg-primary/10", "text-primary");
    expect(within(dialog).getByLabelText("Handler action")).not.toHaveTextContent("Implement work");
    expect(within(dialog).getByLabelText("Handler action").querySelector("[data-slot=\"select-value\"]")).toHaveClass(
      "text-tertiary",
      "decoration-tertiary",
      "underline",
      "underline-offset-4",
      "decoration-2"
    );
    expect(within(dialog).getByText("Input")).toBeInTheDocument();
    expect(badgeWithTextClass("implementation.rejected", "border-primary/60")).toBeUndefined();
    const inputRoute = within(dialog).getByTitle("implementation.rejected");
    expect(inputRoute).toBeInTheDocument();
    expect(within(inputRoute).getByText("implementation")).toHaveClass("text-tertiary", "decoration-tertiary", "underline");
    expect(within(inputRoute).getByText("rejected")).toHaveClass("text-destructive", "decoration-destructive", "underline");
  });

  it("renders loop output handler actions instead of output event targets", async () => {
    const loopData = baseData();
    loopData.automation.actions[0] = {
      id: "implementation",
      description: "Implement work",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    };
    loopData.automation.actions.push({
      id: "review-pass",
      description: "Review output.",
      outputIds: ["summary"],
      agentIds: ["agent-1"]
    });
    loopData.automation.policies.push({
      id: "on.implementation.approved.start.review-pass",
      source: "event",
      event: "implementation.approved",
      action: "review-pass",
      enabled: true
    }, {
      id: "on.implementation.rejected.start.review-pass",
      source: "event",
      event: "implementation.rejected",
      action: "review-pass",
      enabled: true
    });
    loopData.automation.loops[0]!.steps = [
      "on.implementation.rejected.start.implementation",
      "on.implementation.approved.start.review-pass",
      "on.implementation.rejected.start.review-pass"
    ];
    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    activateLoopNode(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation"));
    const dialog = screen.getByRole("dialog", { name: "Loop handler" });

    expect(within(dialog).getByText("Outputs")).toBeInTheDocument();
    expect(within(dialog).queryByText("Output targets")).not.toBeInTheDocument();
    const reviewPassControl = controlWithTextClass(dialog, "review-pass", "border-primary/60");
    expect(reviewPassControl).toBeDefined();
    expect(reviewPassControl!.closest("button")?.querySelector("[data-slot=\"select-value\"]")).toHaveClass(
      "text-tertiary",
      "decoration-tertiary",
      "underline"
    );
    expect(within(dialog).queryByText("implementation.approved")).not.toBeInTheDocument();
    const approvedLabel = within(dialog).getByText("approved");
    expect(approvedLabel).toHaveClass("text-secondary", "decoration-secondary", "underline");
    expect(approvedLabel.closest("[data-slot=\"badge\"]")).toBeNull();
    expect(approvedLabel.closest("button")).toBeNull();
    const rejectedLabel = within(dialog).getAllByText("rejected").find((element) =>
      element.className.includes("text-destructive")
    );
    expect(rejectedLabel).toHaveClass("text-destructive", "decoration-destructive", "underline");
    expect(rejectedLabel?.closest("[data-slot=\"badge\"]")).toBeNull();
    expect(rejectedLabel?.closest("button")).toBeNull();
  });

  it("renders missing loop output handlers as None", async () => {
    const loopData = baseData();
    loopData.automation.actions[0] = {
      id: "implementation",
      description: "Review generated evidence.",
      outputIds: ["approved", "rejected"],
      agentIds: [],
      humanGate: true
    };

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    activateLoopNode(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation"));
    const dialog = screen.getByRole("dialog", { name: "Loop handler" });

    expect(within(dialog).queryByText("Output targets")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Output routing")).toBeInTheDocument();
    const approvalTarget = within(dialog).getByText("implementation.approved");
    expect(approvalTarget).toHaveClass("border-tertiary/60", "bg-tertiary/10", "text-tertiary");
    expect(approvalTarget.closest("button")).toBeNull();
    expect(within(dialog).getAllByText("None").length).toBe(1);
  });

  it("creates an automation action and keeps loop action editing sheet-based", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/actions");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Actions" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Implement work")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add action" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Action ID"), "review-pass");
    await user.type(screen.getByLabelText("Description"), "Review output");
    expect(screen.getByDisplayValue("Review output")).toBeInTheDocument();
    expect(screen.getByText("Approved output")).toBeInTheDocument();
    expect(screen.getByText("Rejected output")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search or create output")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions.some((action) =>
      action.id === "review-pass" &&
      action.description === "Review output" &&
      action.outputIds.join(",") === "approved,rejected" &&
      action.agentIds.join(",") === "agent-1"
    )).toBe(true));
    expect(data.automation.outputs).toEqual(expect.arrayContaining([{ id: "approved" }, { id: "rejected" }]));

    await user.click(screen.getByRole("link", { name: "Loops" }));
    await user.click(screen.getByRole("link", { name: "project-brief-gate.approved.loop" }));
    activateLoopNode(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation"));
    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    expect(screen.queryByLabelText("Loop policy action")).not.toBeInTheDocument();
    const implementationPolicy = data.automation.policies.find((policy) =>
      policy.id === "on.implementation.rejected.start.implementation"
    );
    expect(implementationPolicy?.action).toBe("implementation");
    expect(implementationPolicy?.id).toBe("on.implementation.rejected.start.implementation");
    expect(data.automation.policies).toHaveLength(2);
  });

  it("allows saving an agentless action without outputs", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "trigger.manual-start",
      action: "implementation",
      enabled: true
    };
    loopData.automation.loops[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    const { data } = await renderRoute("/automation/actions?id=implementation", loopData);

    expect(badgeWithTextClass("trigger.manual-start", "border-primary/60")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Remove agent Existing Agent" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove output approved" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove output rejected" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add output" })).not.toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions[0]).toMatchObject({
      id: "implementation",
      outputIds: [],
      agentIds: []
    }));
    expect(data.eventDefinitions.map((event) => event.eventType)).not.toContain("implementation.approved");
    expect(data.eventDefinitions.map((event) => event.eventType)).not.toContain("implementation.rejected");
  });

  it("selects an agentless loop action without rendering output events", async () => {
    const loopData = baseData();
    loopData.automation.actions.push({
      id: "manual-gate",
      description: "Manual loop stop",
      outputIds: [],
      agentIds: []
    });
    loopData.automation.policies[0] = {
      id: "on.implementation.rejected.start.manual-gate",
      source: "event",
      event: "implementation.rejected",
      action: "manual-gate",
      enabled: true
    };
    loopData.automation.loops[0]!.steps = ["on.implementation.rejected.start.manual-gate"];
    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    activateLoopNode(screen.getByLabelText("Policy: on.implementation.rejected.start.manual-gate"));

    expect(screen.getByRole("dialog", { name: "Loop handler" })).toBeInTheDocument();
    expectActionSelectValue("manual-gate");
    expect(screen.queryByRole("button", { name: /Add policy step for manual-gate\./ })).not.toBeInTheDocument();
    expect(document.querySelector('[data-loop-output-event^="manual-gate."]')).not.toBeInTheDocument();
  });

  it("renders canonical action output slots without arbitrary output creation", async () => {
    const user = userEvent.setup();
    const selectorData = baseData();
    selectorData.automation.outputs = [{ id: "approved" }, { id: "rejected" }];
    selectorData.automation.actions[0]!.outputIds = ["approved"];
    const { data } = await renderRoute("/automation/actions?id=implementation", selectorData);

    expect(screen.getByText("Approved output")).toBeInTheDocument();
    expect(screen.getByText("Rejected output")).toBeInTheDocument();
    expect(badgeWithTextClass("implementation.approved", "border-primary/60")).toBeDefined();
    expect(screen.queryByLabelText("Search or create output")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add rejected output" }));
    expect(screen.getByRole("button", { name: "Remove output rejected" })).toBeInTheDocument();
    expect(badgeWithTextClass("implementation.rejected", "border-primary/60")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions[0]?.outputIds).toEqual(["approved", "rejected"]));
    expect(data.automation.outputs.filter((output) => output.id === "approved")).toHaveLength(1);
  });

  it("renders action output badges by event and trigger target type", async () => {
    const loopData = baseData();
    loopData.automation.actions[0] = {
      id: "implementation",
      description: "Review generated evidence.",
      outputIds: ["approved", "rejected"],
      agentIds: [],
      humanGate: true
    };

    await renderRoute("/automation/actions?id=implementation", loopData);

    expect(badgeWithTextClass("implementation.approved", "border-tertiary/60")).toBeDefined();
    expect(badgeWithTextClass("implementation.rejected", "border-primary/60")).toBeDefined();
  });

  it("allows removing the optional rework output from an agent action", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "implementation.approved",
      action: "implementation",
      enabled: true
    };
    loopData.automation.loops[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    const { data } = await renderRoute("/automation/actions?id=implementation", loopData);

    expect(screen.queryByRole("button", { name: "Remove output approved" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove output rejected" }));
    expect(screen.queryByRole("button", { name: "Remove output rejected" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add rejected output" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions[0]?.outputIds).toEqual(["approved"]));
    expect(data.eventDefinitions.map((event) => event.eventType)).toContain("implementation.approved");
    expect(data.eventDefinitions.map((event) => event.eventType)).not.toContain("implementation.rejected");
  });

  it("renders every action output as a loop event endpoint", async () => {
    const loopData = baseData();
    loopData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "trigger.manual-start",
      action: "implementation",
      enabled: true
    };
    loopData.automation.loops[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    loopData.automation.actions[0]!.outputIds = ["approved", "rejected"];

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    const approvedOutputEvent = screen.getByRole("button", { name: "Add policy step for implementation.approved" });
    const rejectedOutputEvent = screen.getByRole("button", { name: "Add policy step for implementation.rejected" });

    expect(approvedOutputEvent).toBeInTheDocument();
    expect(approvedOutputEvent).toHaveTextContent("+ Action");
    expect(approvedOutputEvent).not.toHaveTextContent("implementation.approved");
    await waitFor(() => expect(loopEdgeLabelTexts().length).toBeGreaterThan(0));
    expect(loopEdgeEndLabels()).toHaveLength(0);
    const implementationRejectedGhostEdgeLabel = loopEdgeLabels().find((label) =>
      label.dataset.loopEdgeLabelValue === "rejected" &&
      label.dataset.loopEdgeTargetKind === "output-event"
    );
    if (implementationRejectedGhostEdgeLabel) expect(implementationRejectedGhostEdgeLabel.children[0]).toHaveClass("text-primary/55");
    expect(approvedOutputEvent.querySelector("svg")).not.toBeInTheDocument();
    expect(rejectedOutputEvent).toBeInTheDocument();
    expect(rejectedOutputEvent).not.toHaveTextContent("implementation.rejected");
    expect(rejectedOutputEvent.querySelector("svg")).not.toBeInTheDocument();
    await waitFor(() => expect(loopEdgeLabelTexts()).toEqual(expect.arrayContaining(["approved", "rejected"])));
  });

  it("renders human gate actions and records prompt responses", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.actions[0] = {
      id: "implementation",
      description: "Review generated evidence.",
      outputIds: ["approved", "rejected"],
      agentIds: [],
      humanGate: true
    };
    const { data } = await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    const policyNode = screen.getByLabelText("Policy: on.implementation.rejected.start.implementation");
    expect(policyNode).toHaveTextContent("implementation");
    expect(policyNode).not.toHaveTextContent("Human Gate");
    expect(policyNode).toHaveClass("border-tertiary/60");
    activateLoopNode(policyNode);
    const dialog = screen.getByRole("dialog", { name: "Loop handler" });
    expect(within(dialog).queryByLabelText("Action ID")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Human gate" })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Handler action")).toHaveTextContent("implementation");
    expect(within(dialog).getByLabelText("Handler action")).toHaveClass("border-primary/60", "bg-primary/10", "text-primary");
    expect(within(dialog).getByLabelText("Description")).toHaveValue("Review generated evidence.");
    expect(within(dialog).getByText("Human operator")).toBeInTheDocument();
    expect(within(dialog).getByText("Output routing")).toBeInTheDocument();
    const approvalTarget = within(dialog).getByText("implementation.approved");
    expect(approvalTarget).toHaveClass("border-tertiary/60", "bg-tertiary/10", "text-tertiary");
    expect(approvalTarget.closest("button")).toBeNull();
    expect(within(dialog).getAllByText("rejected").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("None")).toBeInTheDocument();
    expect(within(dialog).getByText("Waiting for human")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Approved · approved" }));
    expect(within(dialog).getByText("Prompt to agent is required before continuing.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Prompt to agent"), "Approved with trace evidence.");
    await user.click(within(dialog).getByRole("button", { name: "Approved · approved" }));

    await waitFor(() => expect(data.automation.humanGateResponses).toContainEqual(expect.objectContaining({
      policyId: "on.implementation.rejected.start.implementation",
      actionId: "implementation",
      outputId: "approved",
      loopId: "project-brief-gate.approved.loop",
      prompt: "Approved with trace evidence."
    })));
    await waitFor(() => expect(data.events).toContainEqual(expect.objectContaining({
      eventType: "trigger.implementation.approved",
      source: "human-gate",
      payload: expect.objectContaining({
        loop_id: "project-brief-gate.approved.loop",
        policy_id: "on.implementation.rejected.start.implementation",
        action: "implementation",
        output_id: "approved",
        prompt: "Approved with trace evidence."
      })
    })));
  });

  it("renders only the approval endpoint for one-output loop actions", async () => {
    const loopData = baseData();
    loopData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "trigger.manual-start",
      action: "implementation",
      enabled: true
    };
    loopData.automation.loops[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    loopData.automation.actions[0]!.outputIds = ["approved"];

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    expect(screen.getByRole("button", { name: "Add policy step for implementation.approved" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add policy step for implementation.rejected" })).not.toBeInTheDocument();
    await waitFor(() => expect(loopEdgeLabelTexts()).toContain("approved"));
    expect(loopEdgeLabelTexts()).not.toContain("rejected");
  });

  it("creates rejected loop handlers with the selected action", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.policies[0] = {
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "trigger.manual-start",
      action: "implementation",
      enabled: true
    };
    loopData.automation.loops[0]!.steps = ["on.trigger.manual-start.start.implementation"];
    loopData.automation.actions[0]!.outputIds = ["approved", "rejected"];
    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    await user.click(screen.getByRole("button", { name: "Add policy step for implementation.rejected" }));
    expect(screen.getByRole("dialog", { name: "Output handler" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
  });

  it("renames an automation action and rewrites derived policy events", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.automation.actions.push({
      id: "review",
      description: "Review implementation output.",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    });
    loopData.automation.policies.push({
      id: "on.implementation.approved.start.review",
      source: "event",
      event: "implementation.approved",
      action: "review",
      enabled: true
    });
    loopData.automation.loops[0]!.steps = [
      loopStartPolicyId,
      "on.implementation.rejected.start.implementation",
      "on.implementation.approved.start.review"
    ];
    const { data } = await renderRoute("/automation/actions?id=implementation", loopData);

    fireEvent.change(screen.getByLabelText("Action ID"), { target: { value: "implement" } });
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions[0]?.id).toBe("implement"));
    expect(screen.queryByText("Automation config is invalid.")).not.toBeInTheDocument();
    expect(data.automation.policies.find((policy) => policy.id === "on.implement.rejected.start.implement")).toMatchObject({
      id: "on.implement.rejected.start.implement",
      event: "implement.rejected",
      action: "implement"
    });
    expect(data.automation.policies.find((policy) => policy.id === "on.implement.approved.start.review")).toMatchObject({
      id: "on.implement.approved.start.review",
      event: "implement.approved",
      action: "review"
    });
    expect(data.automation.loops[0]?.steps).toEqual([
      loopStartPolicyId,
      "on.implement.rejected.start.implement",
      "on.implement.approved.start.review"
    ]);
  });

  it("treats the removed automation triggers route as a loops alias", async () => {
    await renderRoute("/automation/triggers");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Triggers" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
  });

  it("creates, toggles, deletes, and saves human gate actions", async () => {
    const user = userEvent.setup();
    const { data } = await renderRoute("/automation/actions");

    expect(screen.getByRole("link", { name: "Actions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gates" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Action ID"), "human-review");
    await user.type(screen.getByLabelText("Description"), "Review generated evidence.");
    await user.click(screen.getByRole("switch", { name: "Human gate" }));
    expect(screen.getByText("Human operator")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove agent Existing Agent" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.actions).toContainEqual(expect.objectContaining({
      id: "human-review",
      description: "Review generated evidence.",
      outputIds: ["approved", "rejected"],
      agentIds: [],
      humanGate: true
    })));
    expect(data.automation.outputs).toEqual(expect.arrayContaining([{ id: "approved" }, { id: "rejected" }]));
    expect(window.location.pathname).toBe("/automation/actions");
    expect(window.location.search).toBe("?id=human-review");

    await confirmDelete(user, "Delete action");
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.actions.some((action) => action.id === "human-review")).toBe(false));
  });

  it("creates a policy from a ghost event and opens its action sheet", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    loopData.agents.push({
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
    loopData.automation.actions.push({
      id: "review-pass",
      description: "Review output",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-2"]
    });
    const { data } = await renderRoute("/automation/policies?id=project-brief-gate.approved.loop", loopData);

    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Add policy step for implementation.approved" }));
    const foldedImplementationNode = screen.getByLabelText("Policy: on.implementation.rejected.start.implementation");
    expect(foldedImplementationNode).toBeInTheDocument();
    expect(screen.queryByLabelText("Policy: on.implementation.approved.start.implementation")).not.toBeInTheDocument();
    expect(within(foldedImplementationNode).getByText("x2")).toBeInTheDocument();

    expect(screen.queryByLabelText("Loop policy source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy event")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loop policy trigger")).not.toBeInTheDocument();
    await waitFor(() => expect(loopEdgeLabelTexts()).toContain("approved"));
    expect(screen.queryByLabelText("Loop policy agent")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Output handler" })).toBeInTheDocument();
    expectActionSelectValue("implementation");
    expect(screen.queryByLabelText("Loop policy action")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Policy: on.implementation.rejected.start.implementation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Output handler" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Save automation" }));
    await waitFor(() => expect(data.automation.policies).toContainEqual(expect.objectContaining({
      source: "event",
      event: "implementation.approved",
      action: "implementation",
      id: "on.implementation.approved.start.implementation"
    })));
    expect(data.automation.loops[0]?.steps).toEqual([
      loopStartPolicyId,
      "on.implementation.rejected.start.implementation",
      "on.implementation.approved.start.implementation"
    ]);
  });

  it("does not activate repeated loop events that already have a policy handler", async () => {
    const loopData = baseData();
    loopData.automation.outputs.push({ id: "approved" }, { id: "rejected" });
    loopData.automation.actions.push({
      id: "review",
      description: "Review implementation output.",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    });
    loopData.automation.policies = [{
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "trigger.manual-start",
      action: "implementation",
      enabled: true
    }, {
      id: "on.implementation.approved.start.review",
      source: "event",
      event: "implementation.approved",
      action: "review",
      enabled: true
    }, {
      id: "on.review.rejected.start.implementation",
      source: "event",
      event: "review.rejected",
      action: "implementation",
      enabled: true
    }];
    loopData.automation.loops[0]!.steps = loopData.automation.policies.map((policy) => policy.id);

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    expect(screen.getByLabelText("Policy: on.implementation.approved.start.review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add policy step for implementation.approved" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add policy step for implementation.rejected" }).length).toBeGreaterThan(0);
  });

  it("renders loop edges with the smart step edge type", async () => {
    const loopData = baseData();
    loopData.automation.outputs.push({ id: "approved" }, { id: "rejected" });
    loopData.automation.actions.push({
      id: "review",
      description: "Review implementation output.",
      outputIds: ["approved", "rejected"],
      agentIds: ["agent-1"]
    });
    loopData.automation.policies = [{
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "trigger.manual-start",
      action: "implementation",
      enabled: true
    }, {
      id: "on.implementation.approved.start.review",
      source: "event",
      event: "implementation.approved",
      action: "review",
      enabled: true
    }, {
      id: "on.review.rejected.start.implementation",
      source: "event",
      event: "review.rejected",
      action: "implementation",
      enabled: true
    }];
    loopData.automation.loops[0]!.steps = loopData.automation.policies.map((policy) => policy.id);

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);
    await screen.findByLabelText("Policy: on.trigger.manual-start.start.implementation");
    expect(screen.queryByLabelText("Policy: on.review.rejected.start.implementation")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelectorAll(".react-flow__edge-loopSmart").length).toBeGreaterThan(0);
    });
    expect(document.querySelectorAll(".react-flow__edge-smoothstep")).toHaveLength(0);
    expect(document.querySelectorAll("[data-loop-connector=\"true\"]").length).toBeGreaterThan(0);
    const connectionPoints = document.querySelectorAll(".loop-react-flow-handle");
    expect(connectionPoints.length).toBeGreaterThan(0);
    expect(getComputedStyle(connectionPoints[0]!).opacity).toBe("1");
    const returnSourcePolicyNode = screen.getByLabelText("Policy: on.implementation.approved.start.review").closest(".react-flow__node");
    const returnTargetPolicyNode = screen.getByLabelText("Policy: on.trigger.manual-start.start.implementation").closest(".react-flow__node");
    expect(returnSourcePolicyNode?.querySelectorAll(".react-flow__handle-right")).toHaveLength(1);
    expect(returnSourcePolicyNode?.querySelectorAll(".react-flow__handle-bottom")).toHaveLength(0);
    expect(returnSourcePolicyNode?.querySelectorAll(".react-flow__handle-top").length).toBeGreaterThan(0);
    expect(returnTargetPolicyNode?.querySelectorAll(".react-flow__handle").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-handleid^=\"right-output-\"]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-loop-edge-endpoint]").length).toBe(0);
    expect(document.querySelectorAll("[data-loop-edge-tone=\"return\"]")).toHaveLength(1);
    await waitFor(() => {
      expect(loopEdgeLabelTexts()).toEqual(expect.arrayContaining([
        "manual-start",
        "approved",
        "rejected"
      ]));
    });
    const returnEdgeLabel = loopEdgeLabels().find((label) =>
      label.dataset.loopEdgeLabelTone === "return" &&
      label.dataset.loopEdgeLabelValue === "rejected"
    );
    expect(returnEdgeLabel).toBeDefined();
    expect(returnEdgeLabel).toHaveTextContent("rejected");
    expect(returnEdgeLabel).toHaveAttribute("data-loop-edge-label-value", "rejected");
    expect(returnEdgeLabel).not.toHaveAttribute("aria-label");
    expect(returnEdgeLabel).toHaveAttribute("aria-hidden", "true");
    expect(returnEdgeLabel).toHaveStyle({ pointerEvents: "none" });
    expect(loopEdgeStartLabels()).toHaveLength(0);
    expect(loopEdgeEndLabels()).toHaveLength(0);
  });

  it("toggles the loop edge animation effect on click", async () => {
    const loopData = baseData();
    loopData.automation.policies = [{
      id: "on.trigger.manual-start.start.implementation",
      source: "event",
      event: "trigger.manual-start",
      action: "implementation",
      enabled: true
    }, {
      id: "on.implementation.approved.start.review",
      source: "event",
      event: "implementation.approved",
      action: "review",
      enabled: true
    }];
    loopData.automation.loops[0]!.steps = loopData.automation.policies.map((policy) => policy.id);

    await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);
    await screen.findByLabelText("Policy: on.implementation.approved.start.review");

    await waitFor(() => {
      expect(document.querySelectorAll("[data-loop-connector=\"true\"]").length).toBeGreaterThan(0);
    });
    const edge = document.querySelector("[data-loop-connector=\"true\"][data-loop-edge-label-value=\"approved\"]");
    expect(edge).not.toBeNull();
    expect(edge).toHaveAttribute("data-loop-edge-animated", "false");

    fireEvent.click(edge!);

    await waitFor(() => {
      expect(edge).toHaveAttribute("data-loop-edge-animated", "true");
    });
    expect(edge).toHaveClass("loop-edge-animated");
    expect(screen.queryByRole("dialog", { name: "Output handler" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Loop handler" })).not.toBeInTheDocument();

    fireEvent.click(edge!);

    await waitFor(() => {
      expect(edge).toHaveAttribute("data-loop-edge-animated", "false");
    });
    expect(edge).not.toHaveClass("loop-edge-animated");
    expect(screen.queryByRole("dialog", { name: "Output handler" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Loop handler" })).not.toBeInTheDocument();
  });

  it("routes legacy policies paths to loop configuration", async () => {
    await renderRoute("/policies");

    expect(screen.queryByRole("tab", { name: /policies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Loop ID")).not.toBeInTheDocument();
    expect(screen.queryByText("No policies.")).not.toBeInTheDocument();
  });

  it("routes the removed agent runs page to loop configuration", async () => {
    await renderRoute("/agent-runs");

    expect(screen.queryByRole("link", { name: /agent runs/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Agent runs")).not.toBeInTheDocument();
    expect(screen.queryByText("Run detail")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loops" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Loop ID")).not.toBeInTheDocument();
  });

  it("creates the first event loop policy from the loop canvas", async () => {
    const user = userEvent.setup();
    const loopData = baseData();
    const implementationStartPolicyId = `on.trigger.${loopTrigger}.start.implementation`;
    loopData.automation.policies = [{
      id: implementationStartPolicyId,
      source: "trigger",
      trigger: loopTrigger,
      action: "implementation",
      enabled: true
    }];
    loopData.automation.loops[0]!.steps = [implementationStartPolicyId];
    const { data } = await renderRoute("/automation/loops?id=project-brief-gate.approved.loop", loopData);

    await user.click(screen.getByRole("button", { name: "Add policy step for implementation.approved" }));
    await user.click(screen.getByRole("button", { name: "Save automation" }));

    await waitFor(() => expect(data.automation.policies).toHaveLength(2));
    expect(data.automation.policies[1]).toMatchObject({
      source: "event",
      event: "implementation.approved",
      action: "implementation",
      id: "on.implementation.approved.start.implementation"
    });
    expect(data.automation.loops[0]?.steps).toEqual([implementationStartPolicyId, "on.implementation.approved.start.implementation"]);
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
