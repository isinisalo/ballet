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
  const root = await mkdtemp(path.join(tmpdir(), "ballet-schedule-v7-"));
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
  version: 7,
  loops: [{
    id: "delivery",
    start: "scheduled-start",
    steps: [{
      id: "scheduled-start",
      type: "scheduled",
      agentId: agent.id,
      description: "Deliver on schedule.",
      nodeStyle: "luna",
      schedule,
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    }]
  }]
});

const schedules: ProjectStepSchedule[] = [{
  kind: "once", date: "2026-07-13", time: "09:15", timeZone: "Europe/Helsinki"
}, {
  kind: "recurring", startsOn: "2026-07-13", time: "09:15", timeZone: "Europe/Helsinki", cadence: "daily"
}, {
  kind: "recurring", startsOn: "2026-07-13", time: "09:15", timeZone: "Europe/Helsinki", cadence: "weekdays"
}, {
  kind: "recurring", startsOn: "2026-07-13", time: "09:15", timeZone: "Europe/Helsinki",
  cadence: "weekly", weekdays: ["mon", "wed", "fri"]
}, {
  kind: "recurring", startsOn: "2026-07-13", time: "09:15", timeZone: "Europe/Helsinki",
  cadence: "monthly", dayOfMonth: 31
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
  it("allows an agent-backed scheduled step to be the only step", () => {
    expect(validateProjectAutomationConfig(scheduledConfig(schedules[0]!), [agent])).toEqual([]);
  });

  it("requires scheduled steps to be the start and rejects incoming transitions", () => {
    const valid = scheduledConfig(schedules[0]!);
    const scheduled = valid.loops[0]!.steps[0]!;
    const human = {
      id: "gate",
      type: "human" as const,
      description: "Gate.",
      nodeStyle: "flat" as const,
      on: { approved: scheduled.id, rejected: { end: "blocked" as const } }
    };
    const candidate = {
      ...valid,
      loops: [{ ...valid.loops[0]!, start: human.id, steps: [scheduled, human] }]
    };
    const issues = validateProjectAutomationConfig(candidate, [agent]);
    expect(issues).toContainEqual(expect.objectContaining({
      path: "loops.0.steps.0.type",
      message: expect.stringContaining("only as the loop start")
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      path: "loops.0.steps.1.on.approved",
      message: "No transition may target a scheduled start step."
    }));
  });

  it("requires an existing scheduled agent and at most one scheduled step", () => {
    const valid = scheduledConfig(schedules[0]!);
    const scheduled = valid.loops[0]!.steps[0]!;
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...valid.loops[0]!, steps: [{ ...scheduled, agentId: "missing-agent" }] }]
    }, [agent])).toContainEqual(expect.objectContaining({ path: "loops.0.steps.0.agentId" }));
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...valid.loops[0]!, steps: [scheduled, { ...scheduled, id: "second-schedule" }] }]
    }, [agent])).toContainEqual(expect.objectContaining({
      path: "loops.0.steps",
      message: "Loop may contain at most one scheduled step."
    }));
  });
});

describe("scheduled automation domain helpers", () => {
  it("treats scheduled as the effective executable start and maps both outputs", () => {
    const step = scheduledConfig(schedules[0]!).loops[0]!.steps[0]!;
    expect(resolveEffectiveStartStep(scheduledConfig(schedules[0]!).loops[0]!)?.id).toBe(step.id);
    expect(getProjectStepTransitionEntries(step)).toEqual([
      ["approved", { end: "completed" }],
      ["rejected", { end: "blocked" }]
    ]);
    expect(mapProjectStepTransitions(step, { approved: () => "next-step" }).on).toEqual({
      approved: "next-step",
      rejected: { end: "blocked" }
    });
  });
});
