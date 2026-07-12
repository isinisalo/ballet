import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import {
  getProjectStepTransitionEntries,
  mapProjectStepTransitions,
  resolveEffectiveStartStep,
  type ProjectAutomationConfig,
  type ProjectStepSchedule
} from "../../shared/domain/automation.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-schedule-v6-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer",
  description: "Implements work.",
  instructions: "Implement.",
  skills: [],
  enabled: true,
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z"
};

const scheduledConfig = (schedule: ProjectStepSchedule): ProjectAutomationConfig => ({
  version: 6,
  loops: [{
    id: "delivery",
    theme: "open-ai",
    start: "scheduled-start",
    steps: [{
      id: "scheduled-start",
      type: "scheduled",
      description: "Start delivery on schedule.",
      nodeSize: "small",
      schedule,
      on: { triggered: "implement" }
    }, {
      id: "implement",
      type: "agent",
      agentId: agent.id,
      description: "Implement the change.",
      nodeSize: "medium",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
});

const schedules: ProjectStepSchedule[] = [{
  kind: "once",
  date: "2026-07-13",
  time: "09:15",
  timeZone: "Europe/Helsinki"
}, {
  kind: "recurring",
  startsOn: "2026-07-13",
  time: "09:15",
  timeZone: "Europe/Helsinki",
  cadence: "daily"
}, {
  kind: "recurring",
  startsOn: "2026-07-13",
  time: "09:15",
  timeZone: "Europe/Helsinki",
  cadence: "weekdays"
}, {
  kind: "recurring",
  startsOn: "2026-07-13",
  time: "09:15",
  timeZone: "Europe/Helsinki",
  cadence: "weekly",
  weekdays: ["mon", "wed", "fri"]
}, {
  kind: "recurring",
  startsOn: "2026-07-13",
  time: "09:15",
  timeZone: "Europe/Helsinki",
  cadence: "monthly",
  dayOfMonth: 31
}];

describe("scheduled automation persistence", () => {
  it("accepts and round-trips every scheduled cadence", async () => {
    const root = await tempRoot();
    for (const schedule of schedules) {
      const value = scheduledConfig(schedule);
      expect(validateProjectAutomationConfig(value, [agent])).toEqual([]);
      expect(await saveProjectAutomationConfig(root, value, [agent])).toEqual(value);
      expect(await loadProjectAutomationConfig(root, [agent])).toEqual(value);
    }
  });
});

describe("scheduled automation graph validation", () => {
  it("requires the scheduled step to be the loop start", () => {
    const valid = scheduledConfig(schedules[0]!);
    const loop = valid.loops[0]!;
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...loop, start: "implement" }]
    }, [agent])).toContainEqual(expect.objectContaining({
      path: "loops.0.steps.0.type",
      message: expect.stringContaining("only as the loop start")
    }));
  });

  it("rejects incoming, missing, self, and second scheduled targets", () => {
    const valid = scheduledConfig(schedules[0]!);
    const loop = valid.loops[0]!;
    const scheduled = loop.steps[0]!;
    const implement = loop.steps[1]!;
    const issuesFor = (steps: unknown[]) => validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...loop, steps }]
    }, [agent]);

    expect(issuesFor([scheduled, {
      ...implement,
      on: { approved: scheduled.id, rejected: { end: "failed" } }
    }])).toContainEqual(expect.objectContaining({
      path: "loops.0.steps.1.on.approved",
      message: "No transition may target a scheduled start step."
    }));
    expect(issuesFor([{ ...scheduled, on: { triggered: "missing" } }, implement]))
      .toContainEqual(expect.objectContaining({
        path: "loops.0.steps.0.on.triggered",
        message: expect.stringContaining("unknown step")
      }));
    expect(issuesFor([{ ...scheduled, on: { triggered: scheduled.id } }, implement]))
      .toContainEqual(expect.objectContaining({
        path: "loops.0.steps.0.on.triggered",
        message: expect.stringContaining("another agent or human")
      }));
    expect(issuesFor([scheduled, {
      ...scheduled,
      id: "second-schedule",
      on: { triggered: implement.id }
    }, implement])).toContainEqual(expect.objectContaining({
      path: "loops.0.steps",
      message: "Loop may contain at most one scheduled step."
    }));
  });
});

describe("scheduled automation domain helpers", () => {
  it("resolves effective start and enumerates each step's own transitions", () => {
    const loop = scheduledConfig(schedules[0]!).loops[0]!;
    expect(resolveEffectiveStartStep(loop)?.id).toBe("implement");
    expect(getProjectStepTransitionEntries(loop.steps[0]!)).toEqual([["triggered", "implement"]]);
    expect(getProjectStepTransitionEntries(loop.steps[1]!)).toEqual([
      ["approved", { end: "completed" }],
      ["rejected", { end: "failed" }]
    ]);
    expect(mapProjectStepTransitions(loop.steps[0]!, {
      triggered: () => "renamed-target"
    }).on).toEqual({ triggered: "renamed-target" });
    expect(mapProjectStepTransitions(loop.steps[1]!, {
      approved: () => "renamed-target"
    }).on).toEqual({ approved: "renamed-target", rejected: { end: "failed" } });
  });
});
