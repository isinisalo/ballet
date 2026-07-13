import { describe, expect, it } from "vitest";
import type { MarkdownDocument, ProjectDocumentTreeNode } from "@shared/api/workspace-contracts";
import { listProjectTreeDocuments } from "../src/workspace/documents/projectDocuments";

const document = (id: string): MarkdownDocument => ({
  id,
  collection: "project",
  title: id,
  frontmatter: { title: id },
  body: "",
  absolutePath: `/workspace/.ballet/goals/${id}.md`,
  relativePath: `.ballet/goals/${id}.md`,
  slug: id
});

describe("project document collections", () => {
  it("flattens nested directories without changing tree order", () => {
    const first = document("first");
    const nested = document("nested");
    const last = document("last");
    const nodes: ProjectDocumentTreeNode[] = [
      { type: "file", label: "First", document: first },
      {
        type: "directory",
        label: "group",
        relativePath: ".ballet/goals/group",
        children: [{ type: "file", label: "Nested", document: nested }]
      },
      { type: "file", label: "Last", document: last }
    ];

    expect(listProjectTreeDocuments(nodes)).toEqual([first, nested, last]);
  });
});
