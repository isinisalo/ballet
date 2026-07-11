import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pathForBalletMode } from "../src/workspace/balletModeNavigation";
import { BalletModeSelect } from "../src/workspace/layout/BalletModeSelect";

const agents = [{ id: "reviewer", relativePath: ".codex/agents/reviewer.toml" }];

describe("global Ballet mode", () => {
  it("renders one global dropdown with Configure and Run choices", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BalletModeSelect mode="configure" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Ballet mode" }));
    await user.click(await screen.findByRole("option", { name: "Ballet Run" }));
    expect(onChange).toHaveBeenCalledWith("run");
  });

  it("preserves selected Loops and agents and sends Configure-only views to overview", () => {
    expect(pathForBalletMode({ route: { view: "automation", automationEntityId: "release" }, nextMode: "run", agents })).toBe("/run/loops/release");
    expect(pathForBalletMode({ route: { view: "run", runTargetKind: "loop", runTargetId: "release", rootRunId: "root-1" }, nextMode: "configure", agents })).toBe("/automation/loops?id=release");
    expect(pathForBalletMode({ route: { view: "agents", documentPath: ".codex/agents/reviewer.toml" }, nextMode: "run", agents })).toBe("/run/agents/reviewer");
    expect(pathForBalletMode({ route: { view: "run", runTargetKind: "agent", runTargetId: "reviewer" }, nextMode: "configure", agents })).toBe("/agents?path=.codex%2Fagents%2Freviewer.toml");
    expect(pathForBalletMode({ route: { view: "skills" }, nextMode: "run", agents })).toBe("/run");
  });
});
