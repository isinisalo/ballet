import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ActionDefinition } from "@shared/orchestration/environment";
import { ActionFlow } from "../src/orchestration/configure/ActionFlow";
import { LoopEngineeringCanvas } from "../src/orchestration/configure/LoopEngineeringCanvas";
import { projectActionFlow } from "../src/orchestration/configure/actionFlowProjection";
import { projectLoopEngineering } from "../src/orchestration/configure/loopEngineeringProjection";
import { orchestrationConfig } from "./orchestrationFixtures";

const loopEngineeringCanvasCss = readFileSync(
  join(process.cwd(), "frontend/src/orchestration/configure/LoopEngineeringCanvas.css"),
  "utf8",
);

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
      ["sol", 32], ["terra", 28], ["terra", 28], ["luna", 24],
    ]);
    expect(first.states.map(({ x }) => x)).toEqual([...first.states.map(({ x }) => x)].sort((a, b) => a - b));
    expect(new Set(first.states.map(({ y }) => y)).size).toBe(1);
    expect(new Set(first.actions.map(({ x }) => x))).toEqual(new Set([first.states[0]!.x]));
    expect(first.actions.map(({ y }) => y)).toEqual([...first.actions.map(({ y }) => y)].sort((a, b) => a - b));
    expect(first.actions.find(({ id }) => id === "action-3")?.selected).toBe(true);
    expect(first.edges.find(({ id }) => id === "action:action-1:to:action-2")).toMatchObject({
      path: `M${first.actions[0]!.x} ${first.actions[0]!.y + first.actions[0]!.size / 2 + 4} L${first.actions[1]!.x} ${first.actions[1]!.y - first.actions[1]!.size / 2 - 4}`,
      points: [
        { x: first.actions[0]!.x, y: first.actions[0]!.y + first.actions[0]!.size / 2 + 4 },
        { x: first.actions[1]!.x, y: first.actions[1]!.y - first.actions[1]!.size / 2 - 4 },
      ],
    });
    expect(first.edges.find(({ tone }) => tone === "state")?.points).toEqual([
      { x: first.states[0]!.x + first.states[0]!.width / 2 + 4, y: first.states[0]!.y },
      { x: first.states[1]!.x - first.states[1]!.width / 2 - 4, y: first.states[1]!.y },
    ]);
  });

  it("keeps large Action sets separated inside a taller internal stage", () => {
    const projection = projectLoopEngineering(environmentWithActions(14), "state-1");
    expect(projection.height).toBeGreaterThan(800);
    projection.actions.slice(1).forEach((action, index) => {
      const previous = projection.actions[index]!;
      expect(action.x).toBe(previous.x);
      expect(action.y - previous.y).toBeGreaterThanOrEqual(44);
    });
  });

  it("fits the canonical five-State and twelve-Action desktop surface without internal scroll", () => {
    const projection = projectLoopEngineering(environmentWithStatesAndActions(5, 12), "state-1", undefined, { width: 590, height: 811 });
    expect(projection).toMatchObject({ width: 590, height: 811 });
    expect(projection.states).toHaveLength(5);
    expect(projection.actions).toHaveLength(12);
  });

  it("fills a measured surface while keeping every projected node in bounds", () => {
    const projection = projectLoopEngineering(environmentWithActions(4), "state-1", undefined, { width: 1100, height: 680 });
    expect(projection).toMatchObject({ width: 1100, height: 680 });
    projection.states.forEach(({ x, y }) => {
      expect(x).toBeGreaterThanOrEqual(22);
      expect(y).toBeGreaterThanOrEqual(22);
      expect(x).toBeLessThanOrEqual(projection.width - 22);
      expect(y).toBeLessThanOrEqual(projection.height - 22);
    });
    projection.actions.forEach(({ x, y }) => {
      expect(x - 22).toBeGreaterThanOrEqual(0);
      expect(y - 22).toBeGreaterThanOrEqual(0);
      expect(x + 22).toBeLessThanOrEqual(projection.width);
      expect(y + 22).toBeLessThanOrEqual(projection.height);
    });
  });

  it("keeps the State row compact instead of stretching it across available width", () => {
    const environment = environmentWithActions(2);
    const compact = projectLoopEngineering(environment, "state-1", undefined, { width: 900, height: 760 });
    expect(compact.states[1]!.x - compact.states[0]!.x).toBe(112);
    expect(new Set(compact.states.map(({ y }) => y).values()).size).toBe(1);
    expect(compact.height).toBe(760);
  });

  it("opens States and Actions with keyboard-activatable canonical controls", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const openFlow = vi.fn();
    render(<LoopEngineeringCanvas environment={environmentWithActions(3)} selectedStateId="state-1" selectedActionId="action-2" navigate={navigate} onActionFlowOpen={openFlow} />);

    const state = screen.getByRole("button", { name: "Open State state-2: Verify" });
    const action = screen.getByRole("button", { name: "Open Action action-2: Action 2" });
    expect(action).toHaveAttribute("aria-pressed", "true");
    expect(state).toHaveTextContent(/^state-2$/);
    expect(state).not.toHaveTextContent("STATE 2");
    expect(state).not.toHaveTextContent("Verify");
    state.focus();
    await user.keyboard("{Enter}");
    action.focus();
    await user.keyboard(" ");
    expect(navigate).toHaveBeenNthCalledWith(1, "/automation/loops/states/state-2");
    expect(navigate).toHaveBeenNthCalledWith(2, "/automation/loops/states/state-1/actions/action-2");
    expect(action).toHaveTextContent("action-2");
    expect(action.querySelector("code")).toHaveAttribute("data-placement", "right");
    expect(action).not.toHaveTextContent("PRIORITY");
    expect(action).not.toHaveTextContent("Action 2");
    await user.dblClick(action);
    expect(openFlow).toHaveBeenCalledWith("state-1", "action-2");
  });

  it("aligns every rendered Action planet and edge on the same projected center", () => {
    const environment = environmentWithActions(3);
    const projection = projectLoopEngineering(environment, "state-1");
    render(<LoopEngineeringCanvas environment={environment} selectedStateId="state-1" navigate={vi.fn()} />);
    projection.actions.forEach((node) => {
      expect(screen.getByRole("button", { name: `Open Action ${node.id}: ${node.name}` })).toHaveStyle({
        left: `${node.x}px`, top: `${node.y}px`, width: "44px", height: "44px",
      });
    });
    const first = projection.actions[0]!;
    expect(projection.edges.find(({ id }) => id === "state:state-1:actions")?.points.at(-1)).toEqual({ x: first.x, y: first.y - first.size / 2 - 4 });
  });

  it("centers the Action artwork inside its projected edge-anchor hitbox", () => {
    expect(loopEngineeringCanvasCss).toMatch(
      /\.loop-engineering-action\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/s,
    );
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

  it("scales deterministically to the complete measured grid surface", () => {
    const first = projectActionFlow({ width: 920, height: 640 });
    const second = projectActionFlow({ width: 920, height: 640 });
    expect(second).toEqual(first);
    expect(first).toMatchObject({ width: 920, height: 640 });
    Object.values(first.points).forEach(({ x, y }) => {
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect(x).toBeLessThan(first.width);
      expect(y).toBeLessThan(first.height);
    });
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

function environmentWithStatesAndActions(stateCount: number, actionCount: number) {
  const environment = environmentWithActions(actionCount);
  const template = environment.states[0]!;
  environment.states = Array.from({ length: stateCount }, (_, index) => ({
    ...structuredClone(template),
    id: `state-${index + 1}`,
    name: `State ${index + 1}`,
    order: index + 1,
  }));
  return environment;
}
