import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { RuntimeDatabase } from "../runtime-db.js";
import {
  WorkLoopRuntimeUnavailableError,
  workLoopRuntimeUnavailableMessage
} from "../runtime/LoopRunErrors.js";

describe("strict-v10 runtime boundary", () => {
  it("fails closed instead of invoking the removed v9 transition engine", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "ballet-runtime-boundary-"));
    const database = new RuntimeDatabase(path.join(directory, "state.sqlite"));
    expect(() => database.startLoopRun("root-run")).toThrowError(new WorkLoopRuntimeUnavailableError());
    expect(() => database.startLoopRun("root-run")).toThrow(workLoopRuntimeUnavailableMessage);
    database.close();
  });
});
