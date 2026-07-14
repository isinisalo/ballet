import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import { defaultLoopTheme, type LoopTheme } from "../../shared/domain/loopThemes.js";
import { LoopThemeConflictError, LoopThemeValidationError } from "../loop-themes/LoopThemeErrors.js";
import { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { LoopThemeService } from "../services/LoopThemeService.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-theme-v2-"));
  roots.push(root);
  return root;
};

const changedTheme = (color = "#112233"): LoopTheme => ({
  ...structuredClone(defaultLoopTheme),
  node: { ...defaultLoopTheme.node, glowColor: color }
});

describe("singular Loop theme repository", () => {
  it("uses the global default when theme.json is absent", async () => {
    const root = await tempRoot();
    const loaded = await new LoopThemeRepository().load(root);
    expect(loaded).toEqual({ theme: defaultLoopTheme, issues: [] });
    expect(loaded.theme).not.toBe(defaultLoopTheme);
  });

  it("atomically updates and reloads .ballet/theme.json", async () => {
    const root = await tempRoot();
    const repository = new LoopThemeRepository();
    const theme = changedTheme();

    await expect(repository.update(root, theme)).resolves.toEqual(theme);
    await expect(repository.load(root)).resolves.toEqual({ theme, issues: [] });
    expect(JSON.parse(await readFile(path.join(root, ".ballet", "theme.json"), "utf8"))).toEqual(theme);
    expect((await readFile(path.join(root, ".ballet", "theme.json"), "utf8")).endsWith("\n")).toBe(true);
  });

  it("falls back to the default and reports invalid JSON or schema", async () => {
    const root = await tempRoot();
    const directory = path.join(root, ".ballet");
    await mkdir(directory);
    await writeFile(path.join(directory, "theme.json"), "{", "utf8");
    let loaded = await new LoopThemeRepository().load(root);
    expect(loaded.theme).toEqual(defaultLoopTheme);
    expect(loaded.issues[0]).toMatchObject({ path: ".ballet/theme.json" });

    await writeFile(path.join(directory, "theme.json"), JSON.stringify({ ...defaultLoopTheme, version: 1 }), "utf8");
    loaded = await new LoopThemeRepository().load(root);
    expect(loaded.theme).toEqual(defaultLoopTheme);
    expect(loaded.issues).toContainEqual(expect.objectContaining({ path: ".ballet/theme.json.version" }));
  });

  it("never follows a theme.json symlink", async () => {
    const root = await tempRoot();
    const outside = path.join(root, "outside.json");
    await writeFile(outside, JSON.stringify(defaultLoopTheme), "utf8");
    await mkdir(path.join(root, ".ballet"));
    await symlink(outside, path.join(root, ".ballet", "theme.json"));

    const repository = new LoopThemeRepository();
    expect((await repository.load(root)).issues).toContainEqual(expect.objectContaining({
      path: ".ballet/theme.json",
      message: expect.stringContaining("ordinary JSON file")
    }));
    await expect(repository.update(root, changedTheme())).rejects.toBeInstanceOf(LoopThemeConflictError);
  });

  it("leaves a complete valid document after concurrent updates", async () => {
    const root = await tempRoot();
    const repository = new LoopThemeRepository();
    const first = changedTheme("#112233");
    const second = changedTheme("#445566");
    await Promise.all([repository.update(root, first), repository.update(root, second)]);
    const loaded = await repository.load(root);
    expect(loaded.issues).toEqual([]);
    expect([first, second]).toContainEqual(loaded.theme);
  });
});

describe("Loop theme v2 validation and service", () => {
  it("accepts only the id-less renderer-less v2 contract", () => {
    expect(loopThemeSchema.parse(defaultLoopTheme)).toEqual(defaultLoopTheme);
    expect(loopThemeSchema.safeParse({ ...defaultLoopTheme, id: "legacy" }).success).toBe(false);
    expect(loopThemeSchema.safeParse({
      ...defaultLoopTheme,
      node: { ...defaultLoopTheme.node, styles: { small: "luna", medium: "terra", large: "sol" } }
    }).success).toBe(false);
  });

  it("validates before saving through the singular service", async () => {
    const root = await tempRoot();
    const service = new LoopThemeService(() => root, new LoopThemeRepository());
    await expect(service.update(changedTheme())).resolves.toEqual(changedTheme());
    await expect(service.update({ ...defaultLoopTheme, version: 1 })).rejects.toBeInstanceOf(LoopThemeValidationError);
  });
});
