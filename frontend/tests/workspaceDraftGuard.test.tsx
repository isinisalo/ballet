import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OrchestrationWorkspaceShell } from "../src/orchestration/OrchestrationWorkspaceShell";
import { orchestrationApi } from "../src/orchestration/orchestrationApi";
import { orchestrationConfig } from "./orchestrationFixtures";

const stream = vi.hoisted(() => ({ refresh: undefined as (() => Promise<unknown>) | undefined }));
vi.mock("../src/orchestration/invalidationStream", () => ({ subscribeInvalidations: (refresh: () => Promise<unknown>) => {
  stream.refresh = refresh;
  return () => { stream.refresh = undefined; };
} }));

it("guards actual Markdown changes, preserves them on refresh failure and clears after reverting", async () => {
  const config = orchestrationConfig();
  const project = vi.spyOn(orchestrationApi, "project").mockResolvedValue({ config, configHash: "hash", path: "project" });
  vi.spyOn(orchestrationApi, "references").mockResolvedValue({ entries: [], runReferences: [], activeRunIds: [] });
  vi.spyOn(orchestrationApi, "resources").mockResolvedValue([{ kind: "skill", id: "sample", content: "# Original\n", contentHash: "old" }]);
  const setNavigationBlocker = vi.fn();
  render(<OrchestrationWorkspaceShell route={{ view: "orchestration", workspaceView: "skills", entityId: "sample" }} navigate={vi.fn()} setNavigationBlocker={setNavigationBlocker} />);
  const body = await screen.findByLabelText("Markdown Body");
  fireEvent.click(body);
  expect(setNavigationBlocker).toHaveBeenLastCalledWith(expect.objectContaining({ isDirty: false }));
  fireEvent.change(body, { target: { value: "# Draft" } });
  await waitFor(() => expect(setNavigationBlocker).toHaveBeenLastCalledWith(expect.objectContaining({ isDirty: true })));
  project.mockRejectedValue(new Error("Temporary refresh failure"));
  await act(async () => { await stream.refresh?.(); });
  expect(screen.getByText("Temporary refresh failure")).toBeInTheDocument();
  expect(screen.getByLabelText("Markdown Body")).toHaveValue("# Draft");
  fireEvent.change(body, { target: { value: "# Original\n" } });
  await waitFor(() => expect(setNavigationBlocker).toHaveBeenLastCalledWith(expect.objectContaining({ isDirty: false })));
});
