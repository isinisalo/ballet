import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceNavigation } from "../src/workspace/useWorkspaceNavigation";

describe("workspace navigation blocker", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/automation/loops?view=all");
  });

  it("confirms and blocks internal navigation while the workspace is dirty", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useWorkspaceNavigation());

    act(() => result.current.setNavigationBlocker({ isDirty: true, message: "Discard theme changes?" }));
    act(() => result.current.navigate("/agents"));

    expect(confirm).toHaveBeenCalledWith("Discard theme changes?");
    expect(window.location.pathname).toBe("/automation/loops");
    expect(result.current.route).toEqual({ view: "automation", automationLoopView: "all" });

    confirm.mockReturnValue(true);
    act(() => result.current.navigate("/agents"));
    expect(window.location.pathname).toBe("/agents");
    expect(result.current.route).toEqual({ view: "agents", documentPath: undefined });
  });

  it("restores a cancelled history traversal without losing the back/forward stack", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.navigate("/skills"));
    act(() => result.current.navigate("/agents"));
    act(() => result.current.setNavigationBlocker({ isDirty: true }));

    await act(async () => {
      const restored = waitForPopStates(2);
      window.history.back();
      await restored;
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/agents");
    expect(result.current.route).toEqual({ view: "agents", documentPath: undefined });

    confirm.mockReturnValue(true);
    await act(async () => {
      const traversed = waitForPopStates(1);
      window.history.back();
      await traversed;
    });
    expect(window.location.pathname).toBe("/skills");
    expect(result.current.route).toEqual({ view: "skills", documentPath: undefined });

    await act(async () => {
      const traversed = waitForPopStates(1);
      window.history.forward();
      await traversed;
    });
    expect(window.location.pathname).toBe("/agents");
    expect(result.current.route).toEqual({ view: "agents", documentPath: undefined });
  });

  it("accepts browser history navigation after confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.setNavigationBlocker({ isDirty: true }));

    act(() => {
      window.history.pushState({}, "", "/skills");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.route).toEqual({ view: "skills", documentPath: undefined });
  });

  it("prevents unload only while the registered workspace is dirty", () => {
    const { result } = renderHook(() => useWorkspaceNavigation());
    act(() => result.current.setNavigationBlocker({ isDirty: true }));

    const blockedEvent = new Event("beforeunload", { cancelable: true });
    act(() => window.dispatchEvent(blockedEvent));
    expect(blockedEvent.defaultPrevented).toBe(true);

    act(() => result.current.setNavigationBlocker(null));
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    act(() => window.dispatchEvent(cleanEvent));
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});

function waitForPopStates(count: number) {
  return new Promise<void>((resolve) => {
    let received = 0;
    const onPopState = () => {
      received += 1;
      if (received < count) return;
      window.removeEventListener("popstate", onPopState);
      resolve();
    };
    window.addEventListener("popstate", onPopState);
  });
}
