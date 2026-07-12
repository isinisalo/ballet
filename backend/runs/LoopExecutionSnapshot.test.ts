import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { AgentRuntimeConfiguration } from "../../shared/domain/runtime.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { RootRunStore } from "./RootRunStore.js";
import { LocalRunTargetService } from "./LocalRunTargetService.js";
import { agentSnapshot } from "./LoopExecutionSnapshot.js";

const agent = (enabled = true): Agent => ({
  id: "reviewer", name: "Reviewer", description: "Reviews.", instructions: "Review carefully.", enabled,
  skills: [{ id: "active", name: "Active", description: "", metadata: {}, body: "Use active.", enabled: true },
    { id: "disabled", name: "Disabled", description: "", metadata: {}, body: "Never use this.", enabled: false }],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
});

const automation = {
  version: 6 as const,
  loops: [{
    id: "delivery", theme: "default", start: "review",
    steps: [{
      id: "review", type: "agent" as const, agentId: "reviewer", description: "Review.", nodeSize: "small" as const,
      on: { approved: { end: "completed" as const }, rejected: { end: "failed" as const } }
    }]
  }]
};

describe("Loop execution snapshots and targets", () => {
  it("excludes disabled skills from the immutable prompt snapshot", () => {
    const snapshot = agentSnapshot(agent());
    expect(snapshot.instructions).toContain("Use active.");
    expect(snapshot.instructions).not.toContain("Never use this.");
    expect(snapshot.skillIds).toEqual(["active"]);
  });

  it("marks loops unavailable for disabled agents and theme issues", async () => {
    const configuration: AgentRuntimeConfiguration = {
      localPolicy: { readOnlyRoots: [] },
      resolved: { agentId: "reviewer", provider: "codex", model: "model", reasoning: "medium", policy: { network: false, readOnlyRoots: [] } },
      issues: []
    };
    const configurations = { get: vi.fn(async () => configuration) } as unknown as RuntimeConfigurationService;
    const roots = { active: vi.fn(), latest: vi.fn() } as unknown as RootRunStore;
    const service = new LocalRunTargetService(roots, configurations);

    const result = await service.list({
      agents: [agent(false)], automation, automationIssues: [],
      loopThemeIssues: [{ path: ".ballet/themes/default.json", message: "Invalid theme.", themeId: "default" }]
    }, { reviewer: configuration });

    expect(result.loops[0]).toMatchObject({ ready: false });
    expect(result.loops[0]?.issues.map(({ code }) => code)).toEqual(expect.arrayContaining(["disabled", "invalid_config"]));
  });

  it("ignores invalid theme files that no reachable loop uses", async () => {
    const configuration: AgentRuntimeConfiguration = {
      localPolicy: { readOnlyRoots: [] },
      resolved: { agentId: "reviewer", provider: "codex", model: "model", reasoning: "medium", policy: { network: false, readOnlyRoots: [] } },
      issues: []
    };
    const service = new LocalRunTargetService(
      { active: vi.fn(), latest: vi.fn() } as unknown as RootRunStore,
      { get: vi.fn(async () => configuration) } as unknown as RuntimeConfigurationService
    );

    const result = await service.list({
      agents: [agent()], automation, automationIssues: [],
      loopThemeIssues: [{ path: ".ballet/themes/unused.json", message: "Invalid theme.", themeId: "unused" }]
    }, { reviewer: configuration });

    expect(result.loops[0]).toMatchObject({ ready: true, issues: [] });
  });
});
