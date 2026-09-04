import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionDefinition } from "@shared/orchestration/environment";
import { LoopEngineeringCanvas } from "../src/orchestration/configure/LoopEngineeringCanvas";
import { centeredSidePoint, detachedPoint } from "../src/orchestration/configure/FloatingSmoothEdge";
import { projectLoopEngineering } from "../src/orchestration/configure/loopEngineeringProjection";
import { orchestrationConfig } from "./orchestrationFixtures";

const loopEngineeringCanvasCss = readFileSync(
  join(process.cwd(), "frontend/src/orchestration/configure/LoopEngineeringCanvas.css"),
  "utf8",
);
const floatingSmoothEdgeSource = readFileSync(
  join(process.cwd(), "frontend/src/orchestration/configure/FloatingSmoothEdge.tsx"),
  "utf8",
);

describe("Loop Engineering three-level Dagre canvas", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(620);
  });
  afterEach(() => vi.restoreAllMocks());

  it("projects the selected State, Action and Agent tree with terminal create nodes", () => {
    const projection = projectLoopEngineering(environmentWithActions(3), "state-1", "action-2");
    expect(projection.nodes.map(({ id, kind }) => [id, kind])).toEqual(expect.arrayContaining([
      ["state:state-1", "state"],
      ["create:state", "create-state"],
      ["action:action-1", "action"],
      ["create:action:state-1", "create-action"],
      ["agent:action-2:validation", "validation-agent"],
      ["agent:action-2:work", "work-agent"],
    ]));
    expect(projection.nodes.at(-1)).toMatchObject({ id: "agent:action-2:work" });
  });

  it("keeps State order, Action priority and left-to-right ranks deterministic", () => {
    const environment = environmentWithActions(4);
    environment.states.reverse();
    const first = projectLoopEngineering(environment, "state-1", "action-3");
    const second = projectLoopEngineering(environment, "state-1", "action-3");
    expect(second).toEqual(first);
    const states = first.nodes.filter(({ kind }) => kind === "state");
    const actions = first.nodes.filter(({ kind }) => kind === "action");
    const agents = first.nodes.filter(({ kind }) => kind.endsWith("-agent"));
    expect(states.map(({ entityId }) => entityId)).toEqual(["state-1", "state-2"]);
    expect(actions.map(({ entityId }) => entityId)).toEqual(["action-1", "action-2", "action-3", "action-4"]);
    expect(states.map(({ y }) => y)).toEqual([...states.map(({ y }) => y)].sort((a, b) => a - b));
    expect(actions.map(({ y }) => y)).toEqual([...actions.map(({ y }) => y)].sort((a, b) => a - b));
    expect(actions[0]!.x).toBeGreaterThan(states[0]!.x);
    expect(agents[0]!.x).toBeGreaterThan(actions[0]!.x);
    expect(actions.find(({ entityId }) => entityId === "action-3")?.selected).toBe(true);
  });

  it("leaves generous vertical and horizontal space between node rectangles", () => {
    const projection = projectLoopEngineering(environmentWithActions(4), "state-1", "action-2");
    const states = projection.nodes.filter(({ kind }) => kind === "state" || kind === "create-state");
    const actions = projection.nodes.filter(({ kind }) => kind === "action" || kind === "create-action");
    expect(states[1]!.y - states[0]!.y).toBeGreaterThanOrEqual(states[0]!.height + 28);
    expect(actions[0]!.x - states[0]!.x).toBeGreaterThanOrEqual(states[0]!.width + 136);
    const selectedState = states.find(({ selected }) => selected)!;
    const actionCenters = actions.map(({ y, height }) => y + height / 2);
    expect(selectedState.y + selectedState.height / 2).toBe((actionCenters[0]! + actionCenters.at(-1)!) / 2);
  });

  it("keeps the selected State branch visible and routes cross-rank edges with a light smooth curve", () => {
    const stateProjection = projectLoopEngineering(environmentWithActions(3), "state-1");
    const stateEdges = stateProjection.edges.filter(({ id }) => id.startsWith("state:state-1:"));
    expect(stateEdges).toHaveLength(4);
    expect(stateEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "state:state-1", target: "action:action-1", tone: "branch", routing: "floating-smooth" }),
    ]));
    const actionProjection = projectLoopEngineering(environmentWithActions(3), "state-1", "action-2");
    expect(actionProjection.edges.filter(({ id }) => id.startsWith("state:state-1:"))).toHaveLength(4);
    expect(actionProjection.edges.find(({ target }) => target === "action:action-2")?.tone).toBe("selected");
    expect(actionProjection.edges.find(({ target }) => target === "action:action-1")?.tone).toBe("branch");
    expect(actionProjection.edges.filter(({ id }) => id.startsWith("action:action-2:"))).toEqual([
      expect.objectContaining({ target: "agent:action-2:validation", routing: "floating-smooth" }),
      expect.objectContaining({ target: "agent:action-2:work", routing: "floating-smooth" }),
    ]);
    const selectedAction = actionProjection.nodes.find(({ id }) => id === "action:action-2")!;
    const agents = actionProjection.nodes.filter(({ kind }) => kind.endsWith("-agent"));
    const agentGroupCenter = (agents[0]!.y + agents[0]!.height / 2 + agents[1]!.y + agents[1]!.height / 2) / 2;
    expect(agentGroupCenter).toBe(selectedAction.y + selectedAction.height / 2);
  });

  it("anchors cross-rank edges to floating node intersections and shows circular connection points", () => {
    const projection = projectLoopEngineering(environmentWithActions(3), "state-1", "action-2");
    const crossRankEdges = projection.edges.filter(({ tone }) => tone !== "order");
    expect(crossRankEdges.every((edge) => edge.routing === "floating-smooth")).toBe(true);
    expect(floatingSmoothEdgeSource).toMatch(/useInternalNode/);
    expect(floatingSmoothEdgeSource).toMatch(/getBezierPath/);
    expect(floatingSmoothEdgeSource).not.toMatch(/getSmoothStepPath/);
    expect(floatingSmoothEdgeSource).toMatch(/sourceX:\s*sourceCircle\.x/);
    expect(floatingSmoothEdgeSource).toMatch(/targetX:\s*targetCircle\.x/);
    expect(floatingSmoothEdgeSource.match(/<circle/g)).toHaveLength(2);
    expect(loopEngineeringCanvasCss).toMatch(/\.loop-engineering-edge-point\s*\{/);
    expect(centeredSidePoint({ x: 20, y: 40 }, 140, 52, "right")).toEqual({ x: 160, y: 66 });
    expect(centeredSidePoint({ x: 300, y: 120 }, 140, 52, "left")).toEqual({ x: 300, y: 146 });
    expect(detachedPoint({ x: 160, y: 66 }, "right")).toEqual({ x: 168, y: 66 });
    expect(detachedPoint({ x: 300, y: 146 }, "left")).toEqual({ x: 292, y: 146 });
  });

  it("reveals only the URL-selected branches", () => {
    const environment = environmentWithActions(3);
    expect(projectLoopEngineering(environment).nodes.some(({ kind }) => kind === "action")).toBe(false);
    const state = projectLoopEngineering(environment, "state-1");
    expect(state.nodes.filter(({ kind }) => kind === "action")).toHaveLength(3);
    expect(state.nodes.some(({ kind }) => kind.endsWith("-agent"))).toBe(false);
    const action = projectLoopEngineering(environment, "state-1", "action-2", undefined, { selectedAgentRole: "work" });
    expect(action.nodes.filter(({ kind }) => kind.endsWith("-agent"))).toHaveLength(2);
    expect(action.nodes.find(({ kind }) => kind === "work-agent")?.selected).toBe(true);
  });

  it("grows the internal layout for large Action sets without overlapping nodes", () => {
    const projection = projectLoopEngineering(environmentWithActions(14), "state-1");
    const actions = projection.nodes.filter(({ kind }) => kind === "action" || kind === "create-action");
    expect(projection.height).toBeGreaterThan(1000);
    actions.slice(1).forEach((action, index) => {
      const previous = actions[index]!;
      expect(action.x).toBe(previous.x);
      expect(action.y - previous.y).toBeGreaterThanOrEqual(previous.height);
    });
  });

  it("fills a measured surface while keeping every node inside its projected bounds", () => {
    const projection = projectLoopEngineering(environmentWithActions(4), "state-1", "action-2", { width: 1100, height: 680 });
    expect(projection).toMatchObject({ width: 1100, height: 680 });
    projection.nodes.forEach(({ x, y, width, height }) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(projection.width);
      expect(y + height).toBeLessThanOrEqual(projection.height);
    });
  });
});

describe("Loop Engineering canvas interaction and presentation", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(620);
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens State, Action, create and Agent routes with keyboard-operable buttons", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<LoopEngineeringCanvas environment={environmentWithActions(3)} selectedStateId="state-1" selectedActionId="action-2" navigate={navigate} />);
    const state = screen.getByRole("button", { name: "Open State state-2: Verify" });
    expect(state).toHaveTextContent("Verify");
    expect(state).not.toHaveTextContent("state-2");
    state.focus(); await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Open Action action-2: Action 2" }));
    await user.click(screen.getByRole("button", { name: "Create State" }));
    await user.click(screen.getByRole("button", { name: "Create Action in State state-1" }));
    await user.click(screen.getByRole("button", { name: "Open Validation Agent for Action action-2" }));
    expect(navigate.mock.calls.map(([path]) => path)).toEqual([
      "/automation/loops/states/state-2",
      "/automation/loops/states/state-1/actions/action-2",
      "/automation/loops?create=state",
      "/automation/loops/states/state-1?create=action",
      "/automation/loops/states/state-1/actions/action-2?agent=validation",
    ]);
  });

  it("shows only concise names and removes the selected State prefix from Action labels", () => {
    const environment = environmentWithActions(2);
    environment.states[0]!.name = "Build";
    environment.states[0]!.actions[0]!.name = "Build - Implement";
    render(<LoopEngineeringCanvas environment={environment} selectedStateId="state-1" selectedActionId="action-1" navigate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Open State state-1: Build" })).toHaveTextContent(/^Build$/);
    expect(screen.getByRole("button", { name: "Open Action action-1: Build - Implement" })).toHaveTextContent(/^Implement$/);
    expect(screen.getByRole("button", { name: "Open Validation Agent for Action action-1" })).toHaveTextContent(/^Validation Agent$/);
    expect(screen.queryByText("state-1")).not.toBeInTheDocument();
    expect(screen.queryByText("action-1")).not.toBeInTheDocument();
    expect(screen.queryByText("ballet-action-validation-action-1")).not.toBeInTheDocument();
  });

  it("disables create nodes with an exact active-Run reason", () => {
    render(<LoopEngineeringCanvas environment={environmentWithActions(2)} selectedStateId="state-1" locked navigate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cannot create State: authoring is locked by an active Run." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cannot create Action: authoring is locked by an active Run." })).toBeDisabled();
  });

  it("uses rounded rectangles and contains no planet or radial-gradient styling", () => {
    expect(loopEngineeringCanvasCss).toMatch(/\.loop-engineering-node\s*\{[^}]*border-radius:\s*var\(--radius-md\)/s);
    expect(loopEngineeringCanvasCss).not.toMatch(/planet|radial-gradient/i);
    expect(loopEngineeringCanvasCss).toMatch(/\.loop-engineering-flow-edge \.react-flow__edge-path\s*\{[^}]*stroke-width:\s*1\.5/s);
    expect(loopEngineeringCanvasCss).toMatch(/\.loop-engineering-flow-edge--branch \.react-flow__edge-path\s*\{[^}]*var\(--muted-foreground\)/s);
    expect(loopEngineeringCanvasCss).not.toMatch(/var\(--outline\)/);
    expect(loopEngineeringCanvasCss).toMatch(/\.loop-engineering-node\[data-selected="false"\]\s*\{[^}]*opacity:\s*\.25/s);
    expect(loopEngineeringCanvasCss).toMatch(/\.loop-engineering-flow-edge--branch[^{]*\{[^}]*opacity:\s*\.25/s);
    expect(loopEngineeringCanvasCss).toMatch(/\.loop-engineering-flow-edge--order[^{]*\{[^}]*opacity:\s*\.25/s);
  });

  it("does not show the React Flow attribution badge", () => {
    render(<LoopEngineeringCanvas environment={environmentWithActions(1)} navigate={vi.fn()} />);
    expect(screen.queryByRole("link", { name: "React Flow attribution" })).not.toBeInTheDocument();
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
    validation: { ...template.validation, agentId: `ballet-action-validation-action-${index + 1}` },
    work: { ...template.work, agentId: `ballet-action-work-action-${index + 1}` },
  }));
  return environment;
}
