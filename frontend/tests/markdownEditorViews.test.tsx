import type { MarkdownDocument, Skill } from "@shared/api/workspace-contracts";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectMarkdownEditorView } from "../src/workspace/documents/ProjectMarkdownEditorView";
import { SkillsView } from "../src/workspace/skills/SkillsView";

const projectDocument = (): MarkdownDocument => ({
  id: "project",
  collection: "project",
  title: "Project",
  frontmatter: { title: "Project" },
  body: "Original body",
  absolutePath: "/workspace/.ballet/project.md",
  relativePath: ".ballet/project.md",
  slug: "project",
  errors: []
});

const skill = (): Skill => ({
  id: "review",
  name: "Review",
  description: "Reviews changes.",
  metadata: {},
  frontmatter: { name: "Review", description: "Reviews changes." },
  body: "Review the change.",
  relativePath: ".agents/skills/review/SKILL.md",
  errors: []
});

describe("project Markdown editor", () => {
  it("shows YAML validation beside frontmatter before save", async () => {
    const user = userEvent.setup();
    render(
      <ProjectMarkdownEditorView
        document={projectDocument()}
        emptyTitle="No project document."
        saveProjectDocument={vi.fn()}
        setNavigationBlocker={vi.fn()}
      />
    );

    const frontmatter = screen.getByLabelText("YAML Frontmatter");
    await user.clear(frontmatter);
    await user.type(frontmatter, "- item");

    expect(screen.getAllByText("Frontmatter must be a YAML mapping/object.")).toHaveLength(2);
    expect(frontmatter).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeDisabled();
  });

  it("exposes pending state and accepts the persisted draft", async () => {
    const user = userEvent.setup();
    const source = projectDocument();
    let resolveSave!: (document: MarkdownDocument) => void;
    const saveProjectDocument = vi.fn((input: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) =>
      new Promise<MarkdownDocument>((resolve) => { resolveSave = resolve; }).then(() => ({ ...source, ...input }))
    );
    render(
      <ProjectMarkdownEditorView
        document={source}
        emptyTitle="No project document."
        saveProjectDocument={saveProjectDocument}
        setNavigationBlocker={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Markdown Body"), " Updated.");
    await user.click(screen.getByRole("button", { name: "Save Markdown" }));
    expect(screen.getByRole("button", { name: "Save Markdown in progress" })).toBeDisabled();
    expect(screen.getAllByText("Saving…").length).toBeGreaterThan(0);

    await act(async () => resolveSave(source));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(saveProjectDocument).toHaveBeenCalledTimes(1);
  });
});

describe("skill Markdown editor", () => {
  it("previews the draft name and reports save failures as a server alert", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => { throw new Error("Disk is read-only."); });
    render(
      <SkillsView
        skill={skill()}
        save={save}
        remove={vi.fn()}
        navigate={vi.fn()}
        setNavigationBlocker={vi.fn()}
      />
    );

    const frontmatter = screen.getByLabelText("YAML Frontmatter");
    await user.clear(frontmatter);
    await user.type(frontmatter, "name: Draft review\ndescription: Updated");
    expect(screen.getByRole("heading", { name: "Draft review" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save skill" }));
    expect(await screen.findByText("Disk is read-only.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save skill" })).toBeEnabled();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
