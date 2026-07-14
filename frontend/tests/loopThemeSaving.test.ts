import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultLoopTheme, type LoopTheme } from "@shared/api/workspace-contracts";
import { useLoopThemeEditor } from "../src/workspace/automation/themes/useLoopThemeEditor";

describe("Loop theme saving", () => {
  it("coalesces concurrent save attempts into one request", async () => {
    const source = structuredClone(defaultLoopTheme);
    let finishSave!: () => void;
    const updateTheme = vi.fn((theme: LoopTheme) => new Promise<LoopTheme>((resolve) => { finishSave = () => resolve(theme); }));
    const { result } = renderHook(() => useLoopThemeEditor({
      source,
      updateTheme
    }));

    act(() => result.current.setColor("edge.color", "#abcdef"));
    let firstSave!: Promise<LoopTheme | undefined>;
    let secondSave!: Promise<LoopTheme | undefined>;
    act(() => {
      firstSave = result.current.save();
      secondSave = result.current.save();
    });

    expect(updateTheme).toHaveBeenCalledTimes(1);
    await expect(secondSave).resolves.toBeUndefined();
    finishSave();
    await expect(firstSave).resolves.toBeDefined();
  });

  it("preserves a newer theme edit when an older save completes", async () => {
    const source = structuredClone(defaultLoopTheme);
    let finishSave!: () => void;
    const updateTheme = vi.fn((theme: LoopTheme) => new Promise<LoopTheme>((resolve) => { finishSave = () => resolve(theme); }));
    const { result } = renderHook(() => useLoopThemeEditor({
      source,
      updateTheme
    }));

    act(() => result.current.setColor("edge.color", "#abcdef"));
    let save!: Promise<LoopTheme | undefined>;
    act(() => { save = result.current.save(); });
    act(() => result.current.setColor("edge.color", "#123456"));
    await act(async () => {
      finishSave();
      await save;
    });

    expect(result.current.draft.edge.color).toBe("#123456");
    expect(result.current.dirty).toBe(true);
  });
});
