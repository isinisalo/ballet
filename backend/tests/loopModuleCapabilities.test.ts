import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import { LoopModuleService } from "../loop-modules/LoopModuleService.js";
import type { RuntimeDatabaseProvider } from "../services/RuntimeDatabaseProvider.js";
import { testLoopModulePackage } from "./loopModuleTestFixture.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("Loop module capability and peer-target conformance", () => {
  it("rejects project-global graph and target selection content", () => {
    const modules = service("/unused");
    const targetSelection = testLoopModulePackage();
    targetSelection.resources[0]!.body = "Route using targetLoopId.";
    expect(modules.inspect(targetSelection, "target-selection").issues[0]?.code).toBe("FORBIDDEN_CONTENT");
    expect(modules.inspect({ ...testLoopModulePackage(), loopEdges: [] }, "global-graph").issues[0]?.code)
      .toBe("FORBIDDEN_CONTENT");
  });

  it("rejects peer Loop ids in reusable task and resource content", async () => {
    const root = await project([loop("peer-loop")]);
    const pkg = testLoopModulePackage();
    pkg.loop.nodes[0]!.work.task = "Ask peer-loop to select the next route.";
    const plan = await service(root).plan({ package: pkg, source: "test:peer-route" });
    expect(plan).toMatchObject({
      canInstall: false,
      issues: [expect.objectContaining({ code: "FORBIDDEN_CONTENT", message: expect.stringContaining("peer-loop") })]
    });
  });

  it("reports package requirements without adding a project Graph dependency", async () => {
    const root = await project();
    const modules = service(root);
    const dependent = testLoopModulePackage({
      manifest: { ...testLoopModulePackage().manifest, id: "dependent-loop", title: "Dependent Loop" },
      capabilities: {
        requires: ["sample:task.completed"], accepts: ["dependent:task.requested"],
        provides: ["dependent:task.completed"], recommendedConnections: []
      }
    });
    const before = await modules.plan({ package: dependent, source: "test:dependent" });
    expect(before.capabilities.missingRequires).toEqual(["sample:task.completed"]);
    expect(before.canInstall).toBe(true);
    const provider = testLoopModulePackage();
    const providerPlan = await modules.plan({ package: provider, source: "test:provider" });
    await modules.commit({ package: provider, source: "test:provider", expectedPlanHash: providerPlan.planHash });
    const after = await modules.plan({ package: dependent, source: "test:dependent" });
    expect(after.capabilities).toMatchObject({ available: ["sample:task.completed"], missingRequires: [] });
  });
});

const service = (root: string) => new LoopModuleService(() => root, {
  runtimeDatabase: () => ({ activeLoopIds: () => [] })
} as unknown as RuntimeDatabaseProvider);

const project = async (loops: ProjectLoop[] = []): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-loop-capabilities-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
  await writeFile(path.join(root, ".ballet/instructions/architect.md"), "---\nid: architect\ntitle: Architect\n---\nRoute project repair work.\n");
  await writeFile(path.join(root, ".ballet/project.json"), JSON.stringify({
    version: 11,
    executionProfiles: [{
      id: "codex-test", name: "Codex", provider: "codex", model: "test", reasoningEffort: "medium", networkAccess: false
    }],
    orchestrator: {
      executionProfileId: "codex-test", primaryInstructionId: "project:architect", skillIds: [], maxRepairDepth: 4, maxRepairAttempts: 3
    },
    graph: { loopEdges: [] },
    loops
  }, null, 2));
  return root;
};

const loop = (id: string): ProjectLoop => ({
  id, description: `Existing ${id}.`,
  capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
  state: { description: "Existing state.", initial: {} },
  startNodeId: `${id}-work`,
  nodes: [{
    id: `${id}-work`, description: "Existing Work and Validation.",
    work: { type: "human", task: "Work.", nodeStyle: "terra", nodeSize: "medium" },
    validation: { type: "human", task: "Validate.", nodeStyle: "luna", nodeSize: "small" },
    maxLocalAttempts: 3
  }],
  edges: [{ id: `${id}-completed`, source: `${id}-work`, target: { terminal: "completed" } }]
});
