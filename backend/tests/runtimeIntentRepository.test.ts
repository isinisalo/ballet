import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RuntimeIntentRepository, RuntimeIntentSourceError } from "../runtime-config/RuntimeIntentRepository.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const root = async (): Promise<string> => {
  const value = await mkdtemp(path.join(tmpdir(), "ballet-runtime-intent-"));
  roots.push(value);
  return value;
};

describe("portable runtime intent repository", () => {
  it("does not create repository state while reading a fresh checkout", async () => {
    const projectRoot = await root();
    const repository = new RuntimeIntentRepository();

    expect(repository.load(projectRoot)).toMatchObject({ exists: false, config: { version: 1, agents: {} }, issues: [] });
    await expect(readFile(repository.path(projectRoot), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("writes deterministic v1 JSON atomically with sorted agent ids", async () => {
    const projectRoot = await root();
    const repository = new RuntimeIntentRepository();
    repository.put(projectRoot, "reviewer", {
      provider: "copilot", model: "claude-sonnet", reasoning: "high", policy: { network: true }
    });
    repository.put(projectRoot, "developer", {
      provider: "codex", model: "gpt-5", reasoning: "medium", policy: { network: false }
    });

    const source = await readFile(repository.path(projectRoot), "utf8");
    expect(source).toBe(`${JSON.stringify({
      version: 1,
      agents: {
        developer: { provider: "codex", model: "gpt-5", reasoning: "medium", policy: { network: false } },
        reviewer: { provider: "copilot", model: "claude-sonnet", reasoning: "high", policy: { network: true } }
      }
    }, null, 2)}\n`);
    expect(await readdir(path.join(projectRoot, ".ballet"))).toEqual(["runtime.json"]);

    repository.put(projectRoot, "developer", {
      provider: "codex", model: "gpt-5", reasoning: "medium", policy: { network: false }
    });
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(source);
  });

  it("preserves invalid source and reports parse and schema issues", async () => {
    const projectRoot = await root();
    const repository = new RuntimeIntentRepository();
    await mkdir(path.dirname(repository.path(projectRoot)), { recursive: true });
    const invalidJson = "{ definitely not json\n";
    await writeFile(repository.path(projectRoot), invalidJson, "utf8");

    const loaded = repository.load(projectRoot);
    expect(loaded).toMatchObject({
      exists: true,
      source: invalidJson,
      issues: [expect.objectContaining({ code: "invalid_json", path: ".ballet/runtime.json" })]
    });
    expect(() => repository.put(projectRoot, "developer", {
      provider: "codex", model: "gpt-5", reasoning: "high", policy: { network: false }
    })).toThrow(RuntimeIntentSourceError);
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(invalidJson);

    const invalidSchema = `${JSON.stringify({ version: 2, agents: {} }, null, 2)}\n`;
    await writeFile(repository.path(projectRoot), invalidSchema, "utf8");
    expect(repository.load(projectRoot).issues).toContainEqual(expect.objectContaining({ code: "invalid_schema", path: "version" }));
    expect(await readFile(repository.path(projectRoot), "utf8")).toBe(invalidSchema);
  });
});
