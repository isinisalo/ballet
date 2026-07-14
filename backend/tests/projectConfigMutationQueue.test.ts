import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes, type ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { AutomationService } from "../services/AutomationService.js";
import { MarkdownStore } from "../store.js";

const roots: string[] = [];
const stores: MarkdownStore[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  stores.splice(0).forEach((store) => store.runtimeDatabase().close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("MarkdownStore project config mutation queue", () => {
  it("serializes automation writes without legacy theme assignment transactions", async () => {
    const root = await createProject();
    const store = new MarkdownStore(root, new RuntimeDatabase(path.join(root, "runtime.sqlite")));
    stores.push(store);
    const originalSave = AutomationService.prototype.save;
    let signalSaveStarted!: () => void;
    const saveStarted = new Promise<void>((resolve) => { signalSaveStarted = resolve; });
    let releaseSave!: () => void;
    const saveCanFinish = new Promise<void>((resolve) => { releaseSave = resolve; });
    let pauseNextSave = true;
    const saveSpy = vi.spyOn(AutomationService.prototype, "save").mockImplementation(async function (
      this: AutomationService,
      value
    ) {
      if (pauseNextSave) {
        pauseNextSave = false;
        signalSaveStarted();
        await saveCanFinish;
      }
      return originalSave.call(this, value);
    });

    const first = config();
    first.loops[0]!.nodes[0]!.description = "First queued change.";
    const second = structuredClone(first);
    second.loops[1]!.nodes[0]!.description = "Second queued change.";

    const firstSave = store.saveAutomation(first);
    await saveStarted;
    const secondSave = store.saveAutomation(second);
    await Promise.resolve();
    expect(saveSpy).toHaveBeenCalledTimes(1);

    releaseSave();
    await Promise.all([firstSave, secondSave]);
    expect(saveSpy).toHaveBeenCalledTimes(2);

    const persisted = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as ProjectAutomationConfig;
    expect(persisted.loops[0]!.nodes[0]!.description).toBe("First queued change.");
    expect(persisted.loops[1]!.nodes[0]!.description).toBe("Second queued change.");
  });
});

const createProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-project-mutation-"));
  roots.push(root);
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await writeFile(path.join(root, ".ballet", "project.md"), "---\nid: mutation-queue\nname: Mutation queue\n---\n", "utf8");
  await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ ...config(), agents: {} }, null, 2), "utf8");
  return root;
};

const config = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [automationLoop("first-loop"), automationLoop("second-loop")]
});

const automationLoop = (id: string): ProjectAutomationConfig["loops"][number] => ({
  id,
  start: "gate",
  summaryStyle: "route",
  nodes: [{
    id: "gate",
    type: "human",
    description: "Approve.",
    nodeStyle: "luna",
    nodeSize: "tiny",
    on: { approved: "completed", rejected: "failed" }
  }, ...defaultTerminalNodes()]
});
