import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { automationConfigSchema, projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { maxProjectStateBytes } from "../../shared/domain/automation.js";
import { validateProjectAutomationConfig } from "../automation/validateAutomationConfig.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { testAutomationConfig, testLoop, testProjectConfiguration, testWorkLoopNode } from "./v10TestConfig.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("strict-v10 project configuration", () => {
  it("parses the v10 authoring shape and rejects unknown fields", () => {
    const value = testProjectConfiguration();
    expect(projectConfigSchema.parse(value)).toEqual(value);
    expect(projectConfigSchema.safeParse({ ...value, steps: [] }).success).toBe(false);
    expect(automationConfigSchema.safeParse({ ...testAutomationConfig(), version: 9 }).success).toBe(false);
    expect(automationConfigSchema.safeParse({
      ...testAutomationConfig(),
      loops: [{ ...testLoop(), nodes: [{ ...testWorkLoopNode(), approved: "completed" }] }]
    }).success).toBe(false);
  });

  it("returns the exact hard-cut error for strict-v9 project.json", async () => {
    const root = await temporaryProject();
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ version: 9, executionProfiles: [], loops: [] }));
    const loaded = new ProjectConfigurationRepository().load(root);
    expect(loaded.config).toBeUndefined();
    expect(loaded.issues).toEqual([{
      code: "invalid_schema",
      path: "version",
      message: "Project configuration version 9 is not supported; update the project to strict v10."
    }]);
  });

  it("persists orchestrator, Loops, node edges, and Loop Edges without mutable runtime state", async () => {
    const root = await temporaryProject();
    const repository = new ProjectConfigurationRepository();
    const project = testProjectConfiguration();
    project.loopEdges = [{
      id: "main-repair",
      source: "main-loop",
      target: "main-loop",
      kind: "repair",
      description: "Allow bounded self-repair."
    }];
    await writeFile(path.join(root, ".ballet", "project.json"), `${JSON.stringify(project)}\n`);
    repository.putAutomation(root, {
      version: 10,
      orchestrator: project.orchestrator,
      loops: project.loops,
      loopEdges: project.loopEdges
    });
    const persisted = JSON.parse(await readFile(path.join(root, ".ballet", "project.json"), "utf8")) as Record<string, unknown>;
    expect(persisted.version).toBe(10);
    expect(persisted).toHaveProperty("orchestrator.maxRepairDepth", 4);
    expect(persisted).toHaveProperty("loops.0.state.initial");
    expect(JSON.stringify(persisted)).not.toContain("revision");
    expect(repository.load(root).issues).toEqual([]);
  });

  it("validates deterministic OK edges, references, scheduling, reachability, and cycles", () => {
    const profile = testProjectConfiguration().executionProfiles;
    const missingOutput = testAutomationConfig();
    missingOutput.loops[0]!.edges = [];
    expect(messages(missingOutput, profile)).toContain("Validation OK output for Work Loop Node work must have exactly one target; found 0.");

    const unknownTarget = testAutomationConfig();
    unknownTarget.loops[0]!.edges[0]!.target = { nodeId: "missing" };
    expect(messages(unknownTarget, profile)).toContain("Node edge references an unknown target Work Loop Node: missing.");

    const cycle = testAutomationConfig();
    cycle.loops[0]!.edges[0]!.target = { nodeId: "work" };
    expect(messages(cycle, profile).some((message) => message.includes("non-terminating node cycles"))).toBe(true);

    const second = testWorkLoopNode("scheduled", {
      scheduled: { kind: "once", date: "2026-08-16", time: "09:00", timeZone: "UTC" }
    });
    const scheduled = testAutomationConfig();
    scheduled.loops[0]!.nodes.push(second);
    scheduled.loops[0]!.edges = [
      { id: "work-next", source: "work", target: { nodeId: "scheduled" } },
      { id: "scheduled-done", source: "scheduled", target: { terminal: "completed" } }
    ];
    expect(messages(scheduled, profile)).toContain("A scheduled Work Node is allowed only in the Loop start Work Loop Node.");

    const ambiguousOutput = testAutomationConfig();
    ambiguousOutput.loops[0]!.edges.push({
      id: "work-blocked",
      source: "work",
      target: { terminal: "blocked" }
    });
    expect(messages(ambiguousOutput, profile)).toContain("Validation OK output for Work Loop Node work must have exactly one target; found 2.");
  });
});

describe("strict-v10 schema boundaries", () => {
  it("enforces Loop descriptions, Validation variants, and execution profile references", () => {
    const emptyDescription = testAutomationConfig();
    emptyDescription.loops[0]!.description = "   ";
    expect(automationConfigSchema.safeParse(emptyDescription).success).toBe(false);

    const node = testWorkLoopNode();
    expect(automationConfigSchema.safeParse({
      ...testAutomationConfig(),
      loops: [{
        ...testLoop(),
        nodes: [{
          ...node,
          validation: {
            ...node.work,
            type: "scheduled",
            schedule: { kind: "once", date: "2026-08-16", time: "09:00", timeZone: "UTC" }
          }
        }]
      }]
    }).success).toBe(false);

    const missingProfiles = testAutomationConfig(testLoop("main-loop", testWorkLoopNode("work", { validation: "agent" })));
    missingProfiles.orchestrator.executionProfileId = "missing-profile";
    expect(messages(missingProfiles, testProjectConfiguration().executionProfiles)).toContain(
      "Orchestrator references unknown execution profile: missing-profile."
    );
  });

  it("accepts the exact initial State byte limit and rejects one byte over", () => {
    const config = testAutomationConfig();
    config.loops[0]!.state.initial = "x".repeat(maxProjectStateBytes - 2);
    expect(automationConfigSchema.safeParse(config).success).toBe(true);
    config.loops[0]!.state.initial = "x".repeat(maxProjectStateBytes - 1);
    const oversized = automationConfigSchema.safeParse(config);
    expect(oversized.success).toBe(false);
    if (!oversized.success) expect(oversized.error.issues.some((issue) => issue.message.includes("Initial Loop state"))).toBe(true);
  });

  it("validates globally unique node and edge ids plus Loop Edge references", () => {
    const config = testAutomationConfig();
    const other = testLoop("other-loop", testWorkLoopNode("work"));
    config.loops.push(other);
    config.loopEdges = [{ id: config.loops[0]!.edges[0]!.id, source: "main-loop", target: "missing-loop", kind: "repair", description: "Invalid route." }];
    const issues = validateProjectAutomationConfig(config, testProjectConfiguration().executionProfiles);
    expect(issues.some((issue) => issue.message === "Duplicate Work Loop Node id: work.")).toBe(true);
    expect(issues.some((issue) => issue.message === `Duplicate Edge id: ${config.loopEdges[0]!.id}.`)).toBe(true);
    expect(issues.some((issue) => issue.message === "Loop Edge references an unknown target Loop: missing-loop.")).toBe(true);
  });

  it("requires one unambiguous repair Loop Edge per source and target pair", () => {
    const config = testAutomationConfig();
    config.loopEdges = [
      { id: "repair-a", source: "main-loop", target: "main-loop", kind: "repair", description: "First route." },
      { id: "repair-b", source: "main-loop", target: "main-loop", kind: "repair", description: "Ambiguous route." }
    ];

    expect(validateProjectAutomationConfig(config, testProjectConfiguration().executionProfiles)).toContainEqual({
      path: "loopEdges.1.target",
      message: "Duplicate repair Loop Edge source/target route id: main-loop→main-loop."
    });
  });
});

const messages = (value: unknown, profiles: ReturnType<typeof testProjectConfiguration>["executionProfiles"]): string[] =>
  validateProjectAutomationConfig(value, profiles).map((issue) => issue.message);

const temporaryProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-v10-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet"));
  return root;
};
