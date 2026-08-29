import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceNavigation } from "../src/workspace/useWorkspaceNavigation";

describe("canonical workspace navigation blocker", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/automation/loops");
  });

  it("confirms and blocks internal navigation while authoring is dirty", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.setNavigationBlocker({ isDirty: true, message: "Discard Environment changes?" }));
    act(() => result.current.navigate("/run"));
    expect(confirm).toHaveBeenCalledWith("Discard Environment changes?");
    expect(window.location.pathname).toBe("/automation/loops");
    expect(result.current.route).toMatchObject({ workspaceView: "environment" });

    confirm.mockReturnValue(true);
    act(() => result.current.navigate("/run"));
    expect(window.location.pathname).toBe("/run");
    expect(result.current.route).toMatchObject({ workspaceView: "run-list" });
  });

  it("allows a post-save navigation without asking to discard", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.setNavigationBlocker({ isDirty: true }));
    act(() => result.current.navigate("/feedback", { bypassBlocker: true }));
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.route).toMatchObject({ workspaceView: "feedback-list" });
  });

  it("restores canonical deep links through browser back and forward", async () => {
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.navigate("/automation/loops/states/build"));
    expect(result.current.route).toMatchObject({ workspaceView: "state", stateId: "build" });

    await act(async () => {
      const traversed = waitForPopStates(1);
      window.history.back();
      await traversed;
    });
    expect(result.current.route).toMatchObject({ workspaceView: "environment" });

    await act(async () => {
      const traversed = waitForPopStates(1);
      window.history.forward();
      await traversed;
    });
    expect(result.current.route).toMatchObject({ workspaceView: "state", stateId: "build" });
  });

  it("restores a cancelled history traversal without losing the stack", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.navigate("/feedback"));
    act(() => result.current.navigate("/run"));
    act(() => result.current.setNavigationBlocker({ isDirty: true }));

    await act(async () => {
      const restored = waitForPopStates(2);
      window.history.back();
      await restored;
    });
    expect(window.location.pathname).toBe("/run");
    expect(result.current.route).toMatchObject({ workspaceView: "run-list" });

    confirm.mockReturnValue(true);
    await act(async () => {
      const traversed = waitForPopStates(1);
      window.history.back();
      await traversed;
    });
    expect(result.current.route).toMatchObject({ workspaceView: "feedback-list" });
  });

  it("prevents unload only while the workspace is dirty", () => {
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.setNavigationBlocker({ isDirty: true }));
    const blocked = new Event("beforeunload", { cancelable: true });
    act(() => window.dispatchEvent(blocked));
    expect(blocked.defaultPrevented).toBe(true);

    act(() => result.current.setNavigationBlocker(null));
    const clean = new Event("beforeunload", { cancelable: true });
    act(() => window.dispatchEvent(clean));
    expect(clean.defaultPrevented).toBe(false);
  });
});

const waitForPopStates = (count: number): Promise<void> => new Promise((resolve) => {
  let remaining = count;
  const onPopState = () => {
    remaining -= 1;
    if (remaining > 0) return;
    window.removeEventListener("popstate", onPopState);
    resolve();
  };
  window.addEventListener("popstate", onPopState);
});
