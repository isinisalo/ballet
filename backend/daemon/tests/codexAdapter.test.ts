import { access, chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodexAppServerAdapter } from "../providers/codex/CodexAppServerAdapter.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixtureSource = `#!/usr/bin/env node
if (process.argv.includes("--version")) { console.log("codex-cli 0.144.1"); process.exit(0); }
if (process.argv[2] === "login" && process.argv[3] === "status") { console.log("Logged in"); process.exit(0); }
const readline = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");
const rl = readline.createInterface({ input: process.stdin });
let turnParams;
const send = (message) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\\n");
const finish = () => {
  const text = JSON.stringify({ outcome: "ready", summary: "Codex done.", checks: [] });
  send({ method: "item/completed", params: { item: { id: "message-1", type: "agentMessage", phase: "final_answer", text } } });
  send({ method: "turn/completed", params: { turn: { id: "turn-1", status: "completed" } } });
};
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === "approval-1" && !message.method) {
    if (message.result?.decision !== "decline") process.exit(9);
    finish();
    return;
  }
  if (message.method === "initialize") return send({ id: message.id, result: {} });
  if (message.method === "model/list") return send({ id: message.id, result: { data: [{ id: "gpt-5.4", displayName: "GPT-5.4", isDefault: true, supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Balanced" }, { reasoningEffort: "high", description: "Deep" }], defaultReasoningEffort: "medium" }] } });
  if (message.method === "thread/start") {
    if (message.params.sandbox !== "workspace-write" || message.params.approvalPolicy !== "never") process.exit(7);
    return send({ id: message.id, result: { thread: { id: "thread-1" } } });
  }
  if (message.method === "thread/resume") return send({ id: message.id, result: { thread: { id: message.params.threadId } } });
  if (message.method === "turn/start") {
    turnParams = message.params;
    if (turnParams.sandboxPolicy?.type !== "workspaceWrite" || turnParams.sandboxPolicy?.networkAccess !== false) process.exit(8);
    if (turnParams.input?.[0]?.type !== "text" || !Array.isArray(turnParams.input[0].text_elements)) process.exit(10);
    send({ id: message.id, result: { turn: { id: "turn-1" } } });
    fs.writeFileSync(path.join(process.cwd(), "turn-started"), "");
    if (fs.existsSync(path.join(process.cwd(), "crash-after-turn-start"))) return setImmediate(() => process.exit(12));
    if (fs.existsSync(path.join(process.cwd(), "hang-after-turn-start"))) return;
    send({ id: "approval-1", method: "item/commandExecution/requestApproval", params: { cwd: turnParams.cwd, command: "npm test" } });
  }
});
`;

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-codex-runtime-"));
  roots.push(root);
  const command = path.join(root, "codex-fixture.cjs");
  await writeFile(command, fixtureSource, { mode: 0o755 });
  await chmod(command, 0o755);
  return { root, command };
};

describe("CodexAppServerAdapter", () => {
  it("uses app-server workspace-write policy and declines approval requests by default", async () => {
    const context = await fixture();
    const adapter = new CodexAppServerAdapter({ command: context.command });
    const events = [];
    for await (const event of adapter.execute({
      executionId: "task-1",
      prompt: "Do work.",
      workingDirectory: context.root,
      model: "provider-default",
      reasoning: "provider-default",
      policy: { network: false, readOnlyRoots: [] },
      outputSchema: {
        type: "object",
        required: ["outcome", "summary", "checks"],
        properties: {
          outcome: { type: "string" },
          summary: { type: "string" },
          checks: { type: "array" }
        }
      }
    })) events.push(event);

    expect(events).toContainEqual(expect.objectContaining({ type: "permission.denied" }));
    expect(events).toContainEqual(expect.objectContaining({
      type: "execution.completed",
      structuredOutput: { outcome: "ready", summary: "Codex done.", checks: [] }
    }));
  });

  it("discovers models through model/list after initialize", async () => {
    const context = await fixture();
    const adapter = new CodexAppServerAdapter({ command: context.command });
    await expect(adapter.listModels()).resolves.toEqual([
      expect.objectContaining({
        id: "gpt-5.4",
        name: "GPT-5.4",
        isDefault: true,
        reasoningOptions: ["medium", "high"],
        defaultReasoning: "medium"
      })
    ]);
  });

  it("fails the event stream when app-server exits after turn/start", async () => {
    const context = await fixture();
    await writeFile(path.join(context.root, "crash-after-turn-start"), "");
    const adapter = new CodexAppServerAdapter({ command: context.command });
    const consume = async () => {
      for await (const event of adapter.execute({
        executionId: "task-crash",
        prompt: "Do work.",
        workingDirectory: context.root,
        model: "provider-default",
        reasoning: "provider-default",
        policy: { network: false, readOnlyRoots: [] }
      })) { void event; }
    };

    await expect(consume()).rejects.toThrow("Codex app-server exited");
  });

  it("terminates a hanging turn when its execution signal is cancelled", async () => {
    const context = await fixture();
    await writeFile(path.join(context.root, "hang-after-turn-start"), "");
    const adapter = new CodexAppServerAdapter({ command: context.command });
    const controller = new AbortController();
    const consume = async () => {
      for await (const event of adapter.execute({
        executionId: "task-cancel",
        prompt: "Do work.",
        workingDirectory: context.root,
        model: "provider-default",
        reasoning: "provider-default",
        policy: { network: false, readOnlyRoots: [] },
        signal: controller.signal
      })) { void event; }
    };
    const running = consume();
    await waitForFile(path.join(context.root, "turn-started"));
    controller.abort(new Error("operator cancelled"));

    await expect(running).rejects.toThrow(/aborted|cancelled/i);
  });
});

const waitForFile = async (target: string): Promise<void> => {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (await access(target).then(() => true, () => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${target}.`);
};
