import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectWorkLoopNode } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type {
  OrchestratorTaskEnvelopeV2, ValidationTaskEnvelopeV2, WorkTaskEnvelopeV2
} from "../../shared/domain/taskEnvelope.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { testExecutionProfile, testLoop, testOrchestrator, testWorkLoopNode } from "../tests/v10TestConfig.js";
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
    version: 2,
    rootLoopId: loop.id,
    project: {
      checkoutRoot: "/workspace", headSha: "a".repeat(40),
      configHash: "b".repeat(64), snapshotHash: "c".repeat(64)
    },
    orchestrator: testOrchestrator(),
    loops: [loop],
    loopEdges: [],
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

const envelope = (): WorkTaskEnvelopeV2 => ({
  version: 2,
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

describe("ExecutionComposition V3", () => {
  it("composes and hashes exact role-specific prompt bytes deterministically", () => {
    const evidence = composeExecutionPrompt(snapshot(), envelope());

    expect(evidence).toMatchObject({
      compositionVersion: 3,
      taskEnvelopeVersion: 2,
      outputSchemaVersion: 3,
      outputSchemaId: "work-node-outcome-v3",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.work,
      nodeRole: "work"
    });
    expect(evidence.resources.map(({ id }) => id)).toEqual([
      "system:execution-contract-v3", "project:worker", "project:a-skill", "project:z-skill"
    ]);
    expect(evidence.prompt.indexOf("project:a-skill")).toBeLessThan(evidence.prompt.indexOf("project:z-skill"));
    expect(evidence.prompt).toContain("TASK-ENVELOPE · v2");
    expect(evidence.prompt).toContain("OUTPUT-SCHEMA · v3");
    expect(evidence.promptSha256).toBe(sha256(evidence.prompt));
    expect(evidence.promptSha256).toBe("2bcc2c41fa5a4d6fca233645bc6ce6a0a4938fadff788950a5d6c770ec017c9c");
  });

  it("rejects an envelope that diverges from the immutable snapshot", () => {
    const invalid = envelope();
    invalid.workLoopNode.description = "Different description.";
    expect(() => composeExecutionPrompt(snapshot(), invalid)).toThrow(/does not match/);
  });

  it("selects Validation and Orchestrator schemas from immutable Node role", () => {
    const validation: ValidationTaskEnvelopeV2 = {
      ...envelope(), role: "validation", task: "Validate produce.",
      workOutcome: { role: "work", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
    };
    expect(composeExecutionPrompt(snapshot(), validation)).toMatchObject({
      nodeRole: "validation",
      outputSchemaId: "validation-node-outcome-v3",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.validation
    });

    const orchestratorSnapshot = snapshot();
    orchestratorSnapshot.loops.push(testLoop("repair-loop"));
    orchestratorSnapshot.loopEdges.push({
      id: "main-to-repair", source: "main-loop", target: "repair-loop", kind: "repair",
      description: "Allow a bounded repair."
    });
    const orchestrator: OrchestratorTaskEnvelopeV2 = {
      version: 2, role: "orchestrator",
      run: { rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "orchestrator-run" },
      loop: { id: "main-loop", description: "Test Loop main-loop." },
      task: "Route the persisted Repair Request.",
      state: { revision: 0, value: {}, sha256: jsonSha256({}) },
      repairRequest: {
        id: "repair-request", requesterLoopRunId: "loop-run",
        requesterWorkLoopNodeRunId: "work-loop-node-run", requesterValidationNodeRunId: "validation-run",
        reason: "A repair capability is required.", requestedCapability: "repair state",
        stateRevisionAtRequest: 0, nestingDepth: 0
      },
      allowedTargetLoops: [{ id: "repair-loop", description: "Test Loop repair-loop." }],
      relevantHistory: []
    };
    expect(composeExecutionPrompt(orchestratorSnapshot, orchestrator)).toMatchObject({
      nodeRole: "orchestrator",
      workLoopNodeId: undefined,
      outputSchemaId: "orchestrator-node-outcome-v3",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.orchestrator
    });
  });

  it("fails visibly before provider execution when exact prompt bytes exceed the limit", () => {
    const oversized = snapshot();
    const primary = oversized.resources.find((candidate) => candidate.id === "project:worker")!;
    primary.content = "x".repeat(512 * 1024);
    expect(() => composeExecutionPrompt(oversized, envelope())).toThrow(/maximum is 524288 bytes/);
  });
});
