import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent, ProjectAutomationConfig, ProjectLoop, ProjectStepSchedule } from "@shared/api/workspace-contracts";
import { AllLoopsCanvas } from "../src/workspace/automation/loops/AllLoopsCanvas";
import { LoopEditor } from "../src/workspace/automation/loops/LoopEditor";

const agents: Agent[] = [{ id: "builder", name: "Builder", role: "Implementation", description: "Builds.", enabled: true, skills: [] }];
const executableSteps: ProjectLoop["steps"] = [{
  id: "build", type: "agent", nodeSize: "medium", agentId: "builder", description: "Build", on: { approved: "review", rejected: { end: "failed" } }
}, {
  id: "review", type: "human", nodeSize: "small", description: "Review", on: { approved: { end: "completed" }, rejected: "build" }
}];
const ordinaryLoop: ProjectLoop = { id: "delivery", theme: "open-ai", start: "build", steps: executableSteps };

function scheduledLoop(schedule: ProjectStepSchedule): ProjectLoop {
  return {
    id: "scheduled-delivery",
    theme: "open-ai",
    start: "timer",
    steps: [{ id: "timer", type: "scheduled", nodeSize: "small", description: "Start delivery", schedule, on: { triggered: "build" } }, ...executableSteps]
  };
}

const weekdayLoop = scheduledLoop({ kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" });
const config = (loop: ProjectLoop): ProjectAutomationConfig => ({ version: 5, loops: [loop] });

describe("scheduled Loop editor UI", () => {
  it("offers Scheduled only for an eligible start Step and preserves its approved local target", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LoopEditor config={config(ordinaryLoop)} loop={ordinaryLoop} loops={[ordinaryLoop]} agents={agents} locked={false} onChange={onChange} />);
    await user.click(await screen.findByRole("button", { name: "Edit step build" }));
    await user.click(screen.getByRole("combobox", { name: "Step type" }));
    await user.click(await screen.findByRole("option", { name: "Scheduled" }));
    expect((onChange.mock.calls.at(-1)?.[0] as ProjectLoop).steps[0]).toMatchObject({ type: "scheduled", on: { triggered: "review" } });
  });

  it("does not offer Scheduled for a non-start Step", async () => {
    const user = userEvent.setup();
    render(<LoopEditor config={config(ordinaryLoop)} loop={ordinaryLoop} loops={[ordinaryLoop]} agents={agents} locked={false} onChange={() => undefined} />);
    await user.click(await screen.findByRole("button", { name: "Edit step review" }));
    await user.click(screen.getByRole("combobox", { name: "Step type" }));
    expect(screen.queryByRole("option", { name: "Scheduled" })).not.toBeInTheDocument();
  });

  it("renders the Luna node, compact schedule line, fields, trigger, and scheduler state", async () => {
    const user = userEvent.setup();
    const { container } = render(<LoopEditor config={config(weekdayLoop)} loop={weekdayLoop} loops={[weekdayLoop]} agents={agents} scheduleState={{ loopId: weekdayLoop.id, stepId: "timer", nextRunAt: "2026-07-13T06:00:00.000Z", lastScheduledAt: "2026-07-10T06:00:00.000Z", lastStatus: "started", lastRunId: "run-42" }} locked={false} onChange={() => undefined} />);
    const node = await screen.findByRole("button", { name: "Edit step timer" });
    expect(node).toHaveAttribute("data-loop-node-kind", "scheduled");
    expect(node).toHaveAttribute("data-loop-node-size", "small");
    expect(node).toHaveAttribute("data-loop-node-renderer", "luna");
    expect(container.querySelectorAll("[data-loop-node-schedule-label]")).toHaveLength(1);
    expect(container.querySelector("[data-loop-node-schedule-label]")).toHaveTextContent("Weekdays · 09:00 · Europe/Helsinki");
    await user.click(node);
    expect(screen.getByRole("combobox", { name: "Schedule kind" })).toHaveTextContent("Recurring");
    expect(screen.getByLabelText("Schedule starts on")).toHaveValue("2026-07-13");
    expect(screen.getByLabelText("Schedule time")).toHaveValue("09:00");
    expect(screen.getByRole("combobox", { name: "Triggered transition target" })).toHaveTextContent("build");
    expect(screen.getByRole("region", { name: "Schedule status" })).toHaveTextContent("started");
    expect(screen.getByRole("region", { name: "Schedule status" })).toHaveTextContent("run-42");
  });

  it("shows only cadence-specific weekly and monthly controls", async () => {
    const user = userEvent.setup();
    const weekly = scheduledLoop({ kind: "recurring", cadence: "weekly", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki", weekdays: ["mon", "wed"] });
    const view = render(<LoopEditor config={config(weekly)} loop={weekly} loops={[weekly]} agents={agents} locked={false} onChange={() => undefined} />);
    await user.click(await screen.findByRole("button", { name: "Edit step timer" }));
    expect(screen.getByRole("group", { name: "Weekly days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");
    const monthly = scheduledLoop({ kind: "recurring", cadence: "monthly", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki", dayOfMonth: 15 });
    view.rerender(<LoopEditor config={config(monthly)} loop={monthly} loops={[monthly]} agents={agents} locked={false} onChange={() => undefined} />);
    expect(screen.queryByRole("group", { name: "Weekly days" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Schedule day of month")).toHaveValue(15);
  });

  it("keeps scheduled controls locked while the Loop has an active Run", async () => {
    const user = userEvent.setup();
    render(<LoopEditor config={config(weekdayLoop)} loop={weekdayLoop} loops={[weekdayLoop]} agents={agents} locked onChange={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Edit step timer" }));

    expect(screen.getByLabelText("Schedule starts on")).toBeDisabled();
    expect(screen.getByLabelText("Schedule time")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Triggered transition target" })).toBeDisabled();
  });

  it("counts agent, human, and scheduled Steps independently in All Loops", () => {
    render(<AllLoopsCanvas config={config(weekdayLoop)} onSelect={() => undefined} />);
    expect(screen.getByText("1 agent")).toBeInTheDocument();
    expect(screen.getByText("1 human")).toBeInTheDocument();
    expect(screen.getByText("1 scheduled")).toBeInTheDocument();
  });
});
