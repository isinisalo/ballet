import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { AgentRuntimeConfiguration } from "../../shared/domain/runtime.js";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { RootRunStore } from "./RootRunStore.js";
import { LocalRunTargetService } from "./LocalRunTargetService.js";
import { agentSnapshot } from "./LoopExecutionSnapshot.js";
import { agentTransitions } from "../tests/agentTransitionFixture.js";

const agent = (enabled = true): Agent => ({
  id: "reviewer", name: "Reviewer", description: "Reviews.", instructions: "Review carefully.", enabled,
  skills: [{ id: "active", name: "Active", description: "", metadata: {}, body: "Use active.", enabled: true },
    { id: "disabled", name: "Disabled", description: "", metadata: {}, body: "Never use this.", enabled: false }],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
});

const automation = {
  version: 8 as const,
  loops: [{
    id: "blueprint-design", start: "review",
    nodes: [{
      id: "review", type: "agent" as const, agentId: "reviewer", description: "Review.", nodeStyle: "luna" as const, nodeSize: "tiny" as const,
      on: agentTransitions("completed")
    }, ...defaultTerminalNodes()]
  }]
};

const gatedAutomation = {
  ...automation,
  loops: [{ ...automation.loops[0]!, id: "milestone-planning" }]
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
      loopThemeIssues: [{ path: ".ballet/theme.json", message: "Invalid theme." }]
    }, { reviewer: configuration });

    expect(result.loops[0]).toMatchObject({ ready: false });
    expect(result.loops[0]?.issues.map(({ code }) => code)).toEqual(expect.arrayContaining(["disabled", "invalid_config"]));
  });

  it("marks every loop unavailable when the global theme is invalid", async () => {
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
      loopThemeIssues: [{ path: ".ballet/theme.json", message: "Invalid theme." }]
    }, { reviewer: configuration });

    expect(result.loops[0]).toMatchObject({ ready: false });
  });

  it("marks downstream engineering Loops unavailable for direct starts", async () => {
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
      agents: [agent()], automation: gatedAutomation, automationIssues: [], loopThemeIssues: []
    }, { reviewer: configuration });

    expect(result.loops[0]).toMatchObject({ ready: false });
    expect(result.loops[0]?.issues).toContainEqual(expect.objectContaining({
      message: "This Loop can only start from its approved human-gate transition."
    }));
  });
});
