import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pathForBalletMode } from "../src/workspace/balletModeNavigation";
import { BalletModeSelect } from "../src/workspace/layout/BalletModeSelect";

const agents = [{ id: "reviewer", relativePath: ".codex/agents/reviewer.toml" }];

describe("global Ballet mode", () => {
  it("renders Ballet as the trigger with Run and Configure choices", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BalletModeSelect mode="configure" onChange={onChange} />);

    const trigger = screen.getByRole("combobox", { name: "Ballet mode" });
    expect(trigger).toHaveTextContent("Ballet");
    expect(trigger).toHaveClass("bg-transparent", "hover:bg-sidebar-accent", "data-[popup-open]:bg-sidebar-accent");

    await user.click(trigger);
    expect(await screen.findByText("Run", { exact: true })).toBeVisible();
    expect(screen.getByText("Launch and monitor active work", { exact: true })).toBeVisible();
    expect(screen.getByText("Configure", { exact: true })).toBeVisible();
    expect(screen.getByText("Define projects, agents, and automation", { exact: true })).toBeVisible();

    await user.click(screen.getByText("Run", { exact: true }));
    expect(onChange).toHaveBeenCalledWith("run");
  });

  it("preserves selected Loops and agents and sends Configure-only views to overview", () => {
    expect(pathForBalletMode({ route: { view: "automation", automationEntityId: "release" }, nextMode: "run", agents })).toBe("/run/loops/release");
    expect(pathForBalletMode({ route: { view: "loop-theme", loopThemeId: "open-ai", loopThemeLoopId: "release" }, nextMode: "run", agents })).toBe("/run/loops/release");
    expect(pathForBalletMode({ route: { view: "run", runTargetKind: "loop", runTargetId: "release", rootRunId: "root-1" }, nextMode: "configure", agents })).toBe("/automation/loops?id=release");
    expect(pathForBalletMode({ route: { view: "agents", documentPath: ".codex/agents/reviewer.toml" }, nextMode: "run", agents })).toBe("/run/agents/reviewer");
    expect(pathForBalletMode({ route: { view: "run", runTargetKind: "agent", runTargetId: "reviewer" }, nextMode: "configure", agents })).toBe("/agents?path=.codex%2Fagents%2Freviewer.toml");
    expect(pathForBalletMode({ route: { view: "skills" }, nextMode: "run", agents })).toBe("/run");
  });
});
