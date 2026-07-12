import { access, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig
} from "../automation.js";
import {
  builtInLoopThemes,
  defaultLoopTheme,
  type LoopTheme
} from "../../shared/domain/loopThemes.js";
import { LoopThemeConflictError, LoopThemeValidationError } from "../loop-themes/LoopThemeErrors.js";
import { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { LoopThemeService } from "../services/LoopThemeService.js";

const roots: string[] = [];
const tempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-loop-themes-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const theme = (id: string, label = id): LoopTheme => ({
  ...structuredClone(defaultLoopTheme),
  id,
  label
});

describe("loopThemeSchema", () => {
  it("trims labels and rejects unknown fields, non-kebab ids, colors, and style values", () => {
    expect(loopThemeSchema.parse(theme("project-theme", " Project theme ")).label).toBe("Project theme");
    expect(loopThemeSchema.safeParse({ ...theme("project-theme"), extra: true }).success).toBe(false);
    expect(loopThemeSchema.safeParse(theme("ProjectTheme")).success).toBe(false);
    expect(loopThemeSchema.safeParse({
      ...theme("project-theme"),
      node: { ...theme("project-theme").node, glowColor: "#abcdef80" }
    }).success).toBe(false);
    expect(loopThemeSchema.safeParse({
      ...theme("project-theme"),
      edge: { ...theme("project-theme").edge, style: "double" }
    }).success).toBe(false);
  });
});

describe("LoopThemeRepository", () => {
  it("loads built-ins and deterministically merges valid project themes and overrides", async () => {
    const root = await tempRoot();
    const directory = path.join(root, ".ballet", "themes");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "default.json"), JSON.stringify(theme("default", "Project default")), "utf8");
    await writeFile(path.join(directory, "zebra.json"), JSON.stringify(theme("zebra", "Zebra")), "utf8");
    await writeFile(path.join(directory, "alpha.json"), JSON.stringify(theme("alpha", "Alpha")), "utf8");

    const loaded = await new LoopThemeRepository().load(root);

    expect(loaded.issues).toEqual([]);
    expect(loaded.themes.map(({ id }) => id)).toEqual(["default", "open-ai", "alpha", "zebra"]);
    expect(loaded.themes.find(({ id }) => id === "default")?.label).toBe("Project default");
  });

  it("keeps a built-in fallback and reports invalid, mismatched, and symlinked files", async () => {
    const root = await tempRoot();
    const directory = path.join(root, ".ballet", "themes");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "default.json"), JSON.stringify({
      ...theme("default"),
      node: { ...theme("default").node, glowColor: "#ABCDEF" }
    }), "utf8");
    await writeFile(path.join(directory, "wrong.json"), JSON.stringify(theme("another")), "utf8");
    await writeFile(path.join(root, "outside.json"), JSON.stringify(theme("linked")), "utf8");
    await symlink(path.join(root, "outside.json"), path.join(directory, "linked.json"));

    const loaded = await new LoopThemeRepository().load(root);

    expect(loaded.themes.find(({ id }) => id === "default")).toEqual(defaultLoopTheme);
    expect(loaded.themes).toHaveLength(builtInLoopThemes.length);
    expect(loaded.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ".ballet/themes/default.json.node.glowColor", themeId: "default" }),
      expect.objectContaining({ path: ".ballet/themes/wrong.json.id", themeId: "wrong" }),
      expect.objectContaining({ path: ".ballet/themes/linked.json", themeId: "linked" })
    ]));
  });

  it("writes atomically and rejects ids that could escape the theme directory", async () => {
    const root = await tempRoot();
    const repository = new LoopThemeRepository();

    await expect(repository.create(root, theme("../escape"))).rejects.toBeInstanceOf(LoopThemeValidationError);
    const saved = await repository.create(root, theme("project-theme", " Project theme "));

    expect(saved.label).toBe("Project theme");
    expect(JSON.parse(await readFile(path.join(root, ".ballet/themes/project-theme.json"), "utf8"))).toEqual(saved);
    expect(await readdir(path.join(root, ".ballet/themes"))).toEqual(["project-theme.json"]);
    await expect(access(path.join(root, "escape.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("publishes concurrent creates without clobbering an existing theme", async () => {
    const root = await tempRoot();
    const first = theme("shared-theme", "First writer");
    const second = theme("shared-theme", "Second writer");

    const results = await Promise.allSettled([
      new LoopThemeRepository().create(root, first),
      new LoopThemeRepository().create(root, second)
    ]);

    const saved = results.find((result) => result.status === "fulfilled");
    const rejected = results.find((result) => result.status === "rejected");
    expect(saved).toBeDefined();
    expect(rejected).toMatchObject({ reason: expect.any(LoopThemeConflictError) });
    if (!saved || saved.status !== "fulfilled") throw new Error("One create must succeed.");
    expect(JSON.parse(await readFile(path.join(root, ".ballet/themes/shared-theme.json"), "utf8")))
      .toEqual(saved.value);
    expect(await readdir(path.join(root, ".ballet/themes"))).toEqual(["shared-theme.json"]);
  });

  it("does not follow a symlinked themes directory", async () => {
    const root = await tempRoot();
    const outside = await tempRoot();
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await symlink(outside, path.join(root, ".ballet", "themes"));

    const repository = new LoopThemeRepository();
    const loaded = await repository.load(root);

    expect(loaded.themes).toHaveLength(builtInLoopThemes.length);
    expect(loaded.issues).toEqual([{
      path: ".ballet/themes",
      message: "Theme directory must be an ordinary directory."
    }]);
    await expect(repository.update(root, theme("default"))).rejects.toThrow("ordinary directory");
  });
});

describe("LoopThemeService", () => {
  it("removes a newly created theme when assigning it to the loop fails", async () => {
    const root = await tempRoot();
    const config: ProjectAutomationConfig = {
      version: 6,
      loops: [{
        id: "approval",
        theme: "default",
        start: "gate",
        steps: [{
          id: "gate",
          type: "human",
          description: "Approve.",
          nodeSize: "small",
          on: { approved: { end: "completed" }, rejected: { end: "failed" } }
        }]
      }]
    };
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ ...config, agents: {} }), "utf8");
    const repository = new LoopThemeRepository();
    const service = new LoopThemeService(
      () => root,
      repository,
      async () => { throw new Error("project save failed"); }
    );

    await expect(service.create({
      theme: theme("new-theme", "New theme"),
      assignToLoopId: "approval"
    })).rejects.toThrow("project save failed");
    expect(await repository.hasFile(root, "new-theme")).toBe(false);
  });

  it("serializes concurrent create-and-assign transactions without losing loop assignments", async () => {
    const root = await tempRoot();
    const config: ProjectAutomationConfig = {
      version: 6,
      loops: [automationLoop("first-loop"), automationLoop("second-loop")]
    };
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ ...config, agents: {} }), "utf8");
    let activeSaves = 0;
    let maximumActiveSaves = 0;
    const service = new LoopThemeService(
      () => root,
      new LoopThemeRepository(),
      async (value) => {
        activeSaves += 1;
        maximumActiveSaves = Math.max(maximumActiveSaves, activeSaves);
        if (value.loops.find((loop) => loop.id === "first-loop")?.theme === "first-theme") {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        try {
          return await saveProjectAutomationConfig(root, value);
        } finally {
          activeSaves -= 1;
        }
      }
    );

    await Promise.all([
      service.create({ theme: theme("first-theme"), assignToLoopId: "first-loop" }),
      service.create({ theme: theme("second-theme"), assignToLoopId: "second-loop" })
    ]);

    expect(maximumActiveSaves).toBe(1);
    expect((await loadProjectAutomationConfig(root)).loops).toEqual([
      expect.objectContaining({ id: "first-loop", theme: "first-theme" }),
      expect.objectContaining({ id: "second-loop", theme: "second-theme" })
    ]);
  });
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
