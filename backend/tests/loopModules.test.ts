import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loopModulePackageV2Schema } from "../../shared/api/loop-module-schemas.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import { LoopModuleService } from "../loop-modules/LoopModuleService.js";
import { canonicalLoopModuleJson } from "../loop-modules/canonicalLoopModule.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { validateProjectAutomationConfig, validateProjectExecutionResources } from "../automation.js";
import type { RuntimeDatabaseProvider } from "../services/RuntimeDatabaseProvider.js";
import { testLoopModulePackage } from "./loopModuleTestFixture.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LoopModulePackageV2", () => {
  it("round-trips a strict canonical package", () => {
    const parsed = loopModulePackageV2Schema.parse(testLoopModulePackage());
    expect(loopModulePackageV2Schema.parse(JSON.parse(canonicalLoopModuleJson(parsed)))).toEqual(parsed);
  });

  it("rejects malformed UTF-8, oversized content, schema downgrade, and unknown fields", async () => {
    const service = new LoopModuleService(() => "/unused", runtime());
    expect(service.inspectJson(Uint8Array.from([0xff]), "bad").issues[0]?.code).toBe("INVALID_UTF8");
    expect(service.inspect({ ...testLoopModulePackage(), version: 0 }, "old").issues[0]?.code).toBe("SCHEMA_DOWNGRADE");
    expect(service.inspect({ ...testLoopModulePackage(), surprise: true }, "unknown").issues[0]?.code).toBe("UNKNOWN_FIELD");
    const oversized = testLoopModulePackage();
    oversized.resources[0]!.body = "x".repeat(600_000);
    expect(service.inspect(oversized, "large").issues[0]?.code).toBe("PACKAGE_TOO_LARGE");
    const secret = testLoopModulePackage(); secret.resources[0]!.body = `sk-${"a".repeat(24)}`;
    expect(service.inspect(secret, "secret").issues[0]?.code).toBe("FORBIDDEN_CONTENT");
    const absolute = testLoopModulePackage(); absolute.resources[0]!.body = "Read /Users/example/private.txt.";
    expect(service.inspect(absolute, "absolute").issues[0]?.code).toBe("FORBIDDEN_CONTENT");
    const runtimeState = testLoopModulePackage(); runtimeState.resources[0]!.body = "Read .git/ballet/state.sqlite.";
    expect(service.inspect(runtimeState, "runtime-state").issues[0]?.code).toBe("FORBIDDEN_CONTENT");
    const hookMetadata = testLoopModulePackage(); hookMetadata.resources[0]!.metadata = { postInstall: "run something" };
    expect(service.inspect(hookMetadata, "hook").issues[0]?.code).toBe("FORBIDDEN_CONTENT");
    const duplicate = testLoopModulePackage(); duplicate.resources.push({ ...duplicate.resources[0]! });
    expect(service.inspect(duplicate, "duplicate").issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DUPLICATE_ID" })
    ]));
    const missingStateKey = testLoopModulePackage({
      stateContract: { ...testLoopModulePackage().stateContract, requiredKeys: ["missing"] }
    });
    expect(service.inspect(missingStateKey, "missing-state-key").issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_SCHEMA", path: "stateContract.requiredKeys.0" })
    ]));
  });
});

describe("Loop module install/export service", () => {
  it("deterministically remaps loop, node, edge, instruction, and skill ids", async () => {
    const root = await project({ loops: [existingLoop()] });
    const plan = await service(root).plan({ package: testLoopModulePackage(), source: "test" });
    expect(plan.loop.id).toBe("sample-loop-2");
    expect(plan.loop.workflow.jobNodes[0]?.id).toBe("sample-loop-2-job");
    expect(plan.loop.workflow.validationNodes[0]?.id).toBe("sample-loop-2-job-validation");
    expect(plan.loop.workflow.passEdges[0]?.id).toBe("sample-loop-2-job-pass");
    expect(plan.loop.workflow.failEdges[0]?.id).toBe("sample-loop-2-job-fail");
    expect(plan.loop.capabilities).toEqual({
      accepts: ["sample:task.requested"], provides: ["sample:task.completed"]
    });
    expect(plan.idRemapping.instructions.worker).toBe("project:module-sample-loop-2-worker");
    expect(plan.idRemapping.skills.sample).toBe("project:modules/sample-loop-2/sample");
    expect(plan.conflicts).toContainEqual(expect.objectContaining({ code: "ID_CONFLICT", blocking: false }));
    expect(plan.canInstall).toBe(true);
  });

  it("requires an explicit compatible profile mapping when several candidates exist", async () => {
    const root = await project({ extraProfiles: [profile("codex-second", false)] });
    const first = await service(root).plan({ package: testLoopModulePackage(), source: "test" });
    expect(first.canInstall).toBe(false);
    expect(first.profileMappings[0]?.candidates).toHaveLength(2);
    expect(first.issues[0]?.code).toBe("PROFILE_MAPPING_REQUIRED");
    const mapped = await service(root).plan({ package: testLoopModulePackage(), source: "test", profileMappings: { worker: "codex-second" } });
    expect(mapped.canInstall).toBe(true);
    expect(mapped.loop.workflow.jobNodes[0]).toMatchObject({ executionProfileId: "codex-second" });
  });

  it("fails closed on network mismatch and instruction/skill path conflicts", async () => {
    const root = await project();
    const required = testLoopModulePackage({
      permissions: { network: "required", externalWrites: false },
      profileSlots: [{ ...testLoopModulePackage().profileSlots[0]!, network: "required" }]
    });
    const mismatch = await service(root).plan({ package: required, source: "test" });
    expect(mismatch.profileMappings[0]?.candidates).toEqual([]);
    expect(mismatch.issues[0]?.code).toBe("NETWORK_PERMISSION_MISMATCH");

    await mkdir(path.join(root, ".ballet/instructions/modules/sample-loop"), { recursive: true });
    await writeFile(path.join(root, ".ballet/instructions/modules/sample-loop/worker.md"), "---\nid: module-sample-loop-worker\ntitle: Existing\n---\nExisting.\n", "utf8");
    const conflict = await service(root).plan({ package: testLoopModulePackage(), source: "test" });
    expect(conflict.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RESOURCE_CONFLICT" })]));
    expect(conflict.canInstall).toBe(false);
  });

  it("rejects a semantically incompatible State contract with the same id and version", async () => {
    const root = await project();
    const modules = service(root);
    const first = testLoopModulePackage();
    const firstPlan = await modules.plan({ package: first, source: "test:first" });
    await modules.commit({ package: first, source: "test:first", expectedPlanHash: firstPlan.planHash });
    const second = testLoopModulePackage({
      manifest: { ...first.manifest, id: "sample-loop-two", title: "Sample Loop Two" },
      stateContract: { ...first.stateContract, initial: { complete: false, reviewed: false }, requiredKeys: ["complete", "reviewed"] },
      loop: { ...first.loop, state: { ...first.loop.state, initial: { complete: false, reviewed: false } } }
    });
    const secondPlan = await modules.plan({ package: second, source: "test:second" });
    expect(secondPlan.stateContract.compatibility).toBe("incompatible");
    expect(secondPlan.canInstall).toBe(false);
  });

  it("cleans newly written resources and provenance when the final config write fails", async () => {
    const root = await project();
    const modules = service(root);
    const plan = await modules.plan({ package: testLoopModulePackage(), source: "test" });
    vi.spyOn(ProjectConfigurationRepository.prototype, "putAutomation").mockImplementation(() => { throw new Error("injected config failure"); });
    await expect(modules.commit({ package: testLoopModulePackage(), source: "test", expectedPlanHash: plan.planHash })).rejects.toThrow("injected config failure");
    await expect(stat(path.join(root, ".ballet/instructions/modules/sample-loop/worker.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(root, ".agents/skills/modules/sample-loop/sample/SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(root, ".ballet/loop-modules/installed.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(new ProjectConfigurationRepository().load(root).config?.loops).toEqual([]);
  });

  it("installs, exports the transitive closure, and computes exact/modified/missing provenance", async () => {
    const root = await project();
    const modules = service(root);
    const pkg = testLoopModulePackage();
    const plan = await modules.plan({ package: pkg, source: "test" });
    const installed = await modules.commit({ package: pkg, source: "test", expectedPlanHash: plan.planHash });
    expect(installed.status).toBe("exact");
    expect((await modules.statuses())[0]?.status).toBe("exact");

    const exported = await modules.exportLoop({ loopId: installed.loopId });
    expect(exported.package.profileSlots).toHaveLength(1);
    expect(exported.package.resources.map((resource) => resource.kind).sort()).toEqual(["instruction", "skill"]);
    expect(exported.canonicalJson).not.toContain("executionProfiles");
    expect(exported.package.loop).toEqual(expect.objectContaining({
      key: "loop",
      workflow: expect.objectContaining({ startJobNode: "job" })
    }));

    const instructionPath = path.join(root, ".ballet/instructions/modules/sample-loop/worker.md");
    await writeFile(instructionPath, `${await readFile(instructionPath, "utf8")}\nModified.\n`, "utf8");
    expect((await modules.statuses())[0]?.status).toBe("modified");
    await rm(instructionPath);
    expect((await modules.statuses())[0]).toMatchObject({ status: "missing-resources", missingResources: [".ballet/instructions/modules/sample-loop/worker.md"] });
  });

  it("preserves package semantics through import, install, and export", async () => {
    const root = await project();
    const modules = service(root);
    const pkg = testLoopModulePackage();
    const plan = await modules.plan({ package: pkg, source: "local-file:sample.ballet-loop.json" });
    await modules.commit({ package: pkg, source: "local-file:sample.ballet-loop.json", expectedPlanHash: plan.planHash });
    const exported = await modules.exportLoop({ loopId: plan.loop.id });
    expect(exported.package.loop).toEqual(pkg.loop);
    expect(exported.package.stateContract).toEqual(pkg.stateContract);
    expect(exported.package.capabilities).toEqual(pkg.capabilities);
    expect(exported.package.permissions).toEqual(pkg.permissions);
    expect(exported.package.resources.map(({ kind, body }) => ({ kind, body })))
      .toEqual(pkg.resources.map(({ kind, body }) => ({ kind, body })));
  });

  it("blocks install/export/remove for an active Loop", async () => {
    const root = await project({ loops: [existingLoop()] });
    const modules = service(root, ["sample-loop"]);
    const plan = await modules.plan({ package: testLoopModulePackage(), source: "test" });
    await expect(modules.exportLoop({ loopId: "sample-loop" })).rejects.toMatchObject({ issues: [expect.objectContaining({ code: "ACTIVE_RUN" })] });
    const emptyRoot = await project();
    const activeInstall = service(emptyRoot, ["sample-loop"]);
    const installPlan = await activeInstall.plan({ package: testLoopModulePackage(), source: "test" });
    await expect(activeInstall.commit({ package: testLoopModulePackage(), source: "test", expectedPlanHash: installPlan.planHash }))
      .rejects.toMatchObject({ issues: [expect.objectContaining({ code: "ACTIVE_RUN" })] });
    const inactive = service(emptyRoot);
    await inactive.commit({ package: testLoopModulePackage(), source: "test", expectedPlanHash: installPlan.planHash });
    await expect(activeInstall.remove("sample-loop"))
      .rejects.toMatchObject({ issues: [expect.objectContaining({ code: "ACTIVE_RUN" })] });
    expect(plan.loop.id).toBe("sample-loop-2");
  });

  it("removes provenance without deleting a resource shared by another composition", async () => {
    const root = await project();
    const modules = service(root);
    const pkg = testLoopModulePackage();
    const plan = await modules.plan({ package: pkg, source: "test" });
    await modules.commit({ package: pkg, source: "test", expectedPlanHash: plan.planHash });
    const repository = new ProjectConfigurationRepository();
    const loaded = repository.load(root).config!;
    const shared = existingLoop("consumer-loop");
    shared.workflow.jobNodes[0] = {
      ...shared.workflow.jobNodes[0]!,
      type: "agent",
      executionProfileId: "codex-test",
      primaryInstructionId: plan.idRemapping.instructions.worker!,
      skillIds: [plan.idRemapping.skills.sample!]
    };
    repository.putAutomation(root, {
      version: 12, orchestrator: loaded.orchestrator, graph: loaded.graph, loops: [...loaded.loops, shared]
    });
    await modules.remove(plan.loop.id);
    expect(await readFile(path.join(root, ".ballet/instructions/modules/sample-loop/worker.md"), "utf8")).toContain("Sample worker");
    expect((await modules.statuses())).toEqual([]);
    expect(repository.load(root).config?.loops.map((loop) => loop.id)).toEqual(["consumer-loop"]);
  });

  it("installs two arc42 modules into a Loop-empty project and validates an operator-owned flow edge", async () => {
    const root = await project();
    const modules = service(root);
    const packageRoot = path.resolve(process.cwd(), ".ballet/loop-library/arc42");
    const packageFiles = (await readdir(packageRoot)).filter((filename) => filename.endsWith(".ballet-loop.json")).sort().slice(0, 2);
    const packages = await Promise.all(packageFiles.map(async (filename) =>
      JSON.parse(await readFile(path.join(packageRoot, filename), "utf8")) as ReturnType<typeof testLoopModulePackage>));
    for (const [index, pkg] of packages.entries()) {
      const source = `test-library:${index}`;
      const plan = await modules.plan({ package: pkg, source });
      expect(plan.canInstall).toBe(true);
      await modules.commit({ package: pkg, source, expectedPlanHash: plan.planHash });
    }
    const repository = new ProjectConfigurationRepository();
    const loaded = repository.load(root).config!;
    const [sourceLoopId, targetLoopId] = packages.map((pkg) => pkg.manifest.id);
    const automation = {
      version: 12 as const,
      orchestrator: loaded.orchestrator,
      graph: { loopEdges: [{
        id: "operator-flow-clarify-structures",
        source: sourceLoopId!,
        target: targetLoopId!,
        kind: "flow" as const,
        capability: packages[1]!.capabilities.accepts[0]!,
        description: "Operator-owned flow between independently installed modules."
      }] },
      loops: loaded.loops,
    };
    const resources = await loadProjectResources(root);
    expect(validateProjectAutomationConfig(automation, loaded.executionProfiles)).toEqual([]);
    expect(validateProjectExecutionResources(automation, resources)).toEqual([]);
    expect(automation.graph.loopEdges).toHaveLength(1);
  });

  it("installs, exports, and removes each software-delivery starter without implicit Loop Edges", async () => {
    const packageRoot = path.resolve(process.cwd(), ".ballet/loop-library/software-delivery");
    const packageFiles = (await readdir(packageRoot)).filter((filename) => filename.endsWith(".ballet-loop.json")).sort();
    expect(packageFiles).toEqual([
      "backend-implementation.ballet-loop.json",
      "frontend-implementation.ballet-loop.json"
    ]);

    for (const filename of packageFiles) {
      const root = await project();
      const modules = service(root);
      const pkg = loopModulePackageV2Schema.parse(JSON.parse(await readFile(path.join(packageRoot, filename), "utf8")));
      expect(pkg.loop.workflow.jobNodes).toHaveLength(3);
      expect(pkg.loop.workflow.validationNodes).toHaveLength(3);
      expect(pkg.capabilities.requires).toEqual([]);
      expect(pkg.capabilities.provides).toHaveLength(1);
      const source = `project-library:software-delivery/${filename}`;
      const inspection = modules.inspect(pkg, source);
      expect(inspection).toMatchObject({ valid: true, issues: [] });
      const plan = await modules.plan({ package: pkg, source });
      expect(plan.canInstall).toBe(true);
      const installed = await modules.commit({ package: pkg, source, expectedPlanHash: plan.planHash });
      expect(installed).toMatchObject({ loopId: pkg.manifest.id, status: "exact" });
      const loaded = new ProjectConfigurationRepository().load(root).config!;
      expect(loaded.loops).toHaveLength(1);
      expect(loaded.loops[0]?.workflow.jobNodes).toHaveLength(3);
      expect(loaded.loops[0]?.workflow.validationNodes).toHaveLength(3);
      expect(loaded.graph.loopEdges).toEqual([]);
      const exported = await modules.exportLoop({ loopId: installed.loopId });
      expect(loopModulePackageV2Schema.parse(exported.package).loop.workflow.jobNodes).toHaveLength(3);
      await modules.remove(installed.loopId);
      expect(new ProjectConfigurationRepository().load(root).config?.loops).toEqual([]);
      expect(await modules.statuses()).toEqual([]);
    }
  });
});

const service = (root: string, active: string[] = []) => new LoopModuleService(() => root, runtime(active));
const runtime = (active: string[] = []) => ({
  runtimeDatabase: () => ({ activeLoopIds: () => active })
}) as unknown as RuntimeDatabaseProvider;

const profile = (id = "codex-test", networkAccess = false) => ({
  id, name: id, provider: "codex" as const, model: "test", reasoningEffort: "medium", networkAccess
});

const project = async ({ loops = [], extraProfiles = [] }: { loops?: ProjectLoop[]; extraProfiles?: ReturnType<typeof profile>[] } = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-loop-modules-")); roots.push(root);
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
  await writeFile(path.join(root, ".ballet/instructions/architect.md"), "---\nid: architect\ntitle: Architect\n---\nRoute project repair work.\n", "utf8");
  await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
    version: 12,
    executionProfiles: [profile(), ...extraProfiles],
    orchestrator: { executionProfileId: "codex-test", primaryInstructionId: "project:architect", skillIds: [], maxRepairDepth: 4, maxRepairAttempts: 3 },
    graph: { loopEdges: [] },
    loops
  }, null, 2), "utf8");
  return root;
};

const existingLoop = (id = "sample-loop"): ProjectLoop => ({
  id,
  description: `Existing ${id}.`,
  capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
  state: { description: "Existing state.", initial: {} },
  workflow: {
    startJobNodeId: `${id}-job`,
    jobNodes: [{
      id: `${id}-job`, description: "Existing Job.", validationNodeId: `${id}-job-validation`,
      type: "human", task: "Work.", nodeStyle: "terra", nodeSize: "medium", maxRetries: 3
    }],
    validationNodes: [{
      id: `${id}-job-validation`, description: "Existing Validation.",
      type: "human", task: "Validate.", nodeStyle: "luna", nodeSize: "small"
    }],
    passEdges: [{
      id: `${id}-job-pass`, sourceValidationNodeId: `${id}-job-validation`, target: { workflowResult: "PASS" }
    }],
    failEdges: [{
      id: `${id}-job-fail`, sourceValidationNodeId: `${id}-job-validation`, target: { workflowResult: "FAIL" }
    }]
  }
});
