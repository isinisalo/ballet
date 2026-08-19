import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectWorkLoopNode } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type {
  OrchestratorTaskEnvelopeV4, ValidationTaskEnvelopeV4, WorkTaskEnvelopeV4
} from "../../shared/domain/taskEnvelope.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { testExecutionProfile, testLoop, testOrchestrator, testWorkLoopNode } from "../tests/v11TestConfig.js";
import {
  composeExecutionPrompt, NODE_OUTCOME_SCHEMA_SHA256, systemExecutionResourceSnapshot
} from "./ExecutionComposition.js";

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const providerNode = (): ProjectWorkLoopNode => {
  const node = testWorkLoopNode("produce", { validation: "agent" });
  if (node.work.type !== "human") node.work.skillIds = ["project:z-skill", "project:a-skill"];
  return node;
};

const snapshot = (): RootExecutionSnapshot => {
  const loop = testLoop("main-loop", providerNode());
  return {
    version: 4,
    rootLoopId: loop.id,
    project: {
      checkoutRoot: "/workspace", headSha: "a".repeat(40),
      configHash: "b".repeat(64), snapshotHash: "c".repeat(64)
    },
    orchestrator: testOrchestrator(),
    graph: { loopEdges: [] },
    loops: [loop],
    terminals: ["completed", "blocked", "failed"],
    theme: defaultLoopTheme,
    executionProfiles: [testExecutionProfile],
    runtimes: [],
    resources: [
      systemExecutionResourceSnapshot(),
      resource("primary", "project:worker", "Primary instruction."),
      resource("primary", "project:reviewer", "Validation instruction."),
      resource("primary", "project:architect", "Orchestrator instruction."),
      resource("skill", "project:z-skill", "Z skill."),
      resource("skill", "project:a-skill", "A skill.")
    ],
    createdAt: "2026-01-01T00:00:00.000Z"
  };
};

const resource = (kind: "primary" | "skill", id: string, content: string) => ({
  kind,
  origin: "project" as const,
  id,
  relativePath: kind === "primary" ? `.ballet/instructions/${id}.md` : `.agents/skills/${id}/SKILL.md`,
  sourceSha256: sha256(content),
  content
});

const envelope = (): WorkTaskEnvelopeV4 => ({
  version: 4,
  role: "work",
  run: {
    rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "node-run",
    workLoopNodeRunId: "work-loop-node-run"
  },
  loop: { id: "main-loop", description: "Test Loop main-loop." },
  workLoopNode: { id: "produce", description: "Execute and validate produce." },
  task: "Execute produce.",
  state: { revision: 0, value: {}, sha256: jsonSha256({}) },
  localAttempt: 1,
  relevantHistory: []
});

describe("ExecutionComposition V4", () => {
  it("composes and hashes exact role-specific prompt bytes deterministically", () => {
    const evidence = composeExecutionPrompt(snapshot(), envelope());

    expect(evidence).toMatchObject({
      compositionVersion: 5,
      taskEnvelopeVersion: 4,
      outputSchemaVersion: 4,
      outputSchemaId: "work-node-outcome-v4",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.work,
      nodeRole: "work"
    });
    expect(evidence.resources.map(({ id }) => id)).toEqual([
      "system:execution-contract-v3", "project:worker", "project:a-skill", "project:z-skill"
    ]);
    expect(evidence.prompt.indexOf("project:a-skill")).toBeLessThan(evidence.prompt.indexOf("project:z-skill"));
    expect(evidence.prompt).toContain("TASK-ENVELOPE · v4");
    expect(evidence.prompt).toContain("OUTPUT-SCHEMA · v4");
    expect(evidence.promptSha256).toBe(sha256(evidence.prompt));
    expect(evidence.promptSha256).toBe("515ff4a44d30653997a2c6e921607fe988b1240f453fb04d028f6c2b32746174");
  });

  it("rejects an envelope that diverges from the immutable snapshot", () => {
    const invalid = envelope();
    invalid.workLoopNode.description = "Different description.";
    expect(() => composeExecutionPrompt(snapshot(), invalid)).toThrow(/does not match/);
  });

  it("selects Validation and Orchestrator schemas from immutable Node role", () => {
    const validation: ValidationTaskEnvelopeV4 = {
      ...envelope(), role: "validation", task: "Validate produce.",
      workOutcome: { role: "work", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
    };
    expect(composeExecutionPrompt(snapshot(), validation)).toMatchObject({
      nodeRole: "validation",
      outputSchemaId: "validation-node-outcome-v4",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.validation
    });

    const orchestratorSnapshot = snapshot();
    orchestratorSnapshot.loops.push(testLoop("repair-loop"));
    orchestratorSnapshot.graph.loopEdges.push({
      id: "main-to-repair", source: "main-loop", target: "repair-loop", kind: "repair",
      capability: "test:loop.transfer",
      description: "Allow a bounded repair."
    });
    const orchestrator: OrchestratorTaskEnvelopeV4 = {
      version: 4, role: "orchestrator",
      run: { rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "orchestrator-run" },
      loop: { id: "main-loop", description: "Test Loop main-loop." },
      task: "Route the persisted Repair Request.",
      state: { revision: 0, value: {}, sha256: jsonSha256({}) },
      orchestrationRequest: {
        id: "orchestration-request", kind: "repair", sourceLoopId: "main-loop",
        sourceLoopRunId: "loop-run", sourceNodeRunId: "validation-run",
        stateRevisionAtRequest: 0, completionSummary: "A repair is required.",
        completionEvidence: {}, requestedCapability: "test:loop.transfer"
      },
      allowedCandidates: [{
        id: "repair-loop", description: "Test Loop repair-loop.",
        capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
        route: { kind: "repair", capability: "test:loop.transfer", description: "Allow a bounded repair." }
      }],
      relevantHistory: []
    };
    expect(composeExecutionPrompt(orchestratorSnapshot, orchestrator)).toMatchObject({
      nodeRole: "orchestrator",
      workLoopNodeId: undefined,
      outputSchemaId: "orchestrator-node-outcome-v4",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.orchestrator
    });
    orchestrator.allowedCandidates[0]!.route.capability = "forged-capability";
    expect(() => composeExecutionPrompt(orchestratorSnapshot, orchestrator)).toThrow(/repair allowlist/);
  });

  it("fails visibly before provider execution when exact prompt bytes exceed the limit", () => {
    const oversized = snapshot();
    const primary = oversized.resources.find((candidate) => candidate.id === "project:worker")!;
    primary.content = "x".repeat(512 * 1024);
    expect(() => composeExecutionPrompt(oversized, envelope())).toThrow(/maximum is 524288 bytes/);
  });
});
