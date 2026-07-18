import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import {
  defaultTerminalNodes,
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
  const root = await mkdtemp(path.join(tmpdir(), "ballet-schedule-v8-"));
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
  version: 8,
  loops: [{
    id: "delivery",
    start: "scheduled-start",
    nodes: [{
      id: "scheduled-start",
      type: "scheduled",
      agentId: agent.id,
      description: "Deliver on schedule.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      schedule,
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
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
  it("allows an agent-backed scheduled node to be the only executable node", () => {
    expect(validateProjectAutomationConfig(scheduledConfig(schedules[0]!), [agent])).toEqual([]);
  });

  it("requires scheduled steps to be the start and rejects incoming transitions", () => {
    const valid = scheduledConfig(schedules[0]!);
    const scheduled = valid.loops[0]!.nodes[0]!;
    const human = {
      id: "gate",
      type: "human" as const,
      description: "Gate.",
      nodeStyle: "flat" as const,
      nodeSize: "medium" as const,
      on: { approved: scheduled.id, rejected: "blocked" }
    };
    const candidate = {
      ...valid,
      loops: [{ ...valid.loops[0]!, start: human.id, nodes: [scheduled, human, ...defaultTerminalNodes()] }]
    };
    const issues = validateProjectAutomationConfig(candidate, [agent]);
    expect(issues).toContainEqual(expect.objectContaining({
      path: "loops.0.nodes.0.type",
      message: expect.stringContaining("only as the loop start")
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      path: "loops.0.nodes.1.on.approved",
      message: "No transition may target a scheduled start step."
    }));
  });

  it("requires an existing scheduled agent and at most one scheduled step", () => {
    const valid = scheduledConfig(schedules[0]!);
    const scheduled = valid.loops[0]!.nodes[0]!;
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...valid.loops[0]!, nodes: [{ ...scheduled, agentId: "missing-agent" }, ...defaultTerminalNodes()] }]
    }, [agent])).toContainEqual(expect.objectContaining({ path: "loops.0.nodes.0.agentId" }));
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...valid.loops[0]!, nodes: [scheduled, { ...scheduled, id: "second-schedule" }, ...defaultTerminalNodes()] }]
    }, [agent])).toContainEqual(expect.objectContaining({
      path: "loops.0.nodes",
      message: "Loop may contain at most one scheduled step."
    }));
  });
});

describe("scheduled automation domain helpers", () => {
  it("treats scheduled as the effective executable start and maps both outputs", () => {
    const step = scheduledConfig(schedules[0]!).loops[0]!.nodes[0]!;
    if (step.type !== "scheduled") throw new Error("Expected scheduled fixture node.");
    expect(resolveEffectiveStartStep(scheduledConfig(schedules[0]!).loops[0]!)?.id).toBe(step.id);
    expect(getProjectStepTransitionEntries(step)).toEqual([
      ["approved", "completed"],
      ["rejected", "blocked"]
    ]);
    expect(mapProjectStepTransitions(step, { approved: () => "next-step" }).on).toEqual({
      approved: "next-step",
      rejected: "blocked"
    });
  });
});
