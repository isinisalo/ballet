import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  getProjectStepTransitionTargets,
  isProjectTerminalNode
} from "../../shared/domain/automation.js";
import { parseMarkdownDocument } from "../markdown.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const readJson = async (relativePath: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8")) as unknown;

const readDirectoryOrEmpty = async (directory: string): Promise<string[]> => {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

describe("repository project configuration", () => {
  it("uses only strict v9 ExecutionProfiles and composed executable Steps", async () => {
    const source = await readJson(".ballet/project.json");
    const project = projectConfigSchema.parse(source);

    expect(project.version).toBe(9);
    expect(source).not.toHaveProperty("agents");
    expect(project.executionProfiles.length).toBeGreaterThan(0);

    const profileIds = project.executionProfiles.map((profile) => profile.id);
    expect(profileIds).toEqual([...profileIds].sort());
    expect(new Set(profileIds).size).toBe(profileIds.length);

    const knownProfiles = new Set(profileIds);
    for (const loop of project.loops) {
      for (const node of loop.nodes) {
        if (node.type !== "agent" && node.type !== "scheduled") continue;
        expect(knownProfiles.has(node.executionProfileId)).toBe(true);
        expect(node.primaryInstructionId).toMatch(/^project:[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(new Set(node.skillIds).size).toBe(node.skillIds.length);
        expect(node.skillIds).toEqual([...node.skillIds].sort());
      }
    }
  });

  it("resolves every primary instruction to one valid project document", async () => {
    const project = projectConfigSchema.parse(await readJson(".ballet/project.json"));
    const instructionDirectory = path.join(repositoryRoot, ".ballet/instructions");
    const instructionFiles = (await readdir(instructionDirectory))
      .filter((file) => file.endsWith(".md"))
      .sort();
    const instructionIds: string[] = [];

    for (const file of instructionFiles) {
      const parsed = parseMarkdownDocument(await readFile(path.join(instructionDirectory, file), "utf8"));
      expect(parsed.errors).toBeUndefined();
      expect(parsed.body.trim().length).toBeGreaterThan(0);
      if (typeof parsed.frontmatter.id === "string") instructionIds.push(`project:${parsed.frontmatter.id}`);
    }

    expect(new Set(instructionIds).size).toBe(instructionIds.length);
    const availableInstructions = new Set(instructionIds);
    const referencedInstructions: string[] = [];
    for (const loop of project.loops) {
      for (const node of loop.nodes) {
        if (node.type === "agent" || node.type === "scheduled") {
          referencedInstructions.push(node.primaryInstructionId);
        }
      }
    }
    expect(referencedInstructions.length).toBeGreaterThan(0);
    for (const instructionId of referencedInstructions) {
      expect(availableInstructions.has(instructionId)).toBe(true);
    }
  });

  it("keeps a coherent Loop graph without legacy standalone runtime files", async () => {
    const project = projectConfigSchema.parse(await readJson(".ballet/project.json"));
    const loopIds = new Set(project.loops.map((loop) => loop.id));

    for (const loop of project.loops) {
      const nodeIds = new Set(loop.nodes.map((node) => node.id));
      expect(nodeIds.has(loop.start)).toBe(true);
      expect(loop.nodes.filter(isProjectTerminalNode).map((node) => node.id).sort())
        .toEqual(["blocked", "completed", "failed"]);

      for (const node of loop.nodes) {
        if (node.type === "completed" || node.type === "blocked" || node.type === "failed") continue;
        for (const target of getProjectStepTransitionTargets(node)) {
          if (typeof target === "string") expect(nodeIds.has(target)).toBe(true);
          else {
            expect(loopIds.has(target.loop)).toBe(true);
            expect(target.loop).not.toBe(loop.id);
          }
        }
      }
    }

    const legacyFiles = await readDirectoryOrEmpty(path.join(repositoryRoot, ".codex/agents"));
    expect(legacyFiles.filter((file) => file.endsWith(".toml"))).toEqual([]);
  });
});
