import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectExecutionComposition } from "../../shared/domain/automation.js";
import { validateProjectExecutionResources } from "../automation.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { loadBalletProjectTree } from "../markdown.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const projectRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-project-resources-"));
  roots.push(root);
  return root;
};

const writeInstruction = async (root: string, file: string, frontmatter: string, body = "Instruction body.") => {
  const directory = path.join(root, ".ballet/instructions");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), `---\n${frontmatter}\n---\n${body}`, "utf8");
};

const writeSkill = async (root: string, id: string, body = "Skill body.") => {
  const directory = path.join(root, ".agents/skills", ...id.split("/"));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "SKILL.md"), `---\nname: ${id}\ndescription: Test skill\n---\n${body}`, "utf8");
};

const automationConfig = (composition: ProjectExecutionComposition): ProjectAutomationConfig => ({
  version: 11,
  orchestrator: { ...composition, maxRepairDepth: 4, maxRepairAttempts: 3 },
  graph: { loopEdges: [] },
  loops: [{
    id: "delivery",
    description: "Complete and validate the work.",
    capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
    state: { description: "Shared delivery state.", initial: {} },
    startNodeId: "work",
    nodes: [{
      id: "work",
      description: "Complete the work.",
      work: {
        type: "agent",
        task: "Complete the work.",
        ...composition,
        nodeStyle: "terra",
        nodeSize: "medium"
      },
      validation: {
        type: "agent",
        task: "Validate the work.",
        ...composition,
        nodeStyle: "luna",
        nodeSize: "small"
      },
      maxLocalAttempts: 3
    }],
    edges: [{ id: "work-completed", source: "work", target: { terminal: "completed" } }]
  }]
});

describe("project resource catalog", () => {
  it("hashes the exact raw source bytes", async () => {
    const root = await projectRoot();
    const source = "---\nid: exact\ntitle: Exact\n---\nπ\n";
    const directory = path.join(root, ".ballet/instructions");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "exact.md"), source, "utf8");

    const resource = (await loadProjectResources(root)).instructions[0]!;

    expect(resource.sourceSha256).toBe("386d703f67fa8bfb51b15f74b5529bcbeae8415f06a59539195e016ee01a95bd");
    expect(resource.sizeBytes).toBe(Buffer.byteLength(resource.body, "utf8"));
  });

  it("loads scoped instruction and nested skill ids in canonical order with immutable hashes", async () => {
    const root = await projectRoot();
    await writeInstruction(root, "zeta.md", "id: zeta\ntitle: Zeta");
    await writeInstruction(root, "alpha.md", "id: alpha\ntitle: Alpha");
    await writeSkill(root, "zeta");
    await writeSkill(root, "alpha/nested");

    const catalog = await loadProjectResources(root);
    expect(catalog.issues).toEqual([]);
    expect(catalog.instructions.map((instruction) => instruction.id)).toEqual([
      "project:alpha",
      "project:zeta"
    ]);
    expect(catalog.skills.map((skill) => skill.id)).toEqual([
      "project:alpha/nested",
      "project:zeta"
    ]);
    for (const resource of [...catalog.instructions, ...catalog.skills]) {
      expect(resource.valid).toBe(true);
      expect(resource.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(resource.contentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(resource.sizeBytes).toBeGreaterThan(0);
      expect(resource.origin).toBe("project");
    }
  });

  it("marks missing, duplicate, and invalid instruction ids unavailable", async () => {
    const root = await projectRoot();
    await writeInstruction(root, "missing.md", "title: Missing ID");
    await writeInstruction(root, "invalid.md", "id: Not-Canonical\ntitle: Invalid");
    await writeInstruction(root, "first.md", "id: duplicate\ntitle: First");
    await writeInstruction(root, "second.md", "id: duplicate\ntitle: Second");

    const catalog = await loadProjectResources(root);
    const missing = catalog.instructions.find((instruction) => instruction.relativePath.endsWith("missing.md"));
    expect(missing).toMatchObject({ valid: false });
    expect(missing).not.toHaveProperty("id");
    const invalid = catalog.instructions.find((instruction) => instruction.relativePath.endsWith("invalid.md"));
    expect(invalid).toMatchObject({ valid: false });
    expect(invalid).not.toHaveProperty("id");
    expect(catalog.instructions.filter((instruction) => instruction.id === "project:duplicate"))
      .toEqual([
        expect.objectContaining({ valid: false }),
        expect.objectContaining({ valid: false })
      ]);
    expect(catalog.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "instruction", code: "invalid_id" }),
      expect.objectContaining({ kind: "instruction", code: "duplicate_id", resourceId: "project:duplicate" })
    ]));
  });

  it("marks invalid skill paths and empty skill content unavailable", async () => {
    const root = await projectRoot();
    await writeSkill(root, "Not-Canonical");
    await writeSkill(root, "empty", "");

    const catalog = await loadProjectResources(root);
    expect(catalog.skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "project:Not-Canonical", valid: false }),
      expect.objectContaining({ id: "project:empty", valid: false })
    ]));
    expect(catalog.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "skill", code: "invalid_path" }),
      expect.objectContaining({ kind: "skill", code: "empty_content" })
    ]));
  });
});

describe("project resource catalog safety regressions", () => {
  it("treats invalid UTF-8 as a fatal resource issue", async () => {
    const root = await projectRoot();
    const directory = path.join(root, ".ballet/instructions");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "broken.md"), Uint8Array.of(0xff));

    const catalog = await loadProjectResources(root);

    expect(catalog.instructions).toEqual([expect.objectContaining({ valid: false })]);
    expect(catalog.issues).toContainEqual(expect.objectContaining({
      kind: "instruction",
      code: "invalid_utf8",
      relativePath: ".ballet/instructions/broken.md"
    }));
    expect(validateProjectExecutionResources(automationConfig({
      executionProfileId: "profile",
      primaryInstructionId: "project:broken",
      skillIds: []
    }), catalog))
      .toContainEqual(expect.objectContaining({ path: ".ballet/instructions/broken.md" }));
  });

  it("rejects a symbolic link encountered directly by the resource catalog", async () => {
    const root = await projectRoot();
    const directory = path.join(root, ".ballet/instructions");
    const target = path.join(root, "target.md");
    await mkdir(directory, { recursive: true });
    await writeFile(target, "---\nid: target\ntitle: Target\n---\nBody", "utf8");
    await symlink(target, path.join(directory, "linked.md"));

    await expect(loadProjectResources(root)).rejects.toThrow(
      "Symbolic links are not allowed in project resource paths: .ballet/instructions/linked.md"
    );
  });

  it("keeps a missing-ID instruction as an ordinary document without blocking selected valid resources", async () => {
    const root = await projectRoot();
    await writeInstruction(root, "missing.md", "title: Ordinary Document");
    await writeInstruction(root, "primary.md", "id: primary\ntitle: Primary");
    await writeSkill(root, "review");
    const catalog = await loadProjectResources(root);
    const config = automationConfig({
      executionProfileId: "primary",
      primaryInstructionId: "project:primary",
      skillIds: ["project:review"]
    });
    const missing = catalog.instructions.find((instruction) => instruction.relativePath.endsWith("missing.md"));
    const tree = await loadBalletProjectTree(root);
    const instructions = tree.find((node) => node.type === "directory" && node.label === "instructions");

    expect(missing).toMatchObject({ title: "Ordinary Document", valid: false });
    expect(missing).not.toHaveProperty("id");
    expect(instructions?.type === "directory" ? instructions.children : []).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "file", document: expect.objectContaining({ relativePath: ".ballet/instructions/missing.md" }) })
    ]));
    expect(catalog.issues).toEqual([]);
    expect(validateProjectExecutionResources(config, catalog)).toEqual([]);
  });
});

describe("project resource selection validation", () => {
  it("reports every missing or invalid selected primary instruction and skill at its composition path", async () => {
    const root = await projectRoot();
    await writeInstruction(root, "first.md", "id: primary\ntitle: First");
    await writeInstruction(root, "second.md", "id: primary\ntitle: Second");
    await writeSkill(root, "invalid", "");
    const catalog = await loadProjectResources(root);
    const config = automationConfig({
      executionProfileId: "primary",
      primaryInstructionId: "project:primary",
      skillIds: ["project:invalid", "project:missing"]
    });

    expect(validateProjectExecutionResources(config, catalog)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "loops.0.nodes.0.work.primaryInstructionId" }),
      expect.objectContaining({ path: "loops.0.nodes.0.work.skillIds.0" }),
      expect.objectContaining({ path: "loops.0.nodes.0.work.skillIds.1" }),
      expect.objectContaining({ path: "loops.0.nodes.0.validation.primaryInstructionId" }),
      expect.objectContaining({ path: expect.stringContaining(".ballet/instructions/") }),
      expect.objectContaining({ path: ".agents/skills/invalid/SKILL.md" })
    ]));
  });
});
