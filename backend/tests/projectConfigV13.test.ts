import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { automationConfigSchema, projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  maxLoopCapabilities, maxProjectStateBytes, type ProjectAutomationConfig
} from "../../shared/domain/automation.js";
import { validateProjectAutomationConfig } from "../automation/validateAutomationConfig.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import {
  testAutomationConfig, testJobPair, testLoop, testOrchestrator,
  testProjectConfiguration, testRunbookOrchestrator
} from "./v13TestConfig.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("strict-v13 project configuration", () => {
  it("round-trips the exact v13 shape and rejects v12, unknown, and loopEdges fields", () => {
    const value = testProjectConfiguration();
    expect(projectConfigSchema.parse(value)).toEqual(value);
    expect(projectConfigSchema.safeParse({ ...value, steps: [] }).success).toBe(false);
    expect(automationConfigSchema.safeParse({ ...testAutomationConfig(), version: 12 }).success).toBe(false);
    expect(automationConfigSchema.safeParse({
      ...testAutomationConfig(),
      graph: { loopEdges: [] }
    }).success).toBe(false);
  });

  it("rejects v12 without a compatibility reader and leaves the source untouched", async () => {
    const root = await temporaryProject();
    const source = `${JSON.stringify({ version: 12, executionProfiles: [], loops: [] })}\n`;
    const filename = path.join(root, ".ballet", "project.json");
    await writeFile(filename, source);
    const loaded = new ProjectConfigurationRepository().load(root);
    expect(loaded.config).toBeUndefined();
    expect(loaded.issues).toEqual([{
      code: "invalid_schema", path: "version",
      message: "Strict project config version 13 is required; version 12 is not supported."
    }]);
    expect(await readFile(filename, "utf8")).toBe(source);
  });

  it.each([1, 5, 40])("accepts a reachable %i-Loop Graph with a DONE path", (count) => {
    const config = graphConfig(count);
    expect(automationConfigSchema.safeParse(config).success).toBe(true);
    expect(messages(config)).toEqual([]);
  });

  it("rejects missing start, unreachable Loops, duplicate result keys, and a missing DONE path", () => {
    const missingStart = graphConfig(5);
    missingStart.graph.startLoopId = "missing";
    expect(messages(missingStart).join("\n")).toMatch(/startLoopId.*unknown Loop.*missing/i);

    const unreachable = graphConfig(5);
    unreachable.graph.transitions = unreachable.graph.transitions.filter(({ source }) => source !== "loop-2");
    expect(messages(unreachable).join("\n")).toMatch(/unreachable|not reachable/i);

    const duplicate = graphConfig(5);
    duplicate.graph.transitions.push({
      id: "duplicate-result", source: "loop-1", decision: "PASS", outcome: "success",
      target: { runResult: "DONE" }, description: "Duplicate exact result key."
    });
    expect(messages(duplicate).join("\n")).toMatch(/duplicate.*runbook transition key|duplicate transition/i);

    const noDone = graphConfig(5);
    const terminal = noDone.graph.transitions.at(-1)!;
    terminal.target = { loopId: terminal.source };
    expect(messages(noDone).join("\n")).toMatch(/DONE/i);
  });

  it("rejects invalid outcome names and keeps transitions separate from repair routes", () => {
    const invalidOutcome = graphConfig(1);
    invalidOutcome.graph.transitions[0]!.outcome = "Not Valid";
    expect(automationConfigSchema.safeParse(invalidOutcome).success).toBe(false);

    const invalidTransition = graphConfig(1) as unknown as Record<string, unknown>;
    const graph = invalidTransition.graph as { transitions: Array<Record<string, unknown>> };
    graph.transitions[0]!.capability = "test:loop.transfer";
    expect(automationConfigSchema.safeParse(invalidTransition).success).toBe(false);

    const repair = graphConfig(1);
    repair.orchestrator = testOrchestrator();
    repair.graph.repairEdges = [{
      id: "self-repair", source: "loop-1", target: "loop-1",
      capability: "test:loop.transfer", description: "Allow bounded self repair."
    }];
    expect(messages(repair)).toEqual([]);
  });

  it("persists named transitions and repairs without mutable runtime State", async () => {
    const root = await temporaryProject();
    const repository = new ProjectConfigurationRepository();
    const project = testProjectConfiguration();
    project.orchestrator = testOrchestrator();
    project.graph.repairEdges = [{
      id: "main-repair", source: "main-loop", target: "main-loop",
      capability: "test:loop.transfer", description: "Allow bounded self-repair."
    }];
    await writeFile(path.join(root, ".ballet", "project.json"), `${JSON.stringify(project)}\n`);
    repository.putAutomation(root, {
      version: 13, orchestrator: project.orchestrator, graph: project.graph, loops: project.loops
    });
    const persisted = JSON.parse(await readFile(path.join(root, ".ballet", "project.json"), "utf8")) as Record<string, unknown>;
    expect(persisted.version).toBe(13);
    expect(persisted).toHaveProperty("graph.startLoopId", "main-loop");
    expect(persisted).toHaveProperty("graph.transitions.0.outcome", "success");
    expect(persisted).toHaveProperty("graph.repairEdges.0.capability", "test:loop.transfer");
    expect(persisted).toHaveProperty("loops.0.workflow.validationNodes.0.id", "job-validation");
    expect(JSON.stringify(persisted)).not.toContain('"revision"');
    expect(repository.load(root).issues).toEqual([]);
  });

  it("retains Workflow ownership, scheduling, reachability, and PASS termination invariants", () => {
    const missingPass = testAutomationConfig();
    missingPass.loops[0]!.workflow.passEdges = [];
    expect(messages(missingPass)).toContain("ValidationNode job-validation must have exactly one PassEdge; found 0.");

    const cycle = testAutomationConfig();
    cycle.loops[0]!.workflow.passEdges[0]!.target = { jobNodeId: "job" };
    expect(messages(cycle).some((message) => message.includes("PASS result reachable"))).toBe(true);

    const scheduled = testAutomationConfig();
    const pair = testJobPair("scheduled", {
      scheduled: { kind: "once", date: "2026-08-16", time: "09:00", timeZone: "UTC" }
    });
    scheduled.loops[0]!.workflow.jobNodes.push(pair.job);
    scheduled.loops[0]!.workflow.validationNodes.push(pair.validation);
    scheduled.loops[0]!.workflow.passEdges[0]!.target = { jobNodeId: pair.job.id };
    scheduled.loops[0]!.workflow.passEdges.push({
      id: "scheduled-pass", sourceValidationNodeId: pair.validation.id, target: { workflowResult: "PASS" }
    });
    scheduled.loops[0]!.workflow.failEdges.push({
      id: "scheduled-fail", sourceValidationNodeId: pair.validation.id, target: { workflowResult: "FAIL" }
    });
    expect(messages(scheduled)).toContain("A scheduled JobNode is allowed only as the Workflow start JobNode.");
  });
});

describe("strict-v13 schema boundaries", () => {
  it("accepts the exact initial State byte limit and rejects one byte over", () => {
    const config = testAutomationConfig();
    config.loops[0]!.state.initial = "x".repeat(maxProjectStateBytes - 2);
    expect(automationConfigSchema.safeParse(config).success).toBe(true);
    config.loops[0]!.state.initial = "x".repeat(maxProjectStateBytes - 1);
    expect(automationConfigSchema.safeParse(config).success).toBe(false);
  });

  it.each([
    ["empty", ["   "]], ["duplicate", ["test:loop.transfer", "test:loop.transfer"]],
    ["too long", [`test:${"x".repeat(196)}`]], ["invalid namespace", ["not-namespaced"]],
    ["invalid charset", ["Test:loop.transfer"]]
  ])("rejects %s Loop capabilities", (_case, accepts) => {
    const config = testAutomationConfig();
    config.loops[0]!.capabilities.accepts = accepts;
    expect(automationConfigSchema.safeParse(config).success).toBe(false);
  });

  it("trims capabilities and enforces the list maximum", () => {
    const canonical = testAutomationConfig();
    canonical.loops[0]!.capabilities.accepts = ["  test:loop.transfer  "];
    expect(automationConfigSchema.parse(canonical).loops[0]!.capabilities.accepts)
      .toEqual(["test:loop.transfer"]);
    const tooMany = testAutomationConfig();
    tooMany.loops[0]!.capabilities.accepts = Array.from(
      { length: maxLoopCapabilities + 1 }, (_, index) => `test:capability.${index}`
    );
    expect(automationConfigSchema.safeParse(tooMany).success).toBe(false);
  });
});

const graphConfig = (count: number): ProjectAutomationConfig => {
  const loops = Array.from({ length: count }, (_, index) => {
    const id = `loop-${index + 1}`;
    return testLoop(id, testJobPair(`${id}-job`));
  });
  return {
    version: 13,
    orchestrator: testRunbookOrchestrator(),
    graph: {
      id: "test-graph",
      name: "Test Graph",
      startLoopId: loops[0]!.id,
      transitions: loops.map((loop, index) => ({
        id: `${loop.id}-success`,
        source: loop.id,
        decision: "PASS" as const,
        outcome: "success",
        target: index === loops.length - 1 ? { runResult: "DONE" as const } : { loopId: loops[index + 1]!.id },
        description: `Continue from ${loop.id}.`
      })),
      repairEdges: []
    },
    loops
  };
};

const messages = (value: unknown): string[] => validateProjectAutomationConfig(
  value,
  testProjectConfiguration().executionProfiles
).map((issue) => issue.message);

const temporaryProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-v13-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet"));
  return root;
};
