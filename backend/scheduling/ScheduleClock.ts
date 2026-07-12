import { Temporal } from "@js-temporal/polyfill";

export interface ScheduleClock {
  now(): Temporal.Instant;
}

export const systemScheduleClock: ScheduleClock = {
  now: () => Temporal.Now.instant()
};

