import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import { agentOutcomeSchema } from "../../../shared/api/runtime-schemas.js";
import type { RuntimeProvider } from "../../../shared/domain/runtime.js";
import type { CliRuntimeAdapter, RuntimeEvent } from "../providers/CliRuntimeAdapter.js";
import { CodexAppServerAdapter } from "../providers/codex/CodexAppServerAdapter.js";
import { CopilotSdkAdapter } from "../providers/copilot/CopilotSdkAdapter.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe.skipIf(process.env.RUN_CODEX_SMOKE !== "1")("Codex CLI live smoke", () => {
  it("probes the installed CLI, discovers models, and returns a structured outcome", async () => {
    await runLiveSmoke(new CodexAppServerAdapter(), "codex");
  }, 180_000);
});

describe.skipIf(process.env.RUN_COPILOT_SMOKE !== "1")("Copilot CLI live smoke", () => {
  it("probes the installed CLI, discovers models, and returns a structured outcome", async () => {
    await runLiveSmoke(new CopilotSdkAdapter(), "copilot");
  }, 180_000);
});

const runLiveSmoke = async (adapter: CliRuntimeAdapter, provider: RuntimeProvider): Promise<void> => {
  const probe = await adapter.probe();
  expect(probe).toMatchObject({ provider, installed: true, compatible: true, authStatus: "ready" });
  const models = await adapter.listModels();
  expect(models.length).toBeGreaterThan(0);
  const root = await mkdtemp(path.join(os.tmpdir(), `ballet-${provider}-smoke-`));
  roots.push(root);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${provider} live smoke timed out.`)), 150_000);
  const events: RuntimeEvent[] = [];
  try {
    for await (const event of adapter.execute({
      executionId: `${provider}-live-smoke`,
      prompt: "Do not modify files. Return a completed outcome with result approved, the summary 'smoke ok', and no checks.",
      workingDirectory: root,
      model: models[0]!.id,
      reasoning: models[0]!.defaultReasoning ?? "provider-default",
      policy: { network: false, readOnlyRoots: [] },
      systemInstructions: "This is an opt-in Ballet runtime smoke test. Do not use tools or modify files.",
      outputSchema: z.toJSONSchema(agentOutcomeSchema) as Record<string, unknown>,
      signal: controller.signal
    })) events.push(event);
  } finally {
    clearTimeout(timeout);
  }
  expect(events).toContainEqual(expect.objectContaining({
    type: "execution.completed",
    structuredOutput: expect.objectContaining({
      state: "completed",
      result: "approved",
      summary: "smoke ok"
    })
  }));
};
