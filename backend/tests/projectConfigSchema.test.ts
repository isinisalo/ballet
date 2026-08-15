import { describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";

const profile = {
  id: "primary",
  name: "Primary",
  provider: "codex" as const,
  model: "gpt-5",
  reasoningEffort: "medium",
  networkAccess: false
};

const step = {
  id: "work",
  type: "agent" as const,
  executionProfileId: profile.id,
  primaryInstructionId: "project:primary",
  skillIds: ["project:alpha", "project:nested/beta"],
  description: "Complete the work.",
  nodeStyle: "terra" as const,
  nodeSize: "medium" as const,
  on: { approved: "completed", rejected: "blocked" }
};

const validConfig = () => ({
  version: 9 as const,
  executionProfiles: [{ ...profile }],
  loops: [{ id: "delivery", start: step.id, nodes: [{ ...step }, ...defaultTerminalNodes()] }]
});

const withFirstNode = (node: unknown): unknown => {
  const config = validConfig();
  return {
    ...config,
    loops: [{ ...config.loops[0]!, nodes: [node, ...defaultTerminalNodes()] }]
  };
};

const issuePaths = (value: unknown): string[] => {
  const result = projectConfigSchema.safeParse(value);
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("strict project configuration v9 schema", () => {
  it("accepts the canonical ExecutionProfile and Step composition shape", () => {
    expect(projectConfigSchema.parse(validConfig())).toEqual(validConfig());
  });

  it("requires a non-empty Human task while terminal descriptions remain optional", () => {
    expect(issuePaths(withFirstNode({
      id: step.id,
      type: "human",
      description: "  \n",
      nodeStyle: "luna",
      nodeSize: "tiny",
      on: { approved: "completed", rejected: "blocked" }
    }))).toContain("loops.0.nodes.0.description");

    const withEmptyTerminalDescriptions = validConfig();
    expect(withEmptyTerminalDescriptions.loops[0]!.nodes.slice(1).every((node) => !node.description)).toBe(true);
    expect(projectConfigSchema.safeParse(withEmptyTerminalDescriptions).success).toBe(true);
  });

  it("rejects v8 and removed top-level entities instead of coercing them", () => {
    const current = validConfig();
    expect(issuePaths({ ...current, version: 8 })).toContain("version");
    expect(issuePaths({ ...current, agents: {} })).toContain("");
  });

  it("rejects duplicate ExecutionProfile ids and missing profile references", () => {
    const duplicate = validConfig();
    duplicate.executionProfiles.push({ ...profile });
    expect(issuePaths(duplicate)).toContain("executionProfiles.1.id");

    const missing = validConfig();
    missing.loops[0]!.nodes[0] = { ...step, executionProfileId: "missing" };
    expect(issuePaths(missing)).toContain("loops.0.nodes.0.executionProfileId");
  });

  it("rejects duplicate Loop ids before runtime graph resolution", () => {
    const duplicate = validConfig();
    duplicate.loops.push({
      ...duplicate.loops[0]!,
      nodes: duplicate.loops[0]!.nodes.map((node) => ({ ...node }))
    });

    expect(issuePaths(duplicate)).toContain("loops.1.id");
  });

  it("requires a valid project-scoped primary instruction id", () => {
    const withoutPrimary = { ...step } as Record<string, unknown>;
    delete withoutPrimary.primaryInstructionId;
    expect(issuePaths(withFirstNode(withoutPrimary))).toContain("loops.0.nodes.0.primaryInstructionId");

    expect(issuePaths(withFirstNode({ ...step, primaryInstructionId: "project:Not-Canonical" })))
      .toContain("loops.0.nodes.0.primaryInstructionId");
  });

  it("rejects duplicate or invalid project-scoped skill ids", () => {
    expect(issuePaths(withFirstNode({ ...step, skillIds: ["project:alpha", "project:alpha"] })))
      .toContain("loops.0.nodes.0.skillIds");

    expect(issuePaths(withFirstNode({ ...step, skillIds: ["alpha"] })))
      .toContain("loops.0.nodes.0.skillIds.0");
  });

  it("forbids execution composition on Human Steps and terminal nodes", () => {
    expect(issuePaths(withFirstNode({
      ...step,
      type: "human",
      executionProfileId: profile.id
    }))).toContain("loops.0.nodes.0");

    const terminal = validConfig();
    const terminalWithComposition = {
      ...terminal.loops[0]!.nodes[1]!,
      executionProfileId: profile.id
    };
    expect(issuePaths({
      ...terminal,
      loops: [{
        ...terminal.loops[0]!,
        nodes: [step, terminalWithComposition, ...terminal.loops[0]!.nodes.slice(2)]
      }]
    })).toContain("loops.0.nodes.1");
  });
});
