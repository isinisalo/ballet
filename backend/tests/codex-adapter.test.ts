import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../shared/domain.js";
import { runCodexAgent } from "../codex-adapter.js";

const tempRoots: string[] = [];
let previousScenario: string | undefined;

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-codex-adapter-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  if (previousScenario === undefined) delete process.env.BALLET_FIXTURE_SCENARIO;
  else process.env.BALLET_FIXTURE_SCENARIO = previousScenario;
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer Agent",
  description: "Implements Ballet work.",
  instructions: "Return the runtime schema only.",
  skills: [],
  enabled: true,
  status: "offline",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const fixtureSource = `#!/usr/bin/env node
const readline = require("node:readline");

const scenario = process.env.BALLET_FIXTURE_SCENARIO || "success";
const rl = readline.createInterface({ input: process.stdin });
let currentThreadId = "thread-1";
let waitingForApproval = false;

const outcome = {
  outcome: "ready",
  summary: "Fixture completed.",
  artifacts: {
    git_sha: "4f28dbd",
    changed_files: ["backend/codex-adapter.ts"]
  },
  checks: [{ name: "unit-tests", status: "passed" }]
};

const send = (message) => {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\\n");
};

const completeTurn = () => {
  const failed = scenario === "turn-failed";
  const text = scenario === "malformed-output" ? "{not json" : JSON.stringify(outcome);
  send({
    method: "item/completed",
    params: {
      threadId: currentThreadId,
      turnId: "turn-1",
      item: {
        type: "agentMessage",
        id: "item-1",
        text,
        phase: "final_answer",
        memoryCitation: null
      }
    }
  });
  send({
    method: "turn/completed",
    params: {
      threadId: currentThreadId,
      turn: {
        id: "turn-1",
        items: [],
        status: failed ? "failed" : "completed",
        error: failed ? { message: "turn exploded" } : null,
        startedAt: 0,
        completedAt: 1,
        durationMs: 1
      }
    }
  });
};

rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id !== undefined && !message.method) {
    if (waitingForApproval) {
      if (!message.result || message.result.decision !== "accept") process.exit(3);
      waitingForApproval = false;
      completeTurn();
    }
    return;
  }

  if (message.method === "initialize") {
    send({ id: message.id, result: {} });
    return;
  }
  if (message.method === "initialized") return;
  if (message.method === "thread/resume") {
    if (scenario === "resume-fallback") {
      send({ id: message.id, error: { code: -32000, message: "thread not found" } });
      return;
    }
    currentThreadId = message.params.threadId;
    send({ id: message.id, result: { thread: { id: currentThreadId } } });
    return;
  }
  if (message.method === "thread/start") {
    currentThreadId = scenario === "resume-fallback" ? "thread-new" : "thread-1";
    send({ id: message.id, result: { thread: { id: currentThreadId } } });
    return;
  }
  if (message.method === "turn/start") {
    currentThreadId = message.params.threadId;
    send({ id: message.id, result: { turn: { id: "turn-1", items: [], status: "running", error: null } } });
    if (scenario === "approval-request") {
      waitingForApproval = true;
      send({
        id: "approval-1",
        method: "item/commandExecution/requestApproval",
        params: { threadId: currentThreadId, turnId: "turn-1", itemId: "cmd-1" }
      });
      return;
    }
    completeTurn();
  }
});
`;

const writeFixture = async (root: string) => {
  const fixture = path.join(root, "codex-fixture.cjs");
  await writeFile(fixture, fixtureSource, { mode: 0o755 });
  await chmod(fixture, 0o755);
  return fixture;
};

const runFixture = async (scenario: string, resumeThreadId?: string) => {
  previousScenario = process.env.BALLET_FIXTURE_SCENARIO;
  process.env.BALLET_FIXTURE_SCENARIO = scenario;
  const root = await tempRoot();
  const fixture = await writeFixture(root);
  const logs: string[] = [];
  const threads: Array<{ threadId: string; turnId?: string }> = [];

  const result = await runCodexAgent({
    runId: "run-1",
    workItemId: "work-1",
    agentRole: "developer-agent",
    agent,
    prompt: "Return schema JSON.",
    outputSchema: {
      type: "object",
      additionalProperties: true
    },
    projectRoot: root,
    resumeThreadId,
    timeoutMs: 5000,
    codexCommand: fixture,
    onLog: (_level, message) => logs.push(message),
    onThread: (threadId, turnId) => threads.push({ threadId, turnId })
  });

  return { result, logs, threads };
};

describe("Codex app-server adapter", () => {
  it("captures the final agentMessage after a completed turn", async () => {
    const { result, threads } = await runFixture("success");

    expect(result.threadId).toBe("thread-1");
    expect(result.turnId).toBe("turn-1");
    expect(result.output).toMatchObject({ outcome: "ready", summary: "Fixture completed." });
    expect(threads).toContainEqual({ threadId: "thread-1", turnId: "turn-1" });
  });

  it("falls back to thread/start when thread/resume fails", async () => {
    const { result, logs } = await runFixture("resume-fallback", "missing-thread");

    expect(result.threadId).toBe("thread-new");
    expect(logs).toContain("Codex thread resume failed; starting a fresh thread.");
  });

  it("answers app-server approval requests deterministically", async () => {
    const { result } = await runFixture("approval-request");

    expect(result.output).toMatchObject({ outcome: "ready" });
  });

  it("fails when turn/completed reports a failed status", async () => {
    await expect(runFixture("turn-failed")).rejects.toThrow("turn exploded");
  });

  it("fails when final agent output is malformed", async () => {
    await expect(runFixture("malformed-output")).rejects.toThrow("not valid JSON");
  });
});
