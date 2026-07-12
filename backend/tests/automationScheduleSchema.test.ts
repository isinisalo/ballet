import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import { HttpValidationError, parseUnknown } from "../http/validation/httpValidation.js";

const expectValidationError = (callback: () => unknown, path: string) => {
  expect(callback).toThrow(HttpValidationError);
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpValidationError);
    expect((error as HttpValidationError).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path })
    ]));
  }
};

const configWithSchedule = (schedule: unknown) => ({
  version: 6,
  loops: [{
    id: "delivery",
    theme: "open-ai",
    start: "scheduled-start",
    steps: [{
      id: "scheduled-start",
      type: "scheduled",
      description: "Start delivery.",
      nodeSize: "small",
      schedule,
      on: { triggered: "implementation" }
    }, {
      id: "implementation",
      type: "agent",
      description: "Implementation",
      nodeSize: "medium",
      agentId: "developer-agent",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
});

const once = {
  kind: "once",
  date: "2026-07-13",
  time: "08:30",
  timeZone: "Europe/Helsinki"
};
const weekly = {
  kind: "recurring",
  startsOn: "2026-07-13",
  time: "08:30",
  timeZone: "Europe/Helsinki",
  cadence: "weekly",
  weekdays: ["mon", "thu"]
};
const monthly = {
  kind: "recurring",
  startsOn: "2026-07-13",
  time: "08:30",
  timeZone: "UTC",
  cadence: "monthly",
  dayOfMonth: 31
};

describe("scheduled automation schema", () => {
  it("accepts strict once, weekly, and monthly schedules", () => {
    for (const schedule of [once, weekly, monthly]) {
      expect(parseUnknown(automationConfigSchema, configWithSchedule(schedule)))
        .toEqual(configWithSchedule(schedule));
    }
  });

  it("rejects malformed calendar values", () => {
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...once,
      date: "2026-02-30"
    })), "loops.0.steps.0.schedule.date");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...once,
      time: "24:00"
    })), "loops.0.steps.0.schedule.time");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...once,
      timeZone: "+02:00"
    })), "loops.0.steps.0.schedule.timeZone");
  });

  it("rejects invalid or legacy cadence fields", () => {
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...weekly,
      weekdays: []
    })), "loops.0.steps.0.schedule.weekdays");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...weekly,
      weekdays: ["mon", "mon"]
    })), "loops.0.steps.0.schedule.weekdays");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...monthly,
      dayOfMonth: 32
    })), "loops.0.steps.0.schedule.dayOfMonth");
    expectValidationError(() => parseUnknown(automationConfigSchema, configWithSchedule({
      ...once,
      legacyCron: "30 8 * * *"
    })), "loops.0.steps.0.schedule");
  });
});
