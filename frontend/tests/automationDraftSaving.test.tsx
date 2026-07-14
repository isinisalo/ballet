import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { useAutomationDraft } from "../src/workspace/automation/useAutomationDraft";

const config = (id?: string): ProjectAutomationConfig => ({
  version: 7,
  loops: id ? [{
    id,
    start: "first",
    steps: [{
      id: "first",
      type: "human",
      nodeStyle: "flat",
      description: "Review",
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    }]
  }] : []
});

describe("automation draft saving", () => {
  it("preserves a newer Loop edit when an older save completes", async () => {
    let finishSave!: () => void;
    const saveAutomation = vi.fn((submitted: ProjectAutomationConfig) => new Promise<ProjectAutomationConfig>((resolve) => {
      finishSave = () => resolve(submitted);
    }));
    const { result } = renderHook(() => useAutomationDraft({ automation: config(), saveAutomation }));
    const submitted = config("submitted");

    act(() => result.current.setDraft(submitted));
    let save!: Promise<boolean>;
    act(() => { save = result.current.saveDraft(); });
    act(() => result.current.setDraft(config("edited-while-saving")));
    await act(async () => {
      finishSave();
      await save;
    });

    expect(result.current.draft.loops[0]?.id).toBe("edited-while-saving");
    expect(result.current.isDirty).toBe(true);
  });
});
