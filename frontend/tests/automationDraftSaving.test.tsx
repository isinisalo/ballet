import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes, type ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { useAutomationDraft } from "../src/workspace/automation/useAutomationDraft";

const config = (id?: string): ProjectAutomationConfig => ({
  version: 8,
  loops: id ? [{
    id,
    start: "first",
    nodes: [{
      id: "first",
      type: "human",
      nodeStyle: "flat",
      nodeSize: "medium",
      description: "Review",
      on: { approved: { action: "goto", target: "completed", input: "append-signal" }, rejected: { action: "goto", target: "blocked", input: "append-signal" } }
    }, ...defaultTerminalNodes()]
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
