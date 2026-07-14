import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import { parseUnknown } from "../http/validation/httpValidation.js";
import { expectValidationError } from "./expectValidationError.js";

const configWithSchedule = (schedule: unknown) => ({
  version: 7,
  loops: [{
    id: "delivery",
    start: "scheduled-start",
    steps: [{
      id: "scheduled-start",
      type: "scheduled",
      agentId: "developer-agent",
      description: "Deliver.",
      nodeStyle: "luna",
      schedule,
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    }]
  }]
});

const once = { kind: "once", date: "2026-07-13", time: "08:30", timeZone: "Europe/Helsinki" };
const weekly = {
  kind: "recurring", startsOn: "2026-07-13", time: "08:30", timeZone: "Europe/Helsinki",
  cadence: "weekly", weekdays: ["mon", "thu"]
};
const monthly = {
  kind: "recurring", startsOn: "2026-07-13", time: "08:30", timeZone: "UTC",
  cadence: "monthly", dayOfMonth: 31
};

describe("scheduled automation schema", () => {
  it("accepts strict agent-backed schedules", () => {
    for (const schedule of [once, weekly, monthly]) {
      expect(parseUnknown(automationConfigSchema, configWithSchedule(schedule))).toEqual(configWithSchedule(schedule));
    }
  });

  it("rejects missing agent, legacy triggered output, and legacy node size", () => {
    const valid = configWithSchedule(once);
    const step = valid.loops[0]!.steps[0]!;
    const withoutAgent: Record<string, unknown> = { ...step };
    delete withoutAgent.agentId;
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid, loops: [{ ...valid.loops[0], steps: [withoutAgent] }]
    }), "loops.0.steps.0.agentId");
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid, loops: [{ ...valid.loops[0], steps: [{ ...step, on: { triggered: "work" } }] }]
    }), "loops.0.steps.0.on");
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid, loops: [{ ...valid.loops[0], steps: [{ ...step, nodeSize: "small" }] }]
    }), "loops.0.steps.0");
  });

  it("rejects malformed calendar values", () => {
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...once, date: "2026-02-30"
    })), "loops.0.steps.0.schedule.date");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...once, time: "24:00"
    })), "loops.0.steps.0.schedule.time");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...once, timeZone: "+02:00"
    })), "loops.0.steps.0.schedule.timeZone");
  });

  it("rejects invalid recurring fields", () => {
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...weekly, weekdays: []
    })), "loops.0.steps.0.schedule.weekdays");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...monthly, dayOfMonth: 32
    })), "loops.0.steps.0.schedule.dayOfMonth");
  });
});
