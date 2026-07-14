import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  type Agent,
  type ProjectAutomationConfig,
  type ProjectLoop,
  type ProjectStep,
  type ProjectStepSchedule
} from "@shared/api/workspace-contracts";
import { AllLoopsCanvas } from "../src/workspace/automation/loops/AllLoopsCanvas";
import { LoopEditor } from "../src/workspace/automation/loops/LoopEditor";

const agents: Agent[] = [{ id: "builder", name: "Builder", role: "Implementation", description: "Builds.", enabled: true, skills: [] }];
const executableSteps: ProjectStep[] = [{
  id: "build",
  type: "agent",
  nodeStyle: "terra",
  nodeSize: "medium",
  agentId: "builder",
  description: "Build",
  on: { approved: "review", rejected: "failed" }
}, {
  id: "review",
  type: "human",
  nodeStyle: "luna",
  nodeSize: "tiny",
  description: "Review",
  on: { approved: "completed", rejected: "build" }
}];
const ordinaryLoop: ProjectLoop = { id: "delivery", start: "build", nodes: [...executableSteps, ...defaultTerminalNodes()] };

function scheduledLoop(schedule: ProjectStepSchedule): ProjectLoop {
  return {
    id: "scheduled-delivery",
    start: "timer",
    nodes: [{
      id: "timer",
      type: "scheduled",
      nodeStyle: "luna",
      nodeSize: "tiny",
      agentId: "builder",
      description: "Start delivery",
      schedule,
      on: { approved: "build", rejected: "blocked" }
    }, ...executableSteps, ...defaultTerminalNodes()]
  };
}

const weekdayLoop = scheduledLoop({ kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" });
const config = (loop: ProjectLoop): ProjectAutomationConfig => ({ version: 8, loops: [loop] });

describe("scheduled Loop editor UI", () => {
  it("offers Scheduled only for an eligible start Step and preserves its agent and outputs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const eligibleLoop: ProjectLoop = {
      ...ordinaryLoop,
      nodes: ordinaryLoop.nodes.map((node) => node.id === "review" && node.type === "human"
        ? { ...node, on: { ...node.on, rejected: "blocked" } }
        : node)
    };
    renderEditor(eligibleLoop, { onChange });

    await user.click(await screen.findByRole("button", { name: "Edit step build" }));
    await user.click(screen.getByRole("combobox", { name: "Node type" }));
    await user.click(await screen.findByRole("option", { name: "Scheduled" }));

    expect((onChange.mock.calls.at(-1)?.[0] as ProjectLoop).nodes[0]).toMatchObject({
      type: "scheduled",
      agentId: "builder",
      on: { approved: "review", rejected: "failed" }
    });
  });

  it("does not offer Scheduled for a non-start Step", async () => {
    const user = userEvent.setup();
    renderEditor(ordinaryLoop);
    await user.click(await screen.findByRole("button", { name: "Edit step review" }));
    await user.click(screen.getByRole("combobox", { name: "Node type" }));
    expect(screen.queryByRole("option", { name: "Scheduled" })).not.toBeInTheDocument();
  });

  it("renders the Luna node, selected agent, schedule, required outputs, and scheduler state", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor(weekdayLoop, {
      scheduleState: {
        loopId: weekdayLoop.id,
        stepId: "timer",
        nextRunAt: "2026-07-13T06:00:00.000Z",
        lastScheduledAt: "2026-07-10T06:00:00.000Z",
        lastStatus: "started",
        lastRunId: "run-42"
      }
    });
    const node = await screen.findByRole("button", { name: "Edit step timer" });
    expect(node).toHaveAttribute("data-loop-node-kind", "scheduled");
    expect(node).toHaveAttribute("data-loop-node-size", "tiny");
    expect(node).toHaveAttribute("data-loop-node-style", "luna");
    expect(container.querySelectorAll("[data-loop-node-schedule-label]")).toHaveLength(1);
    expect(container.querySelector("[data-loop-node-schedule-label]")).toHaveTextContent("Weekdays · 09:00 · Europe/Helsinki");

    await user.click(node);
    expect(screen.getByRole("combobox", { name: "Agent" })).toHaveTextContent("builder · Builder");
    expect(screen.getByRole("combobox", { name: "Schedule kind" })).toHaveTextContent("Recurring");
    expect(screen.getByLabelText("Schedule starts on")).toHaveValue("2026-07-13");
    expect(screen.getByLabelText("Schedule time")).toHaveValue("09:00");
    expect(screen.getByText("Transitions")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Triggered transition target" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Schedule status" })).toHaveTextContent("started");
    expect(screen.getByRole("region", { name: "Schedule status" })).toHaveTextContent("run-42");
  });

  it("shows only cadence-specific weekly and monthly controls", async () => {
    const user = userEvent.setup();
    const weekly = scheduledLoop({ kind: "recurring", cadence: "weekly", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki", weekdays: ["mon", "wed"] });
    const view = renderEditor(weekly);
    await user.click(await screen.findByRole("button", { name: "Edit step timer" }));
    expect(screen.getByRole("group", { name: "Weekly days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");

    const monthly = scheduledLoop({ kind: "recurring", cadence: "monthly", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki", dayOfMonth: 15 });
    view.rerender(editor(monthly));
    expect(screen.queryByRole("group", { name: "Weekly days" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Schedule day of month")).toHaveValue(15);
  });

  it("keeps scheduled agent and schedule controls locked while the Loop has an active Run", async () => {
    const user = userEvent.setup();
    renderEditor(weekdayLoop, { locked: true });
    await user.click(await screen.findByRole("button", { name: "Edit step timer" }));

    expect(screen.getByRole("combobox", { name: "Agent" })).toBeDisabled();
    expect(screen.getByLabelText("Schedule starts on")).toBeDisabled();
    expect(screen.getByLabelText("Schedule time")).toBeDisabled();
  });

  it("counts agent, human, and scheduled Steps independently in All Loops", () => {
    render(<AllLoopsCanvas config={config(weekdayLoop)} onAddLoop={() => undefined} onOpenLoop={() => undefined} />);
    expect(screen.getByText("1 agent")).toBeInTheDocument();
    expect(screen.getByText("1 human")).toBeInTheDocument();
    expect(screen.getByText("1 scheduled")).toBeInTheDocument();
  });

  it("renders Add loop as the first keyboard-accessible ghost card", async () => {
    const user = userEvent.setup();
    const onAddLoop = vi.fn();
    render(<AllLoopsCanvas config={config(weekdayLoop)} onAddLoop={onAddLoop} onOpenLoop={() => undefined} />);

    const addLoopCard = screen.getByRole("button", { name: "+ Add loop" });
    expect(addLoopCard).toHaveClass("border-dashed");
    expect(addLoopCard.parentElement?.firstElementChild).toBe(addLoopCard);
    await user.tab();
    expect(document.activeElement).toBe(addLoopCard);
    await user.keyboard("{Enter}");
    expect(onAddLoop).toHaveBeenCalledOnce();
  });

  it("keeps the Add loop card when no Loops are configured", () => {
    render(<AllLoopsCanvas config={{ version: 8, loops: [] }} onAddLoop={() => undefined} onOpenLoop={() => undefined} />);
    expect(screen.getByRole("button", { name: "+ Add loop" })).toBeInTheDocument();
    expect(screen.queryByText("No loops configured.")).not.toBeInTheDocument();
  });

  it("offers only the Loop action in All Loops cards", async () => {
    const user = userEvent.setup();
    const onOpenLoop = vi.fn();
    render(<AllLoopsCanvas config={config(weekdayLoop)} onAddLoop={() => undefined} onOpenLoop={onOpenLoop} />);

    await user.click(screen.getByRole("button", { name: "Open loop scheduled-delivery" }));
    expect(onOpenLoop).toHaveBeenCalledWith("scheduled-delivery");
    expect(screen.queryByRole("button", { name: "Edit theme for scheduled-delivery" })).not.toBeInTheDocument();
  });
});

function editor(loop: ProjectLoop, overrides: Partial<React.ComponentProps<typeof LoopEditor>> = {}) {
  return <LoopEditor
    config={config(loop)}
    loop={loop}
    loops={[loop]}
    agents={agents}
    theme={defaultLoopTheme}
    locked={false}
    onChange={() => undefined}
    {...overrides}
  />;
}

function renderEditor(loop: ProjectLoop, overrides: Partial<React.ComponentProps<typeof LoopEditor>> = {}) {
  return render(editor(loop, overrides));
}
