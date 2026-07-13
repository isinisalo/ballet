import { describe, expect, it } from "vitest";
import { frontmatterToYaml, parseFrontmatterYaml } from "../src/workspace/documents/frontmatter";
import { countEditorWords, estimateEditorTokens, formatEditorMetric } from "../src/workspace/documents/editorMetrics";
import { documentTitle, markdownPreviewDocument, removeMatchingLeadingH1 } from "../src/workspace/documents/markdownDocument";
import { findProjectTreeDirectory, selectedProjectTreeDocument } from "../src/workspace/documents/projectDocuments";
import type { ProjectDocumentTreeNode } from "@shared/api/workspace-contracts";

describe("frontmatter helpers", () => {
  it("stringifies and parses YAML mappings", () => {
    const yaml = frontmatterToYaml({ title: "Plan", tags: ["ops", "ai"], draft: false });
    expect(parseFrontmatterYaml(yaml)).toEqual({ title: "Plan", tags: ["ops", "ai"], draft: false });
  });

  it("rejects non-mapping frontmatter", () => {
    expect(() => parseFrontmatterYaml("- one\n- two")).toThrow("Frontmatter must be a YAML mapping/object.");
  });
});

describe("editor metrics", () => {
  it("counts words and estimates tokens without UI state", () => {
    expect(countEditorWords("  one\n two   three ")).toBe(3);
    expect(countEditorWords("  ")).toBe(0);
    expect(estimateEditorTokens("12345")).toBe(2);
    expect(estimateEditorTokens("")).toBe(0);
  });

  it("formats large metrics compactly", () => {
    expect(formatEditorMetric(999)).toBe("999");
    expect(formatEditorMetric(1000)).toBe("1.0k");
    expect(formatEditorMetric(9999)).toBe("10.0k");
    expect(formatEditorMetric(10000)).toBe("10k");
  });
});

describe("markdown document helpers", () => {
  const document = {
    id: "doc-1",
    title: undefined,
    name: undefined,
    frontmatter: { title: "Current title" },
    body: "# Current title\n\nOriginal body",
    relativePath: ".ballet/project.md",
    errors: []
  };

  it("uses frontmatter title and removes a duplicate leading h1", () => {
    expect(documentTitle(document)).toBe("Current title");
    expect(removeMatchingLeadingH1("# Current   title\n\nBody", "current title")).toBe("Body");
    expect(removeMatchingLeadingH1("# Different\n\nBody", "current title")).toBe("# Different\n\nBody");
  });

  it("builds previews from unsaved draft content", () => {
    const preview = markdownPreviewDocument(document, "title: Draft title", "# Draft title\n\nDraft body", parseFrontmatterYaml);
    expect(preview.frontmatter).toEqual({ title: "Draft title" });
    expect(preview.body).toBe("# Draft title\n\nDraft body");
    expect(preview.errors).toEqual([]);
  });

  it("keeps draft body visible when draft frontmatter is invalid", () => {
    const preview = markdownPreviewDocument(document, "title: [", "Draft body", parseFrontmatterYaml);
    expect(preview.frontmatter).toEqual(document.frontmatter);
    expect(preview.body).toBe("Draft body");
    expect(preview.errors?.[0]).toMatch(/Flow sequence/);
  });
});

describe("project document selection helpers", () => {
  const projectDocumentTree: ProjectDocumentTreeNode[] = [
    {
      type: "directory",
      label: "goals",
      relativePath: ".ballet/goals",
      children: [
        {
          type: "file",
          label: "First goal",
          document: {
            id: "first-goal",
            collection: "goals",
            absolutePath: "/workspace/.ballet/goals/first.md",
            relativePath: ".ballet/goals/first.md",
            slug: "first",
            frontmatter: { title: "First goal" },
            body: "First body"
          }
        },
        {
          type: "file",
          label: "Second goal",
          document: {
            id: "second-goal",
            collection: "goals",
            absolutePath: "/workspace/.ballet/goals/second.md",
            relativePath: ".ballet/goals/second.md",
            slug: "second",
            frontmatter: { title: "Second goal" },
            body: "Second body"
          }
        }
      ]
    }
  ];

  it("selects routed documents inside a directory and falls back to the first directory document", () => {
    const goalsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/goals");

    expect(selectedProjectTreeDocument(goalsDirectory, ".ballet/goals/second.md")?.id).toBe("second-goal");
    expect(selectedProjectTreeDocument(goalsDirectory, ".ballet/adr/decision.md")?.id).toBe("first-goal");
    expect(selectedProjectTreeDocument(goalsDirectory)?.id).toBe("first-goal");
  });
});
