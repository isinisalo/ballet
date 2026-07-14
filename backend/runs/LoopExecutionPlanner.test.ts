import { describe, expect, it, vi } from "vitest";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { Agent } from "../../shared/domain/agents.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { LoopExecutionPlanner } from "./LoopExecutionPlanner.js";

const agent: Agent = {
  id: "scheduled-agent",
  name: "Scheduled agent",
  description: "Runs scheduled work.",
  instructions: "Run the scheduled work.",
  skills: [],
  enabled: true,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z"
};

describe("LoopExecutionPlanner scheduled agents", () => {
  it("preflights and snapshots the agent selected by a scheduled start", async () => {
    const get = vi.fn(async () => ({
      resolved: {
        agentId: agent.id,
        provider: "codex" as const,
        model: "gpt-5",
        reasoning: "medium" as const,
        policy: { network: false, readOnlyRoots: [] }
      },
      localPolicy: { readOnlyRoots: [] },
      issues: []
    }));
    const preflight = vi.fn(async () => ({
      runtime: {
        hostname: "localhost",
        provider: "codex" as const,
        cliVersion: "1",
        model: "gpt-5",
        reasoning: "medium" as const,
        policy: { network: false, readOnlyRoots: [] },
        capabilityHash: "capability"
      },
      project: {
        root: "/workspace",
        headSha: "a".repeat(40),
        configHash: "config",
        snapshotHash: "snapshot",
        dirty: false
      }
    }));
    const planner = new LoopExecutionPlanner(
      { get } as unknown as RuntimeConfigurationService,
      { preflight } as unknown as LocalRuntimeService
    );
    const data = {
      agents: [agent],
      automation: {
        version: 7,
        loops: [{
          id: "scheduled-loop",
          start: "scheduled-start",
          steps: [{
            id: "scheduled-start",
            type: "scheduled",
            agentId: agent.id,
            description: "Run scheduled work.",
            nodeStyle: "luna",
            schedule: { kind: "once", date: "2026-07-14", time: "21:00", timeZone: "UTC" },
            on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
          }]
        }]
      }
    } as unknown as AppData;

    await expect(planner.create(data, "scheduled-loop")).resolves.toEqual(expect.objectContaining({
      version: 1,
      rootLoopId: "scheduled-loop",
      steps: [expect.objectContaining({
        loopId: "scheduled-loop",
        stepId: "scheduled-start",
        agentId: agent.id,
        agent: expect.objectContaining({ id: agent.id })
      })]
    }));
    expect(get).toHaveBeenCalledWith(agent.id);
    expect(preflight).toHaveBeenCalledOnce();
  });
});
