import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRefreshSafeDraft } from "../src/workspace/useRefreshSafeDraft";

describe("refresh-safe drafts", () => {
  it("keeps local edits across refreshes and resets when the selected entity changes", () => {
    const { result, rerender } = renderHook(
      ({ source, identity }) => useRefreshSafeDraft(source, identity),
      { initialProps: { source: { name: "Saved" }, identity: "one" } }
    );

    act(() => result.current.setDraft({ name: "Local edit" }));
    rerender({ source: { name: "Refreshed" }, identity: "one" });
    expect(result.current.draft.name).toBe("Local edit");
    expect(result.current.dirty).toBe(true);

    rerender({ source: { name: "Other" }, identity: "two" });
    expect(result.current.draft.name).toBe("Other");
    expect(result.current.dirty).toBe(false);
  });

  it("accepts a saved draft as the new clean state", () => {
    const { result } = renderHook(() => useRefreshSafeDraft({ name: "Saved" }, "one"));
    act(() => result.current.setDraft({ name: "Local edit" }));
    act(() => result.current.accept({ name: "Persisted" }));
    expect(result.current.draft.name).toBe("Persisted");
    expect(result.current.dirty).toBe(false);
  });
});
