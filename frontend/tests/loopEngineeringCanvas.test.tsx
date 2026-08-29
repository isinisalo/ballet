import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionDefinition } from "@shared/orchestration/environment";
import { ActionFlow } from "../src/orchestration/configure/ActionFlow";
import { LoopEngineeringCanvas } from "../src/orchestration/configure/LoopEngineeringCanvas";
import { projectActionFlow } from "../src/orchestration/configure/actionFlowProjection";
import { projectLoopEngineering } from "../src/orchestration/configure/loopEngineeringProjection";
import { orchestrationConfig } from "./orchestrationFixtures";

describe("Loop Engineering space canvas", () => {
  it("projects State and selected Action order deterministically", () => {
    const environment = environmentWithActions(4);
    environment.states.reverse();
    const first = projectLoopEngineering(environment, "state-1", "action-3");
    const second = projectLoopEngineering(environment, "state-1", "action-3");

    expect(second).toEqual(first);
    expect(first.states.map(({ id, order }) => [id, order])).toEqual([["state-1", 1], ["state-2", 2]]);
    expect(first.actions.map(({ id, priority }) => [id, priority])).toEqual([
      ["action-1", 1], ["action-2", 2], ["action-3", 3], ["action-4", 4],
    ]);
    expect(first.actions.map(({ artwork, size }) => [artwork, size])).toEqual([
      ["sol", 84], ["terra", 64], ["terra", 64], ["station", 48],
    ]);
    expect(first.actions.find(({ id }) => id === "action-3")?.selected).toBe(true);
  });

  it("keeps large Action sets separated inside a wider internal stage", () => {
    const projection = projectLoopEngineering(environmentWithActions(14), "state-1");
    expect(projection.width).toBeGreaterThan(2500);
    projection.actions.slice(1).forEach((action, index) => {
      const previous = projection.actions[index]!;
      expect(action.x - previous.x).toBeGreaterThan((action.size + previous.size) / 2);
    });
  });

  it("opens States and Actions with keyboard-activatable canonical controls", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<LoopEngineeringCanvas environment={environmentWithActions(3)} selectedStateId="state-1" selectedActionId="action-2" navigate={navigate} />);

    const state = screen.getByRole("button", { name: "Open State state-2: Verify" });
    const action = screen.getByRole("button", { name: "Open Action action-2: Action 2" });
    expect(action).toHaveAttribute("aria-pressed", "true");
    state.focus();
    await user.keyboard("{Enter}");
    action.focus();
    await user.keyboard(" ");
    expect(navigate).toHaveBeenNthCalledWith(1, "/automation/loops/states/state-2");
    expect(navigate).toHaveBeenNthCalledWith(2, "/automation/loops/states/state-1/actions/action-2");
  });
});

describe("industrial Validation-led Action flow", () => {
  it("keeps the controller, subordinate Work loop and terminal routes explicit", () => {
    const projection = projectActionFlow();
    expect(projection.edges.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "start-validation", "work-validation", "done-complete", "done-retry", "retry-work", "retry-blocked", "retry-count",
    ]));
    expect(projection.edges.find(({ id }) => id === "retry-work")).toMatchObject({ tone: "attention", dashed: true });
    expect(projection.edges.find(({ id }) => id === "retry-blocked")?.tone).toBe("fail");
  });

  it("retains initial delegation while explaining a zero postwork retry budget", () => {
    const action = { ...environmentWithActions(1).states[0]!.actions[0]!, maxRetries: 0 };
    render(<ActionFlow action={action} />);
    expect(screen.getByText("Validation · main controller")).toBeInTheDocument();
    expect(screen.getByText("Work · subordinate")).toBeInTheDocument();
    expect(screen.getByText("0 additional retries")).toBeInTheDocument();
    expect(screen.getByText("1 total Work attempts")).toBeInTheDocument();
    expect(document.querySelector('[data-dashed="true"]')).toBeInTheDocument();
  });
});

function environmentWithActions(count: number) {
  const environment = structuredClone(orchestrationConfig().environment);
  const template = environment.states[0]!.actions[0]!;
  environment.states[0]!.actions = Array.from({ length: count }, (_, index): ActionDefinition => ({
    ...template,
    id: `action-${index + 1}`,
    name: `Action ${index + 1}`,
    priority: index + 1,
  }));
  return environment;
}
