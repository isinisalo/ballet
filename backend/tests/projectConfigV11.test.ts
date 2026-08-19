import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { automationConfigSchema, projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { maxLoopCapabilities, maxProjectStateBytes } from "../../shared/domain/automation.js";
import { validateProjectAutomationConfig } from "../automation/validateAutomationConfig.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { testAutomationConfig, testLoop, testProjectConfiguration, testWorkLoopNode } from "./v11TestConfig.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("strict-v11 project configuration", () => {
  it("round-trips the v11 authoring shape and rejects unknown fields", () => {
    const value = testProjectConfiguration();
    expect(projectConfigSchema.parse(value)).toEqual(value);
    expect(projectConfigSchema.safeParse({ ...value, steps: [] }).success).toBe(false);
    expect(projectConfigSchema.safeParse({ ...value, loopEdges: [] }).success).toBe(false);
    expect(automationConfigSchema.safeParse({ ...testAutomationConfig(), version: 10 }).success).toBe(false);
    expect(automationConfigSchema.safeParse({
      ...testAutomationConfig(),
      loops: [{ ...testLoop(), nodes: [{ ...testWorkLoopNode(), approved: "completed" }] }]
    }).success).toBe(false);
  });

  it("returns the exact hard-cut error for strict-v10 project.json", async () => {
    const root = await temporaryProject();
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ version: 10, executionProfiles: [], loops: [] }));
    const loaded = new ProjectConfigurationRepository().load(root);
    expect(loaded.config).toBeUndefined();
    expect(loaded.issues).toEqual([{
      code: "invalid_schema",
      path: "version",
      message: "Project configuration version 10 is not supported; update the project to strict v11."
    }]);
  });

  it("persists orchestrator, Loops, node edges, and Loop Edges without mutable runtime state", async () => {
    const root = await temporaryProject();
    const repository = new ProjectConfigurationRepository();
    const project = testProjectConfiguration();
    project.graph.loopEdges = [{
      id: "main-repair",
      source: "main-loop",
      target: "main-loop",
      kind: "repair",
      capability: "test:loop.transfer",
      description: "Allow bounded self-repair."
    }];
    await writeFile(path.join(root, ".ballet", "project.json"), `${JSON.stringify(project)}\n`);
    repository.putAutomation(root, {
      version: 11,
      orchestrator: project.orchestrator,
      graph: project.graph,
      loops: project.loops
    });
    const persisted = JSON.parse(await readFile(path.join(root, ".ballet", "project.json"), "utf8")) as Record<string, unknown>;
    expect(persisted.version).toBe(11);
    expect(persisted).toHaveProperty("orchestrator.maxRepairDepth", 4);
    expect(persisted).toHaveProperty("loops.0.state.initial");
    expect(persisted).toHaveProperty("loops.0.capabilities", {
      accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"]
    });
    expect(persisted).toHaveProperty("graph.loopEdges.0.capability", "test:loop.transfer");
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

describe("strict-v11 schema boundaries", () => {
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

  it.each([
    ["empty", ["   "]],
    ["duplicate", ["test:loop.transfer", "test:loop.transfer"]],
    ["too long", [`test:${"x".repeat(196)}`]],
    ["invalid namespace", ["not-namespaced"]],
    ["invalid charset", ["Test:loop.transfer"]]
  ])("rejects %s Loop capabilities", (_case, accepts) => {
    const config = testAutomationConfig();
    config.loops[0]!.capabilities.accepts = accepts;
    expect(automationConfigSchema.safeParse(config).success).toBe(false);
  });

  it("trims capabilities canonically and enforces the list maximum", () => {
    const canonical = testAutomationConfig();
    canonical.loops[0]!.capabilities.accepts = ["  test:loop.transfer  "];
    expect(automationConfigSchema.parse(canonical).loops[0]!.capabilities.accepts).toEqual(["test:loop.transfer"]);

    const tooMany = testAutomationConfig();
    tooMany.loops[0]!.capabilities.accepts = Array.from(
      { length: maxLoopCapabilities + 1 },
      (_, index) => `test:capability.${index}`
    );
    expect(automationConfigSchema.safeParse(tooMany).success).toBe(false);
  });

  it("validates globally unique node and edge ids plus Loop Edge references", () => {
    const config = testAutomationConfig();
    const other = testLoop("other-loop", testWorkLoopNode("work"));
    config.loops.push(other);
    config.graph.loopEdges = [{
      id: config.loops[0]!.edges[0]!.id, source: "main-loop", target: "missing-loop",
      kind: "repair", capability: "test:loop.transfer", description: "Invalid route."
    }];
    const issues = validateProjectAutomationConfig(config, testProjectConfiguration().executionProfiles);
    expect(issues.some((issue) => issue.message === "Duplicate Work Loop Node id: work.")).toBe(true);
    expect(issues.some((issue) => issue.message === `Duplicate Edge id: ${config.graph.loopEdges[0]!.id}.`)).toBe(true);
    expect(issues.some((issue) => issue.message === "Loop Edge references an unknown target Loop: missing-loop.")).toBe(true);
  });

  it("rejects duplicate route candidates and capability-incompatible targets", () => {
    const config = testAutomationConfig();
    config.graph.loopEdges = [
      { id: "repair-a", source: "main-loop", target: "main-loop", kind: "repair", capability: "test:loop.transfer", description: "First route." },
      { id: "repair-b", source: "main-loop", target: "main-loop", kind: "repair", capability: "test:loop.transfer", description: "Duplicate route." }
    ];

    expect(validateProjectAutomationConfig(config, testProjectConfiguration().executionProfiles)).toContainEqual({
      path: "graph.loopEdges.1.capability",
      message: "Duplicate Loop Edge route candidate id: main-loop→main-loop:repair:test:loop.transfer."
    });
    config.graph.loopEdges[1] = {
      ...config.graph.loopEdges[1]!, id: "repair-c", capability: "test:missing.capability"
    };
    expect(messages(config, testProjectConfiguration().executionProfiles)).toContain(
      "Repair Loop Edge capability test:missing.capability is not provided by target Loop main-loop."
    );
  });
});

const messages = (value: unknown, profiles: ReturnType<typeof testProjectConfiguration>["executionProfiles"]): string[] =>
  validateProjectAutomationConfig(value, profiles).map((issue) => issue.message);

const temporaryProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-v11-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet"));
  return root;
};
