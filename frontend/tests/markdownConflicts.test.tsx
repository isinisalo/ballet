import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ResourceWorkspace } from "../src/orchestration/configure/ResourceWorkspace";
import { MarkdownDirectionWorkspace } from "../src/orchestration/configure/MarkdownDirectionWorkspace";

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

it("keeps a Direction draft tied to its original document hash", () => {
  const value = { id: "goal-1", name: "Goal", status: "draft" as const };
  const document = { kind: "goal" as const, id: value.id, content: "---\nid: goal-1\ntitle: Goal\nstatus: draft\n---\n\n# Original\n", contentHash: "old" };
  const props = { kind: "goals" as const, values: [value], documents: [document], selectedId: value.id, locked: false, navigate: vi.fn(), onSave: vi.fn() };
  const view = render(<MarkdownDirectionWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Markdown Body"), { target: { value: "# My draft" } });
  view.rerender(<MarkdownDirectionWorkspace {...props} documents={[{ ...document, contentHash: "new", content: document.content + "External" }]} />);
  expect(screen.getByRole("button", { name: "Save Markdown" })).toBeDisabled();
  expect(screen.getByLabelText("Markdown Body")).toHaveValue("# My draft");
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

import userEvent from "@testing-library/user-event";
import { useCaseApprovalHash } from "@shared/orchestration/direction";
import { orchestrationConfig } from "./orchestrationFixtures";
import { frontmatterToYaml } from "../src/workspace/documents/frontmatter";

it("approves the persisted Use Case hash only through explicit confirmation", async () => {
  const user = userEvent.setup();
  const value = { ...orchestrationConfig().direction.useCases[0]!, status: "draft" as const, approval: undefined };
  const document = { kind: "use-case" as const, id: value.id, content: `---\n${frontmatterToYaml({ ...value, title: value.name })}\n---\n\n# Use Case\n`, contentHash: "old" };
  const onApprove = vi.fn();
  render(<MarkdownDirectionWorkspace kind="use-cases" values={[value]} documents={[document]} selectedId={value.id} locked={false} navigate={vi.fn()} onSave={vi.fn()} onApprove={onApprove} />);
  await user.click(screen.getByRole("button", { name: "Approve exact content…" }));
  expect(screen.getByRole("dialog")).toHaveTextContent(useCaseApprovalHash(value));
  expect(onApprove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Approve exact content" }));
  expect(onApprove).toHaveBeenCalledWith(value);
  fireEvent.change(screen.getByLabelText("Markdown Body"), { target: { value: "# Changed" } });
  expect(screen.getByRole("button", { name: "Approve exact content…" })).toBeDisabled();
});
