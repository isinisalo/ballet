// This integration suite intentionally shares filesystem fixtures across Markdown resource round-trip scenarios.
import { mkdtemp, rm, writeFile, mkdir, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadBalletProjectTree,
  markdownSource,
  parseMarkdownDocument,
  readMarkdownCollection,
  readMarkdownDocument,
  writeMarkdownDocument
} from "../markdown.js";
import {
  createProjectMarkdownDocument,
  loadMarkdownAppData,
  loadProjectInstructions,
  loadProjectSkills,
  removeEntityMarkdown,
  writeEntityMarkdown,
  writeProjectMarkdownDocument
} from "../markdown-adapter.js";
import {
  loadProjectAutomationConfigWithIssues,
  validateProjectExecutionResources
} from "../automation.js";
import { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";

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
    const body = "\n    const indented = true;\n\nTrailing.\n";
    const source = markdownSource({ id: "doc-1", title: "Doc" }, body);

    expect(source).toBe(`---\nid: doc-1\ntitle: Doc\n---\n${body}`);
    expect(parseMarkdownDocument(source).body).toBe(body);
  });
});

describe("Markdown collection loading", () => {
  it("loads fixture content and its strict-v12 project configuration without fallback data", async () => {
    const [data, automation, theme] = await Promise.all([
      loadMarkdownAppData(fixtureRoot),
      loadProjectAutomationConfigWithIssues(fixtureRoot),
      new LoopThemeRepository().load(fixtureRoot)
    ]);
    const projectConfiguration = new ProjectConfigurationRepository().load(fixtureRoot);

    expect(projectConfiguration).toMatchObject({ exists: true, issues: [] });
    expect(projectConfiguration.config?.executionProfiles).toEqual([{
      id: "codex-gpt-5-6-luna-high-network-off",
      name: "Codex GPT-5.6 Luna · High · Network off",
      provider: "codex",
      model: "gpt-5.6-luna",
      reasoningEffort: "high",
      networkAccess: false
    }]);
    expect(data.instructions).toEqual([
      expect.objectContaining({
        id: "project:architect",
        projectId: "architect",
        title: "Architect",
        body: "## Instructions\n\nDesign architecture, keep decisions traceable, and write ADRs when routing requires it.\n",
        valid: true,
        relativePath: ".ballet/instructions/architect.md",
        sourceSha256: "e14626fb277d87f010307476613b89b0aa8bbb0f6903a10127f4f8e23082b44b",
        contentSha256: "3a7b394727be306a4dad011a4152d1502f35da591a406a74281362d9cd19b78d",
        sizeBytes: 105
      }),
      expect.objectContaining({
        id: "project:reviewer",
        projectId: "reviewer",
        title: "Reviewer",
        body: "Review implementation changes and surface risks.\n",
        valid: true,
        relativePath: ".ballet/instructions/reviewer.md",
        sourceSha256: "4e43b53837175e6ac6b1b666b96de045cf2cb37b9f6cda2868e1207dd9ac6df6",
        contentSha256: "8ce7d15bdcd9cd6e2e4ec3471343e96ee50d1c18bc19aae62a8941f6dfc8ee9a",
        sizeBytes: 49
      })
    ]);
    expect(data.skills.map((skill) => skill.id)).toEqual(["project:fixture-skill"]);
    expect(data.skills[0]?.name).toBe("fixture-skill");
    expect(data.skills[0]?.projectId).toBe("fixture-skill");
    expect(data.skills[0]?.origin).toBe("project");
    expect(data.skills[0]?.valid).toBe(true);
    expect(data.skills[0]?.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(data.skills[0]?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(data.skills[0]?.relativePath).toBe(".agents/skills/fixture-skill/SKILL.md");
    expect(data.resourceIssues).toEqual([]);
    expect(data.project.id).toBe("fixture-project");
    expect(data.project).not.toHaveProperty("key");
    expect(data.project.name).toBe("Fixture Ballet Project");
    expect(data.project.description).toContain("Fixture project loaded from `.ballet/project.md`.");
    expect(data.project.relativePath).toBe(".ballet/project.md");
    expect(automation).toEqual({
      config: {
        version: 12,
        orchestrator: expect.objectContaining({
          executionProfileId: "codex-gpt-5-6-luna-high-network-off",
          primaryInstructionId: "project:architect",
          skillIds: ["project:fixture-skill"]
        }),
        graph: { loopEdges: [] },
        loops: [expect.objectContaining({
          id: "adr-review",
          workflow: expect.objectContaining({
            startJobNodeId: "review",
            jobNodes: expect.arrayContaining([expect.objectContaining({
              id: "review",
              type: "agent",
              executionProfileId: "codex-gpt-5-6-luna-high-network-off",
              primaryInstructionId: "project:reviewer",
              skillIds: []
            })]),
            validationNodes: expect.arrayContaining([expect.objectContaining({
              id: "review-validation",
              type: "agent",
              executionProfileId: "codex-gpt-5-6-luna-high-network-off",
              primaryInstructionId: "project:reviewer"
            })])
          })
        })]
      },
      issues: []
    });
    expect(validateProjectExecutionResources(automation.config, {
      instructions: data.instructions,
      skills: data.skills,
      issues: data.resourceIssues
    })).toEqual([]);
    expect(theme.issues).toEqual([]);
    expect(theme.theme.version).toBe(4);
    expect(theme.theme.node).toEqual({ labelColor: "#ffb95f", glowColor: "#8b90a0" });
    expect(theme.theme.node).not.toHaveProperty("showAgentAvatarInNode");
  });

  it("loads only .ballet/project.md for the project document", async () => {
    const data = await loadMarkdownAppData(fixtureRoot);
    const rootDocuments = data.projectDocumentTree?.filter((node) => node.type === "file") ?? [];

    expect(rootDocuments).toHaveLength(1);
    expect(rootDocuments[0]?.type === "file" ? rootDocuments[0].document.relativePath : undefined)
      .toBe(".ballet/project.md");
  });

  it("uses the skill folder as the canonical project-scoped id", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".agents/skills/folder-id"), { recursive: true });
    await writeFile(path.join(root, ".agents/skills/folder-id/SKILL.md"), "---\nid: forged-id\nname: Skill\n---\nBody", "utf8");
    const skills = await loadProjectSkills(root);

    expect(skills[0]).toMatchObject({
      id: "project:folder-id",
      projectId: "folder-id",
      name: "Skill",
      origin: "project",
      valid: true
    });
  });

  it("loads selectable Project instructions and Skills with content evidence", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
    await mkdir(path.join(root, ".agents/skills/docs-editor"), { recursive: true });
    await writeFile(path.join(root, ".ballet/instructions/reviewer.md"), "---\nid: reviewer\ntitle: Reviewer Instructions\n---\n\nReview docs.", "utf8");
    await writeFile(path.join(root, ".agents/skills/docs-editor/SKILL.md"), "---\nname: Docs Editor\ndescription: Edits docs.\ncategory: documentation\n---\n\nDocs body.", "utf8");

    const data = await loadMarkdownAppData(root);
    expect(data.instructions).toEqual([expect.objectContaining({
      id: "project:reviewer",
      projectId: "reviewer",
      title: "Reviewer Instructions",
      body: expect.stringContaining("Review docs."),
      origin: "project",
      valid: true,
      relativePath: ".ballet/instructions/reviewer.md",
      sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/)
    })]);
    expect(data.skills).toEqual([expect.objectContaining({
      id: "project:docs-editor",
      projectId: "docs-editor",
      name: "Docs Editor",
      description: "Edits docs.",
      metadata: { category: "documentation" },
      origin: "project",
      valid: true,
      relativePath: ".agents/skills/docs-editor/SKILL.md",
      sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/)
    })]);
    expect(data.resourceIssues).toEqual([]);
  });

  it("loads invalid Project instructions as unavailable resources", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
    await writeFile(path.join(root, ".ballet/instructions/missing-id.md"), "---\ntitle: Missing ID\n---\n\nInstruction body.", "utf8");

    const instructions = await loadProjectInstructions(root);

    expect(instructions).toEqual([expect.objectContaining({
      title: "Missing ID",
      valid: false,
      relativePath: ".ballet/instructions/missing-id.md",
      errors: expect.arrayContaining([expect.stringContaining("frontmatter id is required")])
    })]);
    expect(instructions[0]).not.toHaveProperty("id");
  });
});

describe("Markdown collections and project tree", () => {
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
});

describe("Markdown path safety and project document writes", () => {
  it("blocks path traversal outside the project root", async () => {
    await expect(readMarkdownDocument({ root: fixtureRoot, relativePath: "../package.json" })).rejects.toThrow("Path traversal blocked");
    await expect(readMarkdownDocument({ root: fixtureRoot, relativePath: "../outside.md" })).rejects.toThrow("Path traversal blocked");
    await expect(writeMarkdownDocument({ root: fixtureRoot, relativePath: "../outside.md", frontmatter: {}, body: "" })).rejects.toThrow("Path traversal blocked");
    await expect(writeEntityMarkdown(fixtureRoot, "skills", { relativePath: "../SKILL.md", name: "Bad", description: "Bad", body: "Bad" })).rejects.toThrow("Path traversal blocked");
  });

  it("blocks entity paths outside their collection and through symbolic links", async () => {
    const root = await tempRoot();
    const outside = await tempRoot();

    await expect(writeEntityMarkdown(root, "skills", {
      relativePath: "README.md", name: "Bad", description: "Bad", body: "Bad"
    })).rejects.toThrow("Entity document must be inside .agents/skills.");

    await symlink(outside, path.join(root, ".agents"));
    await mkdir(path.join(outside, "skills/escaped"), { recursive: true });
    await writeFile(path.join(outside, "skills/escaped/SKILL.md"), "outside", "utf8");
    await expect(writeEntityMarkdown(root, "skills", {
      name: "Escaped", description: "Bad", body: "Bad"
    })).rejects.toThrow("Symbolic links are not allowed");
    await expect(readMarkdownDocument({ root, relativePath: ".agents/skills/escaped/SKILL.md" }))
      .rejects.toThrow("Symbolic links are not allowed");
    await expect(removeEntityMarkdown(root, "skills", ".agents/skills/escaped/SKILL.md"))
      .rejects.toThrow("Symbolic links are not allowed");
    await expect(readFile(path.join(outside, "skills/escaped/SKILL.md"), "utf8")).resolves.toBe("outside");
  });

  it("rejects a new Skill when its canonical project id already exists", async () => {
    const root = await tempRoot();
    const input = { name: "Release Review", description: "Review", body: "Review releases" };

    await writeEntityMarkdown(root, "skills", input);

    await expect(writeEntityMarkdown(root, "skills", input)).rejects.toThrow("Skill 'release-review' already exists.");
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

  it("creates and writes selectable Project instructions under .ballet/instructions", async () => {
    const root = await tempRoot();
    const doc = await createProjectMarkdownDocument(root, {
      directoryPath: ".ballet/instructions",
      title: "Reviewer Instructions"
    });

    expect(doc.relativePath).toBe(".ballet/instructions/reviewer-instructions.md");
    expect(doc.title).toBe("Reviewer Instructions");
    expect(doc.frontmatter.title).toBe("Reviewer Instructions");
    expect(doc.frontmatter.createdAt).toEqual(expect.any(String));
    expect(doc.frontmatter.updatedAt).toEqual(expect.any(String));

    await writeProjectMarkdownDocument(root, {
      relativePath: doc.relativePath,
      frontmatter: { ...doc.frontmatter, id: "reviewer" },
      body: "Review the completed work."
    });
    const source = await readFile(path.join(root, ".ballet/instructions/reviewer-instructions.md"), "utf8");
    const instructions = await loadProjectInstructions(root);

    expect(source).toContain("title: Reviewer Instructions");
    expect(source).toContain("id: reviewer");
    expect(instructions).toEqual([expect.objectContaining({
      id: "project:reviewer",
      projectId: "reviewer",
      title: "Reviewer Instructions",
      body: expect.stringContaining("Review the completed work."),
      valid: true
    })]);
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
});

describe("Project Markdown updates", () => {
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
});

describe("Markdown entity persistence", () => {
  it("writes Project Skills while preserving unrelated frontmatter", async () => {
    const root = await tempRoot();

    const written = await writeEntityMarkdown(root, "skills", {
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
    expect(written).toMatchObject({
      id: "project:fixture-skill",
      projectId: "fixture-skill",
      relativePath: ".agents/skills/fixture-skill/SKILL.md"
    });

    expect(await loadProjectSkills(root)).toEqual([expect.objectContaining({
      id: "project:fixture-skill",
      metadata: { category: "fixture" },
      body: expect.stringContaining("# Updated"),
      valid: true
    })]);
  });
});
