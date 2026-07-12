import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { defaultLoopTheme, type LoopTheme } from "../../shared/domain/loopThemes.js";
import { AutomationService } from "../services/AutomationService.js";
import { LoopThemeService } from "../services/LoopThemeService.js";
import { MarkdownStore } from "../store.js";
import { RuntimeDatabase } from "../runtime-db.js";

const roots: string[] = [];
const stores: MarkdownStore[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  stores.splice(0).forEach((store) => store.runtimeDatabase().close());
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("MarkdownStore project config mutation queue", () => {
  it("finishes an earlier automation save before creating and assigning a theme", async () => {
    const root = await createProject();
    const store = new MarkdownStore(root, new RuntimeDatabase(path.join(root, "runtime.sqlite")));
    stores.push(store);
    const originalSave = AutomationService.prototype.save;
    let signalSaveStarted!: () => void;
    const saveStarted = new Promise<void>((resolve) => { signalSaveStarted = resolve; });
    let releaseSave!: () => void;
    const saveCanFinish = new Promise<void>((resolve) => { releaseSave = resolve; });
    let pauseNextSave = true;
    vi.spyOn(AutomationService.prototype, "save").mockImplementation(async function (
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
    const createSpy = vi.spyOn(LoopThemeService.prototype, "create");
    const changed = config();
    changed.loops[0]!.steps[0]!.description = "Keep this queued automation change.";

    const save = store.saveAutomation(changed);
    await saveStarted;
    const create = store.createLoopTheme({
      theme: theme("second-theme"),
      assignToLoopId: "second-loop"
    });
    await Promise.resolve();
    expect(createSpy).not.toHaveBeenCalled();

    releaseSave();
    await Promise.all([save, create]);

    const persisted = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as ProjectAutomationConfig;
    expect(persisted.loops).toEqual([
      expect.objectContaining({
        id: "first-loop",
        steps: [expect.objectContaining({ description: "Keep this queued automation change." })]
      }),
      expect.objectContaining({ id: "second-loop", theme: "second-theme" })
    ]);
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
  version: 6,
  loops: [automationLoop("first-loop"), automationLoop("second-loop")]
});

const automationLoop = (id: string): ProjectAutomationConfig["loops"][number] => ({
  id,
  theme: "default",
  start: "gate",
  steps: [{
    id: "gate",
    type: "human",
    description: "Approve.",
    nodeSize: "small",
    on: { approved: { end: "completed" }, rejected: { end: "failed" } }
  }]
});

const theme = (id: string): LoopTheme => ({
  ...structuredClone(defaultLoopTheme),
  id,
  label: id
});
