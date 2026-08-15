import { describe, expect, it } from "vitest";
import { LoopRunEngine } from "../runtime/LoopRunEngine.js";
import {
  WorkLoopRuntimeUnavailableError,
  workLoopRuntimeUnavailableMessage
} from "../runtime/LoopRunErrors.js";

describe("strict-v10 runtime boundary", () => {
  it("fails closed instead of invoking the removed v9 transition engine", () => {
    const engine = new LoopRunEngine(
      () => { throw new Error("Database must not be touched."); },
      null as never,
      null as never
    );
    expect(() => engine.start("root-run")).toThrowError(new WorkLoopRuntimeUnavailableError());
    expect(() => engine.start("root-run")).toThrow(workLoopRuntimeUnavailableMessage);
  });
});
