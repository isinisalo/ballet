import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MarkdownWorkbench } from "../src/workspace/documents/MarkdownWorkbench";

const document = {
  id: "project",
  relativePath: ".ballet/project.md",
  frontmatter: { title: "Project" },
  body: "Original body",
  errors: []
};

const workbench = (overrides: Partial<React.ComponentProps<typeof MarkdownWorkbench>> = {}) => ({
  document,
  emptyTitle: "No document.",
  formId: "markdown-form",
  saveLabel: "Save Markdown",
  frontmatterText: "title: Project",
  bodyText: "Draft body",
  dirty: true,
  valid: true,
  pending: false,
  onFrontmatterChange: vi.fn(),
  onBodyChange: vi.fn(),
  onSubmit: vi.fn(),
  ...overrides
});

describe("Markdown Workbench", () => {
  it("keeps the preview and compact metrics without inert formatting controls", () => {
    render(<MarkdownWorkbench {...workbench()} />);

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Draft body", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Words:")).toHaveTextContent("Words: 2");
    expect(screen.queryByLabelText("Markdown formatting tools")).not.toBeInTheDocument();
    for (const label of ["Bold", "Italic", "List", "Code", "Link"]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });

  it("associates a frontmatter error with its editor and disables invalid saves", () => {
    render(<MarkdownWorkbench {...workbench({
      valid: false,
      fieldErrors: { frontmatter: "Frontmatter must be a YAML mapping/object." },
      serverError: "The server rejected this document."
    })} />);

    const frontmatter = screen.getByLabelText("YAML Frontmatter");
    const fieldError = screen.getByText("Frontmatter must be a YAML mapping/object.");
    expect(frontmatter).toHaveAttribute("aria-invalid", "true");
    expect(frontmatter).toHaveAttribute("aria-describedby", fieldError.id);
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeDisabled();
    expect(screen.getByText("The server rejected this document.").closest('[role="alert"]')).toBeInTheDocument();
  });

  it("shows clean and pending states in the editor header", () => {
    const { rerender } = render(<MarkdownWorkbench {...workbench({ dirty: false })} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeDisabled();

    rerender(<MarkdownWorkbench {...workbench({ pending: true })} />);
    expect(screen.getAllByText("Saving…").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save Markdown in progress" })).toBeDisabled();
    expect(screen.getByLabelText("YAML Frontmatter")).toBeDisabled();
    expect(screen.getByLabelText("Markdown Body")).toBeDisabled();
  });

  it("ignores a second submit while the first save is unresolved", async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    render(<MarkdownWorkbench {...workbench({ onSubmit })} />);

    const save = screen.getByRole("button", { name: "Save Markdown" });
    await user.click(save);
    await user.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => resolveSave());
  });
});
