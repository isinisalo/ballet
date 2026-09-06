import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ResourceWorkspace } from "../src/orchestration/configure/ResourceWorkspace";
import { ProjectMarkdownWorkspace } from "../src/orchestration/configure/ProjectMarkdownWorkspace";

it("preserves a resource draft and blocks stale saves until explicit reload", async () => {
  const resource = { kind: "skill" as const, id: "sample", content: "# Original\n", contentHash: "old" };
  const onSave = vi.fn(); const props = { kind: "skills" as const, resources: [resource], references: [], locked: false, selectedId: "sample", navigate: vi.fn(), onSave };
  const view = render(<ResourceWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Markdown Body"), { target: { value: "# My draft" } });
  view.rerender(<ResourceWorkspace {...props} resources={[{ ...resource, content: "# External\n", contentHash: "new" }]} />);
  expect(screen.getByLabelText("Markdown Body")).toHaveValue("# My draft");
  expect(screen.getByRole("button", { name: "Save Markdown" })).toBeDisabled();
  expect(onSave).not.toHaveBeenCalled();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload current file" }));
  expect(screen.getByLabelText("Markdown Body")).toHaveValue("# External\n");
});

it("keeps an ADR draft tied to its original document hash", () => {
  const document = { kind: "adr" as const, id: "adr-1", content: "---\nid: adr-1\ntitle: Decision\nstatus: draft\n---\n\n# Original\n", contentHash: "old" };
  const props = { kind: "adrs" as const, documents: [document], selectedId: document.id, navigate: vi.fn(), onSave: vi.fn() };
  const view = render(<ProjectMarkdownWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Markdown Body"), { target: { value: "# My draft" } });
  view.rerender(<ProjectMarkdownWorkspace {...props} documents={[{ ...document, contentHash: "new", content: document.content + "External" }]} />);
  expect(screen.getByRole("button", { name: "Save Markdown" })).toBeDisabled();
  expect(screen.getByLabelText("Markdown Body")).toHaveValue("# My draft");
});

it("keeps the new ADR editor open when Create clears an existing selection", () => {
  const document = { kind: "adr" as const, id: "adr-1", content: "---\nid: adr-1\ntitle: Decision\n---\n# Original\n", contentHash: "old" };
  const props = { kind: "adrs" as const, documents: [document], navigate: vi.fn(), onSave: vi.fn() };
  const view = render(<ProjectMarkdownWorkspace {...props} selectedId="adr-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  view.rerender(<ProjectMarkdownWorkspace {...props} />);
  expect((screen.getByLabelText("YAML Frontmatter") as HTMLTextAreaElement).value).toContain("title: New ADR");
  expect(props.navigate).toHaveBeenCalledWith("/project/adrs");
});

it("retains the dirty resource after a failed save and adopts the returned baseline after success", async () => {
  const resource = { kind: "skill" as const, id: "sample", content: "# Original\n", contentHash: "old" };
  const save = vi.fn().mockRejectedValueOnce(new Error("Write failed")).mockResolvedValueOnce({ ...resource, content: "# Draft\n", contentHash: "saved" });
  render(<ResourceWorkspace kind="skills" resources={[resource]} references={[]} locked={false} selectedId="sample" navigate={vi.fn()} onSave={save} />);
  fireEvent.change(screen.getByLabelText("Markdown Body"), { target: { value: "# Draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Markdown" }));
  await screen.findByText("Write failed");
  expect(screen.getByRole("button", { name: "Save Markdown" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Save Markdown" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save Markdown" })).toBeDisabled());
});
