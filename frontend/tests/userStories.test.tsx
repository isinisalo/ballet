import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UserStoryDocument } from "@shared/orchestration/userStories";
import { ApiRequestError } from "../src/apiClient";
import { UserStoryCard } from "../src/orchestration/user-stories/UserStoryCard";
import { UserStoryEditor } from "../src/orchestration/user-stories/UserStoryEditor";
import { UserStoriesWorkspace } from "../src/orchestration/user-stories/UserStoriesWorkspace";
import { userStoryApi } from "../src/orchestration/user-stories/userStoryApi";
import { useWorkspaceNavigation, useWorkspaceNavigationBlocker } from "../src/workspace/useWorkspaceNavigation";

const saved: UserStoryDocument = { contentHash: "a".repeat(64), value: {
  version: 1, id: "00000000-0000-4000-8000-000000000001", role: "project owner", goal: "to define an outcome", benefit: "the team understands its purpose",
  acceptanceCriteria: [{ given: "a project", when: "I save", then: "the file exists" }, { given: "a saved story", when: "I restart", then: "the story remains" }]
} };
const editorProps = () => ({ locked: false, onDirty: vi.fn(), onBack: vi.fn(), onSaved: vi.fn(), onRemoved: vi.fn(), onRefresh: vi.fn(async () => undefined) });
const fillStory = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("textbox", { name: /Role/ }), "project owner");
  await user.type(screen.getByRole("textbox", { name: /Goal/ }), "to define an outcome");
  await user.type(screen.getByRole("textbox", { name: /Benefit/ }), "the team understands its purpose");
};

describe("User Story authoring", () => {
  it("highlights all three parts and always displays every GIVEN / WHEN / THEN criterion", () => {
    const { container } = render(<UserStoryCard value={saved.value} onEdit={vi.fn()} />);
    expect(container.querySelector(".story-highlight-role")).toHaveTextContent("project owner");
    expect(container.querySelector(".story-highlight-goal")).toHaveTextContent("to define an outcome");
    expect(container.querySelector(".story-highlight-benefit")).toHaveTextContent("the team understands its purpose");
    expect(screen.getAllByText("GIVEN")).toHaveLength(2);
    expect(screen.getAllByText("WHEN")).toHaveLength(2);
    expect(screen.getAllByText("THEN")).toHaveLength(2);
    expect(screen.getByText("the file exists")).toBeVisible();
    expect(screen.getByText("the story remains")).toBeVisible();
  });

  it("creates directly in the colored card and requires complete added criteria", async () => {
    const user = userEvent.setup(); const props = editorProps();
    const save = vi.spyOn(userStoryApi, "save").mockResolvedValue(saved);
    render(<UserStoryEditor {...props} />);
    expect(within(screen.getByRole("list", { name: "User Story color legend" })).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Save story" })).toBeDisabled();
    await fillStory(user);
    expect(screen.getByRole("button", { name: "Save story" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Add acceptance criterion" }));
    expect(screen.getByRole("button", { name: "Save story" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "GIVEN for criterion 1" }), "a project");
    await user.type(screen.getByRole("textbox", { name: "WHEN for criterion 1" }), "I save");
    await user.type(screen.getByRole("textbox", { name: "THEN for criterion 1" }), "the file exists");
    await user.click(screen.getByRole("button", { name: "Save story" }));
    expect(save).toHaveBeenCalledWith({ role: saved.value.role, goal: saved.value.goal, benefit: saved.value.benefit, acceptanceCriteria: [saved.value.acceptanceCriteria[0]] }, undefined);
    expect(props.onSaved).toHaveBeenCalledWith(saved);
  });

  it("removes a criterion without losing the remaining content and allows zero criteria", async () => {
    const user = userEvent.setup(); render(<UserStoryEditor {...editorProps()} current={saved} />);
    await user.click(screen.getByRole("button", { name: "Remove criterion 1" }));
    expect(screen.getByRole("textbox", { name: "GIVEN for criterion 1" })).toHaveValue("a saved story");
    await user.click(screen.getByRole("button", { name: "Remove criterion 1" }));
    expect(screen.queryByRole("textbox", { name: /GIVEN/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save story" })).toBeEnabled();
  });

  it("preserves the local draft after a stale save and reloads only on an explicit discard", async () => {
    const user = userEvent.setup(); const props = editorProps();
    vi.spyOn(userStoryApi, "save").mockRejectedValue(new ApiRequestError("optimistic hash is stale", 409));
    const { rerender } = render(<UserStoryEditor {...props} current={saved} />);
    await user.type(screen.getByRole("textbox", { name: /Role/ }), " with local edits");
    await user.click(screen.getByRole("button", { name: "Save story" }));
    expect(await screen.findByText("optimistic hash is stale")).toBeVisible();
    expect(props.onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Check current file" }));
    expect(props.onRefresh).toHaveBeenCalled();
    const latest = { contentHash: "b".repeat(64), value: { ...saved.value, role: "external reviewer" } };
    rerender(<UserStoryEditor {...props} current={latest} />);
    expect(screen.getByRole("textbox", { name: /Role/ })).toHaveValue("project owner with local edits");
    expect(screen.getByRole("button", { name: "Save story" })).toBeDisabled();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Reload current file" }));
    expect(screen.getByRole("textbox", { name: /Role/ })).toHaveValue("project owner with local edits");
    confirm.mockReturnValue(true); await user.click(screen.getByRole("button", { name: "Reload current file" }));
    expect(screen.getByRole("textbox", { name: /Role/ })).toHaveValue("external reviewer");
    expect(props.onDirty).toHaveBeenLastCalledWith(false);
  });

  it("requires a deliberate deletion and disables authoring during an active Run", async () => {
    const user = userEvent.setup(); const props = editorProps(); const remove = vi.spyOn(userStoryApi, "remove").mockResolvedValue(undefined);
    const { rerender } = render(<UserStoryEditor {...props} current={saved} />);
    await user.click(screen.getByRole("button", { name: "Delete story" }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete story" }));
    expect(remove).toHaveBeenCalledWith(saved);
    expect(props.onRemoved).toHaveBeenCalledWith(saved.value.id);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    rerender(<UserStoryEditor {...props} current={saved} locked />);
    expect(screen.getByRole("textbox", { name: /Role/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save story" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete story" })).toBeDisabled();
  });

  it("uses canonical navigation, guards unsaved edits and focuses the saved story", async () => {
    window.history.replaceState({}, "", "/project/user-stories");
    vi.spyOn(userStoryApi, "list").mockResolvedValue({ stories: [], issues: [] });
    vi.spyOn(userStoryApi, "save").mockResolvedValue(saved);
    const user = userEvent.setup(); render(<WorkspaceHarness />);
    await user.click((await screen.findAllByRole("button", { name: "New user story" }))[0]!);
    expect(window.location.search).toBe("?create=story");
    await fillStory(user);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.location.search).toBe("?create=story");
    await user.click(screen.getByRole("button", { name: "Save story" }));
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(await screen.findByRole("article")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /Edit user story/ }));
    expect(window.location.search).toBe(`?id=${saved.value.id}`);
    expect(screen.getByRole("textbox", { name: /Role/ })).toHaveValue(saved.value.role);
  });

  it("shows invalid files with recovery context while keeping valid stories readable", async () => {
    vi.spyOn(userStoryApi, "list").mockResolvedValue({ stories: [saved], issues: [{ id: "bad", message: "Invalid version" }] });
    render(<UserStoriesWorkspace route={{ view: "orchestration", workspaceView: "user-stories" }} locked={false} navigate={vi.fn()} onDirty={vi.fn()} />);
    expect(await screen.findByText("Invalid User Story file")).toBeVisible();
    expect(screen.getByText(".ballet/user-stories/bad.md")).toBeVisible();
    expect(screen.getByText("the story remains")).toBeVisible();
  });

  it("does not navigate or clear a new view when an earlier save finishes after leaving", async () => {
    const props = editorProps(); const user = userEvent.setup();
    let finish!: (document: UserStoryDocument) => void;
    vi.spyOn(userStoryApi, "save").mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { unmount } = render(<UserStoryEditor {...props} current={saved} />);
    await user.type(screen.getByRole("textbox", { name: /Role/ }), " updated");
    await user.click(screen.getByRole("button", { name: "Save story" }));
    unmount(); props.onDirty.mockClear();
    await act(async () => finish(saved));
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(props.onDirty).not.toHaveBeenCalled();
  });
});

function WorkspaceHarness() {
  const navigation = useWorkspaceNavigation(); const [dirty, setDirty] = useState(false);
  useWorkspaceNavigationBlocker(navigation.setNavigationBlocker, dirty, "Discard unsaved User Story changes?");
  return <UserStoriesWorkspace route={navigation.route} locked={false} navigate={navigation.navigate} onDirty={setDirty} />;
}
