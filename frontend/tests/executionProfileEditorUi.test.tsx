import type { ExecutionProfile, ExecutionProfileSaveRequest } from "@shared/api/workspace-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExecutionProfileEditor } from "../src/workspace/executionProfiles/ExecutionProfileEditor";
import { ExecutionProfilesOverview } from "../src/workspace/executionProfiles/ExecutionProfilesOverview";
import { localProvider, localRuntime } from "./runtimeFixtures";

const profile = (patch: Partial<ExecutionProfile> = {}): ExecutionProfile => ({
  id: "codex-primary",
  name: "Codex primary",
  provider: "codex",
  model: "gpt-test",
  reasoningEffort: "high",
  networkAccess: false,
  ...patch
});

describe("ExecutionProfile editor", () => {
  it("edits and saves only portable runtime intent", async () => {
    const user = userEvent.setup();
    const current = profile();
    const create = vi.fn();
    const update = vi.fn(async (id: string, request: ExecutionProfileSaveRequest) => ({ id, ...request }));
    render(<ExecutionProfileEditor
      profile={current}
      existingProfileIds={[current.id]}
      runtime={localRuntime()}
      create={create}
      update={update}
      remove={vi.fn(async () => undefined)}
    />);

    expect(screen.getByRole("heading", { name: current.name })).toBeInTheDocument();
    expect(screen.getByText(current.id)).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toHaveTextContent("codex");
    expect(screen.getByLabelText("Model")).toHaveTextContent("GPT Test");
    expect(screen.getByLabelText("Reasoning effort")).toHaveTextContent("high");
    expect(screen.queryByLabelText("Instructions")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Skills")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace access")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Codex delivery");
    await user.click(screen.getByRole("switch", { name: "Network access" }));
    await user.click(screen.getByRole("button", { name: "Save execution profile" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(current.id, {
      name: "Codex delivery",
      provider: "codex",
      model: "gpt-test",
      reasoningEffort: "high",
      networkAccess: true
    }));
    expect(create).not.toHaveBeenCalled();
  });

  it("generates a canonical id and requires every runtime field for a new profile", async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (id: string, request: ExecutionProfileSaveRequest) => ({ id, ...request }));
    const update = vi.fn();
    render(<ExecutionProfileEditor
      existingProfileIds={[]}
      runtime={localRuntime()}
      create={create}
      update={update}
      remove={vi.fn(async () => undefined)}
    />);

    const saveButton = screen.getByRole("button", { name: "Save execution profile" });
    expect(screen.getByText("New execution profile")).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Delivery / Primary");
    expect(screen.getByText("delivery-primary")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Provider"));
    await user.click(await screen.findByRole("option", { name: "codex" }));
    await user.click(screen.getByLabelText("Model"));
    await user.click(await screen.findByRole("option", { name: "GPT Test" }));
    await user.click(screen.getByLabelText("Reasoning effort"));
    await user.click(await screen.findByRole("option", { name: "high" }));
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    await waitFor(() => expect(create).toHaveBeenCalledWith("delivery-primary", expect.objectContaining({
      name: "Delivery / Primary",
      provider: "codex",
      model: "gpt-test",
      reasoningEffort: "high"
    })));
    expect(update).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions while a save is pending", async () => {
    let resolveSave: ((saved: ExecutionProfile) => void) | undefined;
    const update = vi.fn(() => new Promise<ExecutionProfile>((resolve) => { resolveSave = resolve; }));
    const current = profile();
    render(<ExecutionProfileEditor
      profile={current}
      existingProfileIds={[current.id]}
      runtime={localRuntime()}
      create={vi.fn()}
      update={update}
      remove={vi.fn(async () => undefined)}
    />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed profile" } });
    const form = screen.getByLabelText("Name").closest("form");
    if (!form) throw new Error("Expected profile fields inside a form.");
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save execution profile in progress" })).toBeDisabled();
    resolveSave?.(profile({ name: "Changed profile" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save execution profile" })).toBeDisabled());
  });

  it("does not attach runtime availability to an unrelated field", () => {
    render(<ExecutionProfileEditor
      profile={profile()}
      existingProfileIds={[profile().id]}
      runtime={localRuntime({ providers: [] })}
      create={vi.fn()}
      update={vi.fn()}
      remove={vi.fn()}
    />);

    expect(screen.getByText("Provider codex is unavailable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Reasoning effort")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save execution profile" })).toBeDisabled();
  });
});

describe("ExecutionProfile creation validation", () => {
  it("blocks a generated id collision next to Name before create", async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    render(<ExecutionProfileEditor
      existingProfileIds={["delivery-primary"]}
      runtime={localRuntime()}
      create={create}
      update={vi.fn()}
      remove={vi.fn()}
    />);

    await user.type(screen.getByLabelText("Name"), "Delivery / Primary");

    const name = screen.getByLabelText("Name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("An execution profile with ID delivery-primary already exists.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save execution profile" })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("ExecutionProfile overview", () => {
  it("navigates to create and edit routes and discloses availability", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const unavailable = profile({ id: "copilot-review", name: "Copilot review", provider: "copilot" });
    render(<ExecutionProfilesOverview
      profiles={[profile(), unavailable]}
      runtime={localRuntime({ providers: [localProvider()] })}
      navigate={navigate}
    />);

    const grid = screen.getByLabelText("Execution profiles");
    const buttons = within(grid).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName("Add execution profile");
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Provider copilot is unavailable.")).toBeInTheDocument();

    await user.click(buttons[0]!);
    expect(navigate).toHaveBeenCalledWith("/execution-profiles?new=1");
    await user.click(screen.getByRole("button", { name: "Open execution profile Codex primary" }));
    expect(navigate).toHaveBeenCalledWith("/execution-profiles?id=codex-primary");
  });
});
