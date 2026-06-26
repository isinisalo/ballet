import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../shared/domain.js";
import { runCodexAgent } from "../codex-adapter.js";

const tempRoots: string[] = [];

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-codex-smoke-"));
  tempRoots.push(root);
  await writeFile(path.join(root, "README.md"), "# Ballet Codex smoke\n\nTemporary smoke-test workspace.\n", "utf8");
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer Agent",
  description: "Smoke-test agent.",
  instructions: [
    "Olet Ballet smoke-test agentti.",
    "Älä muokkaa tiedostoja, älä aja komentoja, älä käytä subagentteja.",
    "Palauta vain outputSchemaan sopiva JSON."
  ].join("\n"),
  skills: [],
  enabled: true,
  status: "offline",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

describe.skipIf(process.env.RUN_CODEX_SMOKE !== "1")("Codex app-server smoke", () => {
  it("runs one real Codex app-server turn with structured output", async () => {
    const root = await tempRoot();
    const result = await runCodexAgent({
      runId: "smoke-run",
      workItemId: "smoke-work",
      agentRole: "developer-agent",
      operationId: "developer-agent/implement-change",
      operationVersion: 1,
      agent,
      projectRoot: root,
      timeoutMs: 120000,
      outputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["status", "summary"],
        properties: {
          status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
          summary: { type: "string" },
          evidence: { type: "object", additionalProperties: true }
        }
      },
      prompt: [
        "Tämä on Ballet runtime smoke test.",
        "Älä tee tiedostomuutoksia.",
        "Palauta status=blocked ja summary, jossa kerrot että smoke toimii ilman domain-event julkaisua."
      ].join("\n")
    });

    expect(["completed", "blocked", "needs_input", "failed"]).toContain((result.output as { status?: string }).status);
    expect(result.threadId).toBeTruthy();
    expect((result.output as { summary?: string }).summary).toBeTruthy();
  });
});
