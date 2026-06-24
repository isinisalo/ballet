import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  markdownSource,
  parseMarkdownDocument,
  readMarkdownCollection,
  readMarkdownDocument,
  writeMarkdownDocument
} from "../markdown.js";
import { loadMarkdownAppData, writeEntityMarkdown } from "../markdown-adapter.js";

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

describe("Markdown collection loading", () => {
  it("loads fixture collections from project-local .codex and .ballet folders", async () => {
    const data = await loadMarkdownAppData(fixtureRoot);

    expect(data.projectRoot).toBe(fixtureRoot);
    expect(data.agents.map((agent) => agent.id).sort()).toEqual(["architect", "reviewer"]);
    expect(data.projects[0]?.id).toBe("fixture-project");
    expect(data.projects[0]).not.toHaveProperty("key");
    expect(data.projects[0]?.name).toBe("Fixture Ballet Project");
    expect(data.projects[0]?.description).toContain("Fixture project loaded from `.ballet/project.md`.");
    expect(data.projects[0]?.relativePath).toBe(".ballet/project.md");
    expect(data.adrs[0]?.id).toBe("0001-test-adr");
    expect(data.goals.some((goal) => goal.id === "test-goal")).toBe(true);
    expect(data.events[0]?.id).toBe("test-event");
    expect(data.policies[0]?.id).toBe("test-policy");
  });

  it("loads only .ballet/project.md for the project document", async () => {
    const data = await loadMarkdownAppData(fixtureRoot);

    expect(data.documents?.project).toHaveLength(1);
    expect(data.documents?.project[0]?.relativePath).toBe(".ballet/project.md");
  });

  it("supports .md and .mdx files", async () => {
    const agents = await readMarkdownCollection({ root: fixtureRoot, collectionPath: ".codex/agents", collection: "agents" });

    expect(agents.map((agent) => agent.relativePath).sort()).toEqual([
      ".codex/agents/architect.md",
      ".codex/agents/reviewer.mdx"
    ]);
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
    await expect(writeMarkdownDocument({ root: fixtureRoot, relativePath: "../outside.md", frontmatter: {}, body: "" })).rejects.toThrow("Path traversal blocked");
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
});
