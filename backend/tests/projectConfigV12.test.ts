import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { automationConfigSchema, projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { maxLoopCapabilities, maxProjectStateBytes } from "../../shared/domain/automation.js";
import { validateProjectAutomationConfig } from "../automation/validateAutomationConfig.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { testAutomationConfig, testJobPair, testLoop, testProjectConfiguration } from "./v12TestConfig.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("strict-v12 project configuration", () => {
  it("round-trips the v12 Workflow shape and rejects unknown or legacy fields", () => {
    const value = testProjectConfiguration();
    expect(projectConfigSchema.parse(value)).toEqual(value);
    expect(projectConfigSchema.safeParse({ ...value, steps: [] }).success).toBe(false);
    expect(automationConfigSchema.safeParse({ ...testAutomationConfig(), version: 11 }).success).toBe(false);
    const loop = testLoop() as unknown as Record<string, unknown>;
    delete loop.workflow;
    Object.assign(loop, { startNodeId: "job", nodes: [], edges: [] });
    expect(automationConfigSchema.safeParse({ ...testAutomationConfig(), loops: [loop] }).success).toBe(false);
  });

  it("rejects v11 without a compatibility reader", async () => {
    const root = await temporaryProject();
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ version: 11, executionProfiles: [], loops: [] }));
    const loaded = new ProjectConfigurationRepository().load(root);
    expect(loaded.config).toBeUndefined();
    expect(loaded.issues).toEqual([{
      code: "invalid_schema", path: "version",
      message: "Strict project config version 12 is required; version 11 is not supported."
    }]);
  });

  it("persists Workflow collections and Graph LoopEdges without mutable runtime State", async () => {
    const root = await temporaryProject();
    const repository = new ProjectConfigurationRepository();
    const project = testProjectConfiguration();
    project.graph.loopEdges = [{
      id: "main-repair", source: "main-loop", target: "main-loop", kind: "repair",
      capability: "test:loop.transfer", description: "Allow bounded self-repair."
    }];
    await writeFile(path.join(root, ".ballet", "project.json"), `${JSON.stringify(project)}\n`);
    repository.putAutomation(root, { version: 12, orchestrator: project.orchestrator, graph: project.graph, loops: project.loops });
    const persisted = JSON.parse(await readFile(path.join(root, ".ballet", "project.json"), "utf8")) as Record<string, unknown>;
    expect(persisted.version).toBe(12);
    expect(persisted).toHaveProperty("loops.0.workflow.startJobNodeId", "job");
    expect(persisted).toHaveProperty("loops.0.workflow.validationNodes.0.id", "job-validation");
    expect(persisted).toHaveProperty("loops.0.workflow.passEdges.0.target.workflowResult", "PASS");
    expect(persisted).toHaveProperty("loops.0.workflow.failEdges.0.target.workflowResult", "FAIL");
    expect(JSON.stringify(persisted)).not.toContain("revision");
    expect(repository.load(root).issues).toEqual([]);
  });

  it("validates 1:1 ownership, exact edge counts, scheduling, reachability, and PASS termination", () => {
    const profiles = testProjectConfiguration().executionProfiles;
    const missingPass = testAutomationConfig();
    missingPass.loops[0]!.workflow.passEdges = [];
    expect(messages(missingPass, profiles)).toContain("ValidationNode job-validation must have exactly one PassEdge; found 0.");

    const shared = testAutomationConfig();
    const second = testJobPair("second");
    shared.loops[0]!.workflow.jobNodes.push({ ...second.job, validationNodeId: "job-validation" });
    shared.loops[0]!.workflow.validationNodes.push(second.validation);
    shared.loops[0]!.workflow.failEdges.push({ id: "second-fail", sourceValidationNodeId: second.validation.id, target: { workflowResult: "FAIL" } });
    expect(messages(shared, profiles).some((message) => /already owned|not owned/.test(message))).toBe(true);

    const cycle = testAutomationConfig();
    cycle.loops[0]!.workflow.passEdges[0]!.target = { jobNodeId: "job" };
    expect(messages(cycle, profiles).some((message) => message.includes("PASS result reachable"))).toBe(true);

    const scheduled = testAutomationConfig();
    const scheduledPair = testJobPair("scheduled", { scheduled: { kind: "once", date: "2026-08-16", time: "09:00", timeZone: "UTC" } });
    scheduled.loops[0]!.workflow.jobNodes.push(scheduledPair.job);
    scheduled.loops[0]!.workflow.validationNodes.push(scheduledPair.validation);
    scheduled.loops[0]!.workflow.passEdges[0]!.target = { jobNodeId: scheduledPair.job.id };
    scheduled.loops[0]!.workflow.passEdges.push({ id: "scheduled-pass", sourceValidationNodeId: scheduledPair.validation.id, target: { workflowResult: "PASS" } });
    scheduled.loops[0]!.workflow.failEdges.push({ id: "scheduled-fail", sourceValidationNodeId: scheduledPair.validation.id, target: { workflowResult: "FAIL" } });
    expect(messages(scheduled, profiles)).toContain("A scheduled JobNode is allowed only as the Workflow start JobNode.");
  });
});

describe("strict-v12 schema boundaries", () => {
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
    expect(automationConfigSchema.parse(canonical).loops[0]!.capabilities.accepts).toEqual(["test:loop.transfer"]);
    const tooMany = testAutomationConfig();
    tooMany.loops[0]!.capabilities.accepts = Array.from({ length: maxLoopCapabilities + 1 }, (_, index) => `test:capability.${index}`);
    expect(automationConfigSchema.safeParse(tooMany).success).toBe(false);
  });

  it("validates globally unique Job, Validation, and Edge IDs plus Graph references", () => {
    const config = testAutomationConfig();
    const other = testLoop("other-loop", testJobPair("job"));
    other.workflow.validationNodes[0]!.id = "job-validation";
    other.workflow.jobNodes[0]!.validationNodeId = "job-validation";
    config.loops.push(other);
    config.graph.loopEdges = [{
      id: config.loops[0]!.workflow.passEdges[0]!.id, source: "main-loop", target: "missing-loop",
      kind: "repair", capability: "test:loop.transfer", description: "Invalid route."
    }];
    const combined = messages(config, testProjectConfiguration().executionProfiles).join("\n");
    expect(combined).toMatch(/Duplicate Workflow Node id/);
    expect(combined).toMatch(/Duplicate Edge id|Duplicate edge id/);
    expect(combined).toMatch(/unknown target Loop/);
  });
});

const messages = (value: unknown, profiles: ReturnType<typeof testProjectConfiguration>["executionProfiles"]): string[] =>
  validateProjectAutomationConfig(value, profiles).map((issue) => issue.message);

const temporaryProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-v12-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet"));
  return root;
};
