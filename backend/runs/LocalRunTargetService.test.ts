import { describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes, type ProjectLoop } from "../../shared/domain/automation.js";
import type { ProjectInstruction, ProjectResourceIssue, Skill } from "../../shared/domain/documents.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import { MAX_PRIMARY_INSTRUCTION_BYTES } from "../execution/ExecutionComposition.js";
import type { ExecutionProfileRuntimeConfiguration } from "../execution/RuntimeConfigurationService.js";
import { LocalRunTargetService } from "./LocalRunTargetService.js";
import type { RootRunStore } from "./RootRunStore.js";

const profile = (id: string): ExecutionProfile => ({
  id,
  name: id,
  provider: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
  networkAccess: false
});

const loops: ProjectLoop[] = [{
  id: "source",
  start: "work",
  nodes: [{
    id: "work",
    type: "agent",
    executionProfileId: "primary",
    primaryInstructionId: "project:work",
    skillIds: [],
    description: "Complete the work.",
    nodeStyle: "terra",
    nodeSize: "medium",
    on: { approved: { loop: "scheduled" }, rejected: "blocked" }
  }, ...defaultTerminalNodes()]
}, {
  id: "scheduled",
  start: "scheduled-work",
  nodes: [{
    id: "scheduled-work",
    type: "scheduled",
    executionProfileId: "secondary",
    primaryInstructionId: "project:scheduled-work",
    skillIds: ["project:checks"],
    description: "Run the scheduled work.",
    nodeStyle: "luna",
    nodeSize: "tiny",
    schedule: { kind: "once", date: "2026-07-20", time: "09:00", timeZone: "UTC" },
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
}];

const roots = {
  active: vi.fn((_kind: "loop", id: string) => id === "source" ? { rootRunId: "root-active" } : undefined),
  latest: vi.fn((_kind: "loop", id: string) => id === "source" ? { rootRunId: "root-latest" } : undefined)
} as unknown as RootRunStore;

const instruction = (id: string): ProjectInstruction => ({
  id: `project:${id}`,
  projectId: id,
  title: id,
  body: `Follow ${id}.`,
  relativePath: `.ballet/instructions/${id}.md`,
  origin: "project",
  valid: true,
  sourceSha256: "a".repeat(64),
  contentSha256: "b".repeat(64),
  sizeBytes: 32
});

const skill: Skill = {
  id: "project:checks",
  projectId: "checks",
  name: "checks",
  description: "Run checks.",
  body: "Run the required checks.",
  relativePath: ".agents/skills/checks/SKILL.md",
  metadata: {},
  origin: "project",
  valid: true,
  sourceSha256: "c".repeat(64),
  contentSha256: "d".repeat(64),
  sizeBytes: 32
};

const data = (executionProfiles: ExecutionProfile[], automationIssues: Array<{ path: string; message: string }> = []) => ({
  executionProfiles,
  automation: { version: 9 as const, loops: structuredClone(loops) },
  automationIssues,
  loopTheme: defaultLoopTheme,
  loopThemeIssues: [] as Array<{ path: string; message: string }>,
  instructions: [instruction("work"), instruction("scheduled-work")],
  skills: [skill],
  resourceIssues: []
});

describe("LocalRunTargetService", () => {
  it("marks a Loop ready only when every reachable Step profile resolves locally", () => {
    const configurations: Record<string, ExecutionProfileRuntimeConfiguration> = {
      primary: { issues: [] },
      secondary: { issues: [] }
    };

    const result = new LocalRunTargetService(roots).list(
      data([profile("primary"), profile("secondary")]),
      configurations
    );

    expect(result.loops).toEqual([
      expect.objectContaining({
        id: "source",
        description: "Complete the work.",
        ready: true,
        issues: [],
        activeRootRunId: "root-active",
        latestRootRunId: "root-latest"
      }),
      expect.objectContaining({ id: "scheduled", ready: true, issues: [] })
    ]);
  });

  it("reports missing reachable profiles and local runtime configuration failures", () => {
    const configurations: Record<string, ExecutionProfileRuntimeConfiguration> = {
      primary: {
        issues: [{
          code: "provider_unavailable",
          path: "executionProfiles.primary.provider",
          executionProfileId: "primary",
          message: "Codex is unavailable."
        }]
      }
    };

    const result = new LocalRunTargetService(roots).list(data([profile("primary")]), configurations);

    expect(result.loops[0]).toMatchObject({
      id: "source",
      ready: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_runtime_config",
          executionProfileId: "primary",
          stepId: "work"
        }),
        expect.objectContaining({
          code: "missing_resource",
          executionProfileId: "secondary",
          stepId: "scheduled-work"
        })
      ])
    });
  });

  it("fails closed on project or theme validation issues without traversing an invalid graph", () => {
    const invalid = data([], [{ path: "loops.0", message: "Invalid Loop graph." }]);
    invalid.loopThemeIssues.push({ path: ".ballet/theme.json", message: "Invalid theme." });
    invalid.automation.loops[0] = {
      ...invalid.automation.loops[0]!,
      nodes: [],
      start: "missing"
    };

    const result = new LocalRunTargetService(roots).list(invalid, {});

    expect(result.loops[0]).toMatchObject({
      ready: false,
      issues: [
        { code: "invalid_config", path: "loops.0", message: "Invalid Loop graph." },
        { code: "invalid_config", path: ".ballet/theme.json", message: "Invalid theme." }
      ]
    });
  });

  it("surfaces an oversized selected primary instruction as visible preflight", () => {
    const oversized = data([profile("primary"), profile("secondary")]);
    const body = `${"é".repeat(MAX_PRIMARY_INSTRUCTION_BYTES / 2)}x`;
    oversized.instructions[0] = {
      ...oversized.instructions[0]!,
      body,
      sizeBytes: Buffer.byteLength(body, "utf8")
    };

    const result = new LocalRunTargetService(roots).list(oversized, {
      primary: { issues: [] },
      secondary: { issues: [] }
    });

    expect(result.loops[0]).toMatchObject({
      ready: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_resource" })])
    });
  });
});

describe("LocalRunTargetService resource scoping", () => {
  it("scopes missing Step references to reachable Loops but keeps catalog corruption global", () => {
    const disconnectedLoops: ProjectLoop[] = [{
      id: "valid-root",
      start: "work",
      nodes: [{
        id: "work",
        type: "agent",
        executionProfileId: "primary",
        primaryInstructionId: "project:work",
        skillIds: [],
        description: "Complete valid work.",
        nodeStyle: "terra",
        nodeSize: "medium",
        on: { approved: "completed", rejected: "blocked" }
      }, ...defaultTerminalNodes()]
    }, {
      id: "disconnected-invalid",
      start: "invalid-work",
      nodes: [{
        id: "invalid-work",
        type: "agent",
        executionProfileId: "primary",
        primaryInstructionId: "project:missing",
        skillIds: ["project:missing"],
        description: "This Loop is disconnected.",
        nodeStyle: "flat",
        nodeSize: "medium",
        on: { approved: "completed", rejected: "blocked" }
      }, ...defaultTerminalNodes()]
    }];
    const disconnected = {
      ...data([profile("primary")]),
      automation: { version: 9 as const, loops: disconnectedLoops },
      automationIssues: [
        {
          path: "loops.1.nodes.0.primaryInstructionId",
          message: "Step references a missing primary instruction."
        },
        { path: "loops.1.nodes.0.skillIds.0", message: "Step references a missing skill." }
      ]
    };
    const configurations = { primary: { issues: [] } };
    const service = new LocalRunTargetService(roots);

    const scoped = service.list(disconnected, configurations);

    expect(scoped.loops[0]).toMatchObject({ id: "valid-root", ready: true, issues: [] });
    expect(scoped.loops[1]).toMatchObject({
      id: "disconnected-invalid",
      ready: false,
      issues: [expect.objectContaining({ code: "missing_resource" })]
    });

    const duplicateIssue: ProjectResourceIssue = {
      kind: "instruction",
      code: "duplicate_id",
      relativePath: ".ballet/instructions/duplicate.md",
      resourceId: "project:duplicate",
      message: "Instruction id project:duplicate is duplicated."
    };
    const globallyInvalid = service.list({
      ...disconnected,
      resourceIssues: [duplicateIssue]
    }, configurations);
    expect(globallyInvalid.loops[0]).toMatchObject({
      id: "valid-root",
      ready: false,
      issues: [expect.objectContaining({ code: "invalid_resource", message: expect.stringContaining("duplicate") })]
    });
  });
});
