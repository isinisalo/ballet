import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultTerminalNodes,
  getProjectStepTransitionEntries,
  mapProjectStepTransitions,
  resolveEffectiveStartStep,
  type ProjectAutomationConfig,
  type ProjectStepSchedule
} from "../../shared/domain/automation.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-schedule-v9-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const profile: ExecutionProfile = {
  id: "scheduled-work",
  name: "Scheduled work",
  provider: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
  networkAccess: false
};

const scheduledConfig = (schedule: ProjectStepSchedule): ProjectAutomationConfig => ({
  version: 9,
  loops: [{
    id: "delivery",
    start: "scheduled-start",
    nodes: [{
      id: "scheduled-start",
      type: "scheduled",
      executionProfileId: profile.id,
      primaryInstructionId: "project:delivery",
      skillIds: ["project:schedule"],
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
    new ProjectConfigurationRepository().createExecutionProfile(root, profile);
    for (const schedule of schedules) {
      const value = scheduledConfig(schedule);
      expect(validateProjectAutomationConfig(value, [profile])).toEqual([]);
      expect(await saveProjectAutomationConfig(root, value, [profile])).toEqual(value);
      expect(await loadProjectAutomationConfig(root)).toEqual(value);
    }
  });
});

describe("scheduled automation graph validation", () => {
  it("allows a composed scheduled node to be the only executable node", () => {
    expect(validateProjectAutomationConfig(scheduledConfig(schedules[0]!), [profile])).toEqual([]);
  });

  it("accepts approved and rejected cycles back to the scheduled start", () => {
    const valid = scheduledConfig(schedules[0]!);
    const scheduled = valid.loops[0]!.nodes[0]!;
    const human = {
      id: "gate",
      type: "human" as const,
      description: "Gate.",
      nodeStyle: "flat" as const,
      nodeSize: "medium" as const,
      on: { approved: scheduled.id, rejected: scheduled.id }
    };
    const candidate = {
      ...valid,
      loops: [{
        ...valid.loops[0]!,
        nodes: [{ ...scheduled, on: { approved: human.id, rejected: "blocked" } }, human, ...defaultTerminalNodes()]
      }]
    };

    expect(validateProjectAutomationConfig(candidate, [profile])).toEqual([]);
  });

  it("still requires a scheduled step to be the Loop start", () => {
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
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...valid.loops[0]!, start: human.id, nodes: [scheduled, human, ...defaultTerminalNodes()] }]
    }, [profile])).toContainEqual(expect.objectContaining({
      path: "loops.0.nodes.0.type",
      message: expect.stringContaining("only as the loop start")
    }));
  });

  it("requires an existing ExecutionProfile and at most one scheduled step", () => {
    const valid = scheduledConfig(schedules[0]!);
    const scheduled = valid.loops[0]!.nodes[0]!;
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...valid.loops[0]!, nodes: [{ ...scheduled, executionProfileId: "missing" }, ...defaultTerminalNodes()] }]
    }, [profile])).toContainEqual(expect.objectContaining({ path: "loops.0.nodes.0.executionProfileId" }));
    expect(validateProjectAutomationConfig({
      ...valid,
      loops: [{ ...valid.loops[0]!, nodes: [scheduled, { ...scheduled, id: "second-schedule" }, ...defaultTerminalNodes()] }]
    }, [profile])).toContainEqual(expect.objectContaining({
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
