import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import { defaultTerminalNodes, type ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  loadProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";
import {
  dataImportFixture,
  documentReviewFixture,
  incidentEscalationFixture,
  platformTransitionWorkflows
} from "./fixtures/platformTransitionWorkflows.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-automation-v8-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("generic transition action configuration", () => {
  it.each(platformTransitionWorkflows)("accepts the %s workflow without privileged paths", (_name, fixture) => {
    expect(validateProjectAutomationConfig(fixture())).toEqual([]);
  });

  it("round-trips only the canonical strict v8 action shape", async () => {
    const root = await tempRoot();
    const config = documentReviewFixture();
    expect(await saveProjectAutomationConfig(root, config)).toEqual(config);
    expect(await loadProjectAutomationConfig(root)).toEqual(config);
    const raw = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as Record<string, unknown>;
    expect(raw.version).toBe(8);
    expect(raw.agents).toEqual({});
    expect(JSON.stringify(raw)).toContain('"action":"retry"');
    expect(JSON.stringify(raw)).not.toContain('"repair"');
    expect(JSON.stringify(raw)).not.toContain('"terminal"');
  });

  it("allows local and cross-Loop cycles", () => {
    expect(validateProjectAutomationConfig(documentReviewFixture())).toEqual([]);
    expect(validateProjectAutomationConfig(dataImportFixture())).toEqual([]);
    expect(validateProjectAutomationConfig(incidentEscalationFixture())).toEqual([]);
  });

  it("allows cross-Loop goto actions from agent, scheduled, and human signals", () => {
    const scheduled = dataImportFixture();
    const scheduledStep = scheduled.loops[0]!.nodes[0]!;
    if (scheduledStep.type !== "scheduled") throw new Error("Expected scheduled fixture.");
    expect(scheduledStep.on.blocked).toEqual({ action: "goto", target: { loop: "mapping-assistance" } });

    const agent = incidentEscalationFixture();
    const agentStep = agent.loops[0]!.nodes[0]!;
    if (agentStep.type !== "agent") throw new Error("Expected agent fixture.");
    expect(agentStep.on["changes-requested"]).toEqual({ action: "goto", target: { loop: "incident-escalation" } });

    const human = scheduled.loops[1]!.nodes[0]!;
    if (human.type !== "human") throw new Error("Expected human fixture.");
    expect(human.on.approved).toMatchObject({ action: "goto", target: { loop: "data-import" } });
    expect(validateProjectAutomationConfig(scheduled)).toEqual([]);
    expect(validateProjectAutomationConfig(agent)).toEqual([]);
  });
});

describe("structural transition validation", () => {
  it.each([
    ["unknown action", { action: "repair", target: "revise-draft" }],
    ["zero retry bound", { action: "retry", policy: { maxAttempts: 0, onExhausted: { action: "terminate", status: "blocked" } } }],
    ["fractional retry bound", { action: "retry", policy: { maxAttempts: 1.5, onExhausted: { action: "terminate", status: "blocked" } } }],
    ["invalid wait", { action: "wait", resume: { target: 42 } }],
    ["invalid terminal status", { action: "terminate", status: "cancelled" }],
    ["extra action field", { action: "goto", target: "completed", terminal: "completed" }]
  ])("rejects %s", (_name, action) => {
    const candidate = structuredClone(documentReviewFixture()) as unknown as {
      loops: Array<{ nodes: Array<{ on?: Record<string, unknown> }> }>;
    };
    candidate.loops[0]!.nodes[0]!.on!.ready = action;
    expect(validateProjectAutomationConfig(candidate)).not.toEqual([]);
  });

  it("rejects unknown local, Loop, retry, and nested fallback targets", () => {
    for (const action of [
      { action: "goto", target: "missing-node" },
      { action: "goto", target: { loop: "missing-loop" } },
      { action: "retry", target: "completed", policy: { maxAttempts: 2, onExhausted: { action: "terminate", status: "blocked" } } },
      { action: "retry", policy: { maxAttempts: 2, onExhausted: { action: "goto", target: "missing-node" } } }
    ]) {
      const candidate = structuredClone(documentReviewFixture()) as unknown as {
        loops: Array<{ nodes: Array<{ on?: Record<string, unknown> }> }>;
      };
      candidate.loops[0]!.nodes[0]!.on!.blocked = action;
      expect(validateProjectAutomationConfig(candidate)).not.toEqual([]);
    }
  });

  it("rejects missing starts, duplicate ids, and unknown agents", () => {
    const base = documentReviewFixture();
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, start: "missing" }]
    }).some((issue) => issue.message.includes("executable node"))).toBe(true);
    expect(validateProjectAutomationConfig({
      ...base,
      loops: [{ ...base.loops[0]!, nodes: [base.loops[0]!.nodes[0]!, base.loops[0]!.nodes[0]!, ...defaultTerminalNodes()] }]
    }).some((issue) => issue.message.includes("Duplicate node"))).toBe(true);

    const known: Agent[] = [];
    expect(validateProjectAutomationConfig(base, known).some((issue) => issue.message.includes("unknown agent"))).toBe(true);
  });

  it("requires every signal exactly once", () => {
    const candidate = structuredClone(documentReviewFixture()) as unknown as {
      version: 8;
      loops: Array<{ nodes: Array<{ on?: Record<string, unknown> }> }>;
    };
    delete candidate.loops[0]!.nodes[0]!.on!.failed;
    expect(validateProjectAutomationConfig(candidate).some((issue) => issue.path.includes("on.failed"))).toBe(true);
  });
});

const _typeCheck: ProjectAutomationConfig = documentReviewFixture();
void _typeCheck;
