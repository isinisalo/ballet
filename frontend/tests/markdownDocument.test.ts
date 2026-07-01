import { describe, expect, it } from "vitest";
import { frontmatterToYaml, parseFrontmatterYaml } from "../src/workspace/documents/frontmatter";
import { documentTitle, markdownPreviewDocument, removeMatchingLeadingH1 } from "../src/workspace/documents/markdownDocument";

describe("frontmatter helpers", () => {
  it("stringifies and parses YAML mappings", () => {
    const yaml = frontmatterToYaml({ title: "Plan", tags: ["ops", "ai"], draft: false });
    expect(parseFrontmatterYaml(yaml)).toEqual({ title: "Plan", tags: ["ops", "ai"], draft: false });
  });

  it("rejects non-mapping frontmatter", () => {
    expect(() => parseFrontmatterYaml("- one\n- two")).toThrow("Frontmatter must be a YAML mapping/object.");
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
