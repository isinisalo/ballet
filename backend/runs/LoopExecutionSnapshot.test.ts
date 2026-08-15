import { describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectLoop } from "../../shared/domain/automation.js";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { LoopRunNotFoundError } from "../runtime/LoopRunErrors.js";
import { reachableExecutionSteps, reachableLoops } from "./LoopExecutionSnapshot.js";

const composition = {
  executionProfileId: "primary",
  primaryInstructionId: "project:primary",
  skillIds: ["project:checks"]
};

const targetLoop = (): ProjectLoop => ({
  id: "target",
  start: "scheduled",
  nodes: [{
    id: "scheduled",
    type: "scheduled",
    ...composition,
    description: "Start scheduled work.",
    nodeStyle: "luna",
    nodeSize: "tiny",
    schedule: { kind: "once", date: "2026-08-01", time: "09:00", timeZone: "UTC" },
    on: { approved: "completed", rejected: "blocked" }
  }, {
    id: "unreachable",
    type: "agent",
    ...composition,
    description: "Never reached.",
    nodeStyle: "flat",
    nodeSize: "medium",
    on: { approved: "completed", rejected: "failed" }
  }, ...defaultTerminalNodes()]
});

const sourceLoop = (): ProjectLoop => ({
  id: "source",
  start: "work",
  nodes: [{
    id: "work",
    type: "agent",
    ...composition,
    description: "Complete the work.",
    nodeStyle: "terra",
    nodeSize: "medium",
    on: { approved: "gate", rejected: "failed" }
  }, {
    id: "gate",
    type: "human",
    description: "Review the work.",
    nodeStyle: "luna",
    nodeSize: "tiny",
    on: { approved: { loop: "target" }, rejected: "blocked" }
  }, ...defaultTerminalNodes()]
});

const config = (): ProjectConfiguration => ({
  version: 9,
  executionProfiles: [{
    id: "primary",
    name: "Primary",
    provider: "codex",
    model: "gpt-5",
    reasoningEffort: "medium",
    networkAccess: false
  }],
  loops: [sourceLoop(), targetLoop()]
});

describe("reachable Root Run execution snapshot graph", () => {
  it("traverses every configured result across Human and cross-Loop boundaries", () => {
    const loops = reachableLoops(config(), "source");
    expect(loops.map((loop) => loop.id)).toEqual(["source", "target"]);
    expect(loops[0]!.nodes.map((node) => node.id)).toEqual([
      "work", "gate", "blocked", "failed"
    ]);
    expect(loops[1]!.nodes.map((node) => node.id)).toEqual([
      "scheduled", "completed", "blocked"
    ]);
  });

  it("returns only composed Agent and Scheduled Steps in deterministic Loop order", () => {
    expect(reachableExecutionSteps(config(), "source").map(({ loopId, step }) => [
      loopId,
      step.id,
      step.type,
      step.executionProfileId,
      step.primaryInstructionId,
      step.skillIds
    ])).toEqual([
      ["source", "work", "agent", "primary", "project:primary", ["project:checks"]],
      ["target", "scheduled", "scheduled", "primary", "project:primary", ["project:checks"]]
    ]);
  });

  it("fails closed when a reachable Loop or node is missing", () => {
    expect(() => reachableLoops(config(), "missing")).toThrow(LoopRunNotFoundError);
    const missingTarget = config();
    missingTarget.loops = [sourceLoop()];
    expect(() => reachableLoops(missingTarget, "source")).toThrow("Reachable Loop target was not found.");

    const missingNode = config();
    missingNode.loops[0] = { ...sourceLoop(), start: "missing" };
    expect(() => reachableLoops(missingNode, "source")).toThrow("Reachable node source:missing was not found.");
  });
});
