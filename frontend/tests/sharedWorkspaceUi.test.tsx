import { useState, type FormEvent } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog, EditorActions, OperationalStatus, TextField } from "../src/components/shared/workspace-ui";

describe("shared workspace UI", () => {
  it("connects field labels, descriptions, and errors to their controls", () => {
    render(
      <TextField
        label="Agent name"
        description="Used in the workspace index."
        error="Name is required."
        required
        value=""
        onChange={vi.fn()}
      />
    );

    const control = screen.getByLabelText(/Agent name/);
    const description = screen.getByText("Used in the workspace index.");
    const error = screen.getByRole("alert");
    const describedBy = control.getAttribute("aria-describedby")?.split(" ") ?? [];

    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(describedBy).toContain(description.id);
    expect(describedBy).toContain(error.id);
  });

  it("submits editor actions only while the draft is valid and idle", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const { rerender } = render(
      <form id="editor" onSubmit={onSubmit}>
        <EditorActions formId="editor" saveLabel="Save item" dirty valid />
      </form>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save item" }));
    expect(onSubmit).toHaveBeenCalledOnce();

    rerender(
      <form id="editor" onSubmit={onSubmit}>
        <EditorActions formId="editor" saveLabel="Save item" dirty valid pending />
      </form>
    );
    expect(screen.getByRole("button", { name: "Save item in progress" })).toBeDisabled();
  });

  it("animates only the active operational status", () => {
    render(<><OperationalStatus label="Running" tone="active" /><OperationalStatus label="Ready" tone="healthy" /></>);
    expect(screen.getByText("Running").querySelector("[data-slot=status-dot]")).toHaveClass("animate-pulse");
    expect(screen.getByText("Ready").querySelector("[data-slot=status-dot]")).not.toHaveClass("animate-pulse");
  });

  it("closes destructive confirmation with Escape", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(true);
      return <DeleteConfirmDialog open={open} onOpenChange={setOpen} deleteType="agent" resourceName="Dev Agent" onConfirm={vi.fn()} />;
    }

    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Delete agent?" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete agent?" })).not.toBeInTheDocument());
  });

  it("guards destructive confirmation synchronously against double submission", async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<DeleteConfirmDialog open onOpenChange={vi.fn()} deleteType="agent" resourceName="Dev Agent" onConfirm={onConfirm} />);

    const button = screen.getByRole("button", { name: "Delete" });
    act(() => {
      button.click();
      button.click();
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("keeps a destructive dialog open while deletion is pending", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <DeleteConfirmDialog
          open={open}
          onOpenChange={setOpen}
          deleteType="agent"
          onConfirm={() => new Promise<void>((resolve) => { finish = resolve; })}
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete agent?" })).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Delete agent?" })).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete agent?" })).not.toBeInTheDocument());
  });
});
