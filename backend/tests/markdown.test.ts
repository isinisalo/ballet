import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadBalletProjectTree,
  loadSkills,
  markdownSource,
  parseMarkdownDocument,
  parseTomlDocument,
  readMarkdownCollection,
  readMarkdownDocument,
  readTomlDocument,
  tomlSource,
  writeMarkdownDocument
} from "../markdown.js";
import { createProjectMarkdownDocument, loadMarkdownAppData, writeEntityMarkdown, writeProjectMarkdownDocument } from "../markdown-adapter.js";

const fixtureRoot = path.resolve(process.cwd(), ".fixture-ballet-project");
const tempRoots: string[] = [];

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-md-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Markdown parsing", () => {
  it("parses YAML frontmatter and Markdown body", () => {
    const parsed = parseMarkdownDocument(`---\nid: doc-1\ntitle: Test Doc\ntags:\n  - one\n---\n\n## Body\n\nLong-form content.`);

    expect(parsed.frontmatter.id).toBe("doc-1");
    expect(parsed.frontmatter.title).toBe("Test Doc");
    expect(parsed.frontmatter.tags).toEqual(["one"]);
    expect(parsed.body).toContain("Long-form content.");
    expect(parsed.errors).toBeUndefined();
  });

  it("handles invalid frontmatter without throwing", () => {
    const parsed = parseMarkdownDocument(`---\nid: bad\ntags: [\n---\n\nBody survives.`);

    expect(parsed.frontmatter).toEqual({});
    expect(parsed.errors?.length).toBeGreaterThan(0);
    expect(parsed.body).toContain("Body survives.");
  });

  it("serializes frontmatter before Markdown body", () => {
    const source = markdownSource({ id: "doc-1", title: "Doc" }, "Body");

    expect(source).toContain("---\nid: doc-1\ntitle: Doc\n---\n\nBody");
  });
});

describe("TOML parsing", () => {
  it("parses TOML agent config", () => {
    const parsed = parseTomlDocument(`name = "Reviewer"\nmodel = "gpt-5.5"\nnickname_candidates = ["Atlas"]\n`);

    expect(parsed.frontmatter.name).toBe("Reviewer");
    expect(parsed.frontmatter.model).toBe("gpt-5.5");
    expect(parsed.frontmatter.nickname_candidates).toEqual(["Atlas"]);
    expect(parsed.errors).toBeUndefined();
  });

  it("serializes TOML config", () => {
    const source = tomlSource({ name: "Reviewer", model: "gpt-5.5" });

    expect(source).toContain('name = "Reviewer"');
    expect(source).toContain('model = "gpt-5.5"');
  });
});

describe("Markdown collection loading", () => {
  it("loads fixture collections from project-local .codex and .ballet folders", async () => {
    const data = await loadMarkdownAppData(fixtureRoot);

    expect(data.projectRoot).toBe(fixtureRoot);
    expect(data.agents.map((agent) => agent.id).sort()).toEqual(["architect", "reviewer"]);
    expect(data.agents.find((agent) => agent.id === "architect")?.model).toBe("gpt-5.5");
    expect(data.agents.find((agent) => agent.id === "architect")?.modelReasoningEffort).toBe("high");
    expect(data.agents.find((agent) => agent.id === "architect")?.status).toBe("offline");
    expect(data.agents.find((agent) => agent.id === "architect")?.nicknameCandidates).toEqual(["Arch", "Atlas"]);
    expect(data.agents.find((agent) => agent.id === "architect")?.instructions).toContain("Design architecture");
    expect(data.skills.map((skill) => skill.id)).toEqual(["fixture-skill"]);
    expect(data.skills[0]?.name).toBe("fixture-skill");
    expect(data.skills[0]?.relativePath).toBe(".agents/skills/fixture-skill/SKILL.md");
    expect(data.projects[0]?.id).toBe("fixture-project");
    expect(data.projects[0]).not.toHaveProperty("key");
    expect(data.projects[0]?.name).toBe("Fixture Ballet Project");
    expect(data.projects[0]?.description).toContain("Fixture project loaded from `.ballet/project.md`.");
    expect(data.projects[0]?.relativePath).toBe(".ballet/project.md");
    expect(data.adrs[0]?.id).toBe("0001-test-adr");
    expect(data.goals.some((goal) => goal.id === "test-goal")).toBe(true);
    expect(data.events).toEqual([]);
    expect(data.eventDefinitions).toEqual([]);
    expect(data.runtimes).toEqual([]);
    expect(data.policies).toEqual([]);
    expect(data.automation).toEqual({ version: 1, triggers: [], actions: [], outputs: [], policies: [], workflows: [], runtimes: [] });
  });

  it("loads only .ballet/project.md for the project document", async () => {
    const data = await loadMarkdownAppData(fixtureRoot);

    expect(data.documents?.project).toHaveLength(1);
    expect(data.documents?.project[0]?.relativePath).toBe(".ballet/project.md");
  });

  it("loads custom agents from .toml files", async () => {
    const agent = await readTomlDocument({ root: fixtureRoot, relativePath: ".codex/agents/architect.toml", collection: "agents" });

    expect(agent.id).toBe("architect");
    expect(agent.title).toBe("Architect");
    expect(agent.body).toContain("Design architecture");
  });

  it("loads repo skills from SKILL.md files with stable folder ids", async () => {
    const skills = await loadSkills(fixtureRoot);

    expect(skills.map((skill) => skill.id)).toEqual(["fixture-skill"]);
    expect(skills[0]?.title).toBe("fixture-skill");
  });

  it("loads agent TOML skills.config entries with resolved SKILL.md names and disabled state", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await mkdir(path.join(root, ".agents/skills/docs-editor"), { recursive: true });
    await mkdir(path.join(root, ".agents/skills/deprecated-review"), { recursive: true });
    await writeFile(path.join(root, ".agents/skills/docs-editor/SKILL.md"), "---\nname: Docs Editor\ndescription: Edits docs.\n---\n\nDocs body.", "utf8");
    await writeFile(path.join(root, ".agents/skills/deprecated-review/SKILL.md"), "---\nname: Deprecated Review\ndescription: Old review flow.\n---\n\nDeprecated body.", "utf8");
    await writeFile(path.join(root, ".codex/agents/reviewer.toml"), `name = "Reviewer"
description = "Reviews docs"
developer_instructions = "Review docs."

[[skills.config]]
path = "../.agents/skills/docs-editor"
enabled = true

[[skills.config]]
path = "../.agents/skills/deprecated-review/SKILL.md"
enabled = false

[[skills.config]]
enabled = true
`, "utf8");

    const data = await loadMarkdownAppData(root);
    const agent = data.agents.find((candidate) => candidate.id === "reviewer");

    expect(agent?.skills).toHaveLength(2);
    expect(agent?.skills[0]).toMatchObject({
      id: "docs-editor",
      name: "Docs Editor",
      description: "Edits docs.",
      enabled: true,
      metadata: { path: "../.agents/skills/docs-editor" },
      relativePath: ".agents/skills/docs-editor/SKILL.md"
    });
    expect(agent?.skills[1]).toMatchObject({
      id: "deprecated-review",
      name: "Deprecated Review",
      description: "Old review flow.",
      enabled: false,
      metadata: { path: "../.agents/skills/deprecated-review/SKILL.md" },
      relativePath: ".agents/skills/deprecated-review/SKILL.md"
    });
  });

  it("falls back to the skills.config path basename when no SKILL.md matches", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await writeFile(path.join(root, ".codex/agents/reviewer.toml"), `name = "Reviewer"
description = "Reviews docs"
developer_instructions = "Review docs."

[[skills.config]]
path = "../.agents/skills/missing-skill"
`, "utf8");

    const data = await loadMarkdownAppData(root);
    const agent = data.agents.find((candidate) => candidate.id === "reviewer");

    expect(agent?.skills).toEqual([
      {
        id: "missing-skill",
        name: "missing-skill",
        description: "",
        metadata: { path: "../.agents/skills/missing-skill" },
        enabled: true
      }
    ]);
  });

  it("loads the .ballet project document tree up to two directory levels", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet/adr/backend/deep"), { recursive: true });
    await mkdir(path.join(root, ".ballet/goals"), { recursive: true });
    await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\ntitle: Root Project\n---\n\nProject body", "utf8");
    await writeFile(path.join(root, ".ballet/other.mdx"), "---\ntitle: Ignored MDX\n---\n\nBody", "utf8");
    await writeFile(path.join(root, ".ballet/index.yaml"), "title: Ignored YAML\n", "utf8");
    await writeFile(path.join(root, ".ballet/goals/goal.md"), "---\ntitle: Goal Title\n---\n\nGoal body", "utf8");
    await writeFile(path.join(root, ".ballet/instructions/reviewer.md"), "---\ntitle: Reviewer Instructions\n---\n\nInstruction body", "utf8");
    await writeFile(path.join(root, ".ballet/adr/root.md"), "---\ntitle: ADR Root\n---\n\nADR body", "utf8");
    await writeFile(path.join(root, ".ballet/adr/backend/accepted.md"), "---\ntitle: Backend ADR\n---\n\nBackend body", "utf8");
    await writeFile(path.join(root, ".ballet/adr/backend/deep/hidden.md"), "---\ntitle: Hidden ADR\n---\n\nHidden body", "utf8");

    const tree = await loadBalletProjectTree(root);
    const project = tree[0];
    const adr = tree.find((node) => node.type === "directory" && node.label === "adr");
    const goals = tree.find((node) => node.type === "directory" && node.label === "goals");
    const instructions = tree.find((node) => node.type === "directory" && node.label === "instructions");
    const backend = adr?.type === "directory"
      ? adr.children.find((node) => node.type === "directory" && node.label === "backend")
      : undefined;

    expect(project?.type).toBe("file");
    expect(project?.label).toBe("Root Project");
    expect(tree.some((node) => node.type === "file" && node.label === "Ignored MDX")).toBe(false);
    expect(tree.some((node) => node.type === "file" && node.label === "Ignored YAML")).toBe(false);
    expect(goals?.type).toBe("directory");
    expect(goals?.type === "directory" ? goals.children.map((node) => node.label) : []).toContain("Goal Title");
    expect(instructions?.type).toBe("directory");
    expect(instructions?.type === "directory" ? instructions.children.map((node) => node.label) : []).toContain("Reviewer Instructions");
    expect(adr?.type).toBe("directory");
    expect(backend?.type).toBe("directory");
    expect(backend?.type === "directory" ? backend.children.map((node) => node.label) : []).toContain("Backend ADR");
    expect(backend?.type === "directory" ? backend.children.map((node) => node.label) : []).not.toContain("deep");
  });

  it("returns empty collections for missing directories", async () => {
    const root = await tempRoot();
    const docs = await readMarkdownCollection({ root, collectionPath: ".ballet/goals", collection: "goals" });

    expect(docs).toEqual([]);
  });

  it("derives a stable id from the filename when frontmatter id is missing", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet/goals"), { recursive: true });
    await writeFile(path.join(root, ".ballet/goals/no-id-goal.md"), "---\ntitle: No Id\n---\n\nBody", "utf8");

    const docs = await readMarkdownCollection({ root, collectionPath: ".ballet/goals", collection: "goals" });

    expect(docs[0]?.id).toBe("no-id-goal");
    expect(docs[0]?.slug).toBe("no-id-goal");
  });

  it("surfaces invalid frontmatter errors per file while loading other documents", async () => {
    const docs = await readMarkdownCollection({ root: fixtureRoot, collectionPath: ".ballet/goals", collection: "goals" });
    const invalid = docs.find((doc) => doc.slug === "invalid-frontmatter");
    const valid = docs.find((doc) => doc.id === "test-goal");

    expect(valid?.title).toBe("Load fixture goal");
    expect(invalid?.errors?.length).toBeGreaterThan(0);
    expect(invalid?.body).toContain("This body should still be available");
  });

  it("blocks path traversal outside the project root", async () => {
    await expect(readMarkdownDocument({ root: fixtureRoot, relativePath: "../package.json" })).rejects.toThrow("Path traversal blocked");
    await expect(readMarkdownDocument({ root: fixtureRoot, relativePath: "../outside.md" })).rejects.toThrow("Path traversal blocked");
    await expect(readTomlDocument({ root: fixtureRoot, relativePath: "../outside.toml" })).rejects.toThrow("Path traversal blocked");
    await expect(writeMarkdownDocument({ root: fixtureRoot, relativePath: "../outside.md", frontmatter: {}, body: "" })).rejects.toThrow("Path traversal blocked");
    await expect(writeEntityMarkdown(fixtureRoot, "agents", { relativePath: "../outside.toml", name: "Bad", description: "Bad", instructions: "Bad" })).rejects.toThrow("Path traversal blocked");
    await expect(writeEntityMarkdown(fixtureRoot, "skills", { relativePath: "../SKILL.md", name: "Bad", description: "Bad", body: "Bad" })).rejects.toThrow("Path traversal blocked");
  });

  it("writes Markdown inside the active project root", async () => {
    const root = await tempRoot();
    await writeMarkdownDocument({
      root,
      relativePath: ".ballet/project.md",
      frontmatter: { id: "written", custom: "kept" },
      body: "Written body"
    });

    const source = await readFile(path.join(root, ".ballet/project.md"), "utf8");
    const doc = await readMarkdownDocument({ root, relativePath: ".ballet/project.md", collection: "project" });

    expect(source).toContain("custom: kept");
    expect(doc.id).toBe("written");
    expect(doc.body).toContain("Written body");
  });

  it("creates instruction Markdown documents under .ballet/instructions", async () => {
    const root = await tempRoot();
    const doc = await createProjectMarkdownDocument(root, {
      directoryPath: ".ballet/instructions",
      title: "Reviewer Instructions"
    });

    const source = await readFile(path.join(root, ".ballet/instructions/reviewer-instructions.md"), "utf8");

    expect(doc.relativePath).toBe(".ballet/instructions/reviewer-instructions.md");
    expect(doc.title).toBe("Reviewer Instructions");
    expect(doc.frontmatter.title).toBe("Reviewer Instructions");
    expect(doc.frontmatter.createdAt).toEqual(expect.any(String));
    expect(doc.frontmatter.updatedAt).toEqual(expect.any(String));
    expect(source).toContain("title: Reviewer Instructions");
  });

  it("creates duplicate project Markdown documents with numeric filename suffixes", async () => {
    const root = await tempRoot();

    const first = await createProjectMarkdownDocument(root, {
      directoryPath: ".ballet/instructions",
      title: "Reviewer Instructions"
    });
    const second = await createProjectMarkdownDocument(root, {
      directoryPath: ".ballet/instructions",
      title: "Reviewer Instructions"
    });

    expect(first.relativePath).toBe(".ballet/instructions/reviewer-instructions.md");
    expect(second.relativePath).toBe(".ballet/instructions/reviewer-instructions-2.md");
  });

  it("blocks unsafe project Markdown document creation paths", async () => {
    const root = await tempRoot();

    await expect(createProjectMarkdownDocument(root, {
      directoryPath: "../outside",
      title: "Outside"
    })).rejects.toThrow("Path traversal blocked");
    await expect(createProjectMarkdownDocument(root, {
      directoryPath: ".ballet/instructions.txt",
      title: "Invalid directory"
    })).rejects.toThrow("Project document directory must not include a file extension.");
  });

  it("writes project description as Markdown body instead of frontmatter", async () => {
    const root = await tempRoot();
    await writeEntityMarkdown(root, "projects", {
      id: "written-project",
      name: "Written Project",
      key: "OLD",
      title: "Old title",
      description: "Markdown project description.",
      frontmatter: {
        id: "written-project",
        name: "Written Project",
        key: "OLD",
        title: "Old title",
        description: "Old frontmatter description"
      }
    });

    const source = await readFile(path.join(root, ".ballet/project.md"), "utf8");

    expect(source).toContain("id: written-project");
    expect(source).toContain("name: Written Project");
    expect(source).not.toContain("key:");
    expect(source).not.toContain("title:");
    expect(source).not.toContain("description:");
    expect(source).toContain("---\n\nMarkdown project description.");
  });

  it("saves the root Ballet project Markdown document in place", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\nid: project\ncustom: kept\n---\n\nOld body", "utf8");

    const saved = await writeProjectMarkdownDocument(root, {
      relativePath: ".ballet/project.md",
      frontmatter: { id: "project", title: "Updated Project", custom: "kept" },
      body: "Updated body"
    });
    const source = await readFile(path.join(root, ".ballet/project.md"), "utf8");

    expect(saved.relativePath).toBe(".ballet/project.md");
    expect(saved.frontmatter.title).toBe("Updated Project");
    expect(source).toContain("custom: kept");
    expect(source).toContain("title: Updated Project");
    expect(source).toContain("Updated body");
  });

  it("saves nested Ballet project tree Markdown documents in place", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet/goals"), { recursive: true });
    await writeFile(path.join(root, ".ballet/goals/goal.md"), "---\ntitle: Old Goal\nowner: team\n---\n\nOld goal", "utf8");

    const saved = await writeProjectMarkdownDocument(root, {
      relativePath: ".ballet/goals/goal.md",
      frontmatter: { title: "Updated Goal", owner: "team" },
      body: "Updated goal"
    });

    expect(saved.relativePath).toBe(".ballet/goals/goal.md");
    expect(saved.title).toBe("Updated Goal");
    expect(saved.frontmatter.owner).toBe("team");
    expect(saved.body).toContain("Updated goal");
  });

  it("rejects non-project or non-markdown project document writes", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await mkdir(path.join(root, ".agents/skills/test"), { recursive: true });
    await writeFile(path.join(root, ".ballet/project.md"), "---\ntitle: Project\n---\n\nBody", "utf8");
    await writeFile(path.join(root, ".ballet/project.mdx"), "---\ntitle: Project\n---\n\nBody", "utf8");
    await writeFile(path.join(root, ".agents/skills/test/SKILL.md"), "---\nname: test\n---\n\nBody", "utf8");

    await expect(writeProjectMarkdownDocument(root, {
      relativePath: "../outside.md",
      frontmatter: {},
      body: ""
    })).rejects.toThrow("Path traversal blocked");
    await expect(writeProjectMarkdownDocument(root, {
      relativePath: ".agents/skills/test/SKILL.md",
      frontmatter: {},
      body: ""
    })).rejects.toThrow("Project document must be inside .ballet.");
    await expect(writeProjectMarkdownDocument(root, {
      relativePath: ".ballet/project.mdx",
      frontmatter: {},
      body: ""
    })).rejects.toThrow("Project document must be a .md file.");
    await expect(writeProjectMarkdownDocument(root, {
      relativePath: ".ballet/missing.md",
      frontmatter: {},
      body: ""
    })).rejects.toThrow();
  });

  it("writes TOML agents while preserving unknown nested config", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".codex/agents"), { recursive: true });
    await writeFile(path.join(root, ".codex/agents/reviewer.toml"), "name = \"Reviewer\"\ndescription = \"Old\"\ndeveloper_instructions = \"Old instructions\"\n\n[mcp_servers.docs]\nurl = \"https://example.test/mcp\"\n", "utf8");

    await writeEntityMarkdown(root, "agents", {
      id: "reviewer",
      name: "Reviewer",
      description: "Updated",
      instructions: "Updated instructions",
      status: "online",
      model: "gpt-5.5",
      modelReasoningEffort: "high",
      nicknameCandidates: ["Atlas"],
      relativePath: ".codex/agents/reviewer.toml",
      frontmatter: {
        name: "Reviewer",
        description: "Old",
        developer_instructions: "Old instructions",
        mcp_servers: { docs: { url: "https://example.test/mcp" } },
        skills: { config: [{ path: "../.agents/skills/docs-editor", enabled: true }] }
      }
    });

    const source = await readFile(path.join(root, ".codex/agents/reviewer.toml"), "utf8");

    expect(source).toContain('description = "Updated"');
    expect(source).toContain('status = "online"');
    expect(source).toContain('model = "gpt-5.5"');
    expect(source).toContain('model_reasoning_effort = "high"');
    expect(source).toContain('nickname_candidates = [ "Atlas" ]');
    expect(source).toContain("[mcp_servers.docs]");
    expect(source).toContain('url = "https://example.test/mcp"');
    expect(source).toContain("[[skills.config]]");
    expect(source).toContain('path = "../.agents/skills/docs-editor"');
    expect(source).toContain("enabled = true");
  });

  it("writes skills while preserving unrelated frontmatter", async () => {
    const root = await tempRoot();

    await writeEntityMarkdown(root, "skills", {
      id: "fixture-skill",
      name: "fixture-skill",
      description: "Updated skill",
      body: "# Updated\n\nInstructions.",
      frontmatter: { name: "fixture-skill", description: "Old", category: "fixture" }
    });

    const source = await readFile(path.join(root, ".agents/skills/fixture-skill/SKILL.md"), "utf8");

    expect(source).toContain("name: fixture-skill");
    expect(source).toContain("description: Updated skill");
    expect(source).toContain("category: fixture");
    expect(source).toContain("# Updated");
  });

});
