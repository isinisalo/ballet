import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type { JobTaskEnvelopeV6, OrchestratorTaskEnvelopeV6, ValidationTaskEnvelopeV6 } from "../../shared/domain/taskEnvelope.js";
import { canonicalJson, jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { testExecutionProfile, testJobPair, testLoop, testOrchestrator } from "../tests/v13TestConfig.js";
import { composeExecutionPrompt, NODE_OUTCOME_SCHEMA_SHA256, systemExecutionResourceSnapshot } from "./ExecutionComposition.js";

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const providerPair = () => {
  const pair = testJobPair("produce", { validation: "agent" });
  if (pair.job.type !== "human") pair.job.skillIds = ["project:z-skill", "project:a-skill"];
  return pair;
};

const snapshot = (): RootExecutionSnapshot => {
  const loop = testLoop("main-loop", providerPair());
  return {
    version: 6,
    rootKind: "loop",
    rootLoopId: loop.id,
    project: { checkoutRoot: "/workspace", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
    orchestrator: testOrchestrator(),
    issueTracker: {
      kind: "tk",
      testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration",
      workDirectory: ".tickets/work"
    },
    graph: {
      id: "test-graph", name: "Test Graph", startLoopId: loop.id, transitions: [],
      repairEdges: [{
        id: "main-self-repair", source: loop.id, target: loop.id,
        capability: "test:loop.transfer", description: "Allow a bounded self repair."
      }]
    },
    loops: [loop],
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
  kind, origin: "project" as const, id,
  relativePath: kind === "primary" ? `.ballet/instructions/${id}.md` : `.agents/skills/${id}/SKILL.md`,
  sourceSha256: sha256(content), content
});

const envelope = (): JobTaskEnvelopeV6 => ({
  version: 6,
  role: "job",
  run: { rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "node-run", jobRunId: "job-run" },
  loop: { id: "main-loop", description: "Test Loop main-loop." },
  jobNode: { id: "produce", description: "Execute produce." },
  task: "Execute produce.",
  state: { revision: 0, value: {}, sha256: jsonSha256({}) },
  jobAttempt: 1,
  relevantHistory: []
});

describe("ExecutionComposition V7", () => {
  it("composes and hashes exact role-specific prompt bytes deterministically", () => {
    const evidence = composeExecutionPrompt(snapshot(), envelope());
    const repeated = composeExecutionPrompt(snapshot(), envelope());
    expect(evidence).toMatchObject({
      compositionVersion: 7,
      taskEnvelopeVersion: 6,
      outputSchemaVersion: 6,
      outputSchemaId: "job-node-outcome-v6",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.job,
      nodeRole: "job",
      workflowNodeId: "produce"
    });
    expect(evidence.resources.map(({ id }) => id)).toEqual(["system:execution-contract-v4", "project:worker", "project:a-skill", "project:z-skill"]);
    expect(evidence.prompt).toContain("TASK-ENVELOPE · v6");
    expect(evidence.prompt).toContain("OUTPUT-SCHEMA · v6");
    expect(evidence.promptSha256).toBe(sha256(evidence.prompt));
    expect(repeated.promptSha256).toBe(evidence.promptSha256);
  });

  it("rejects an envelope that diverges from the immutable Workflow snapshot", () => {
    const invalid = envelope();
    invalid.jobNode.description = "Different description.";
    expect(() => composeExecutionPrompt(snapshot(), invalid)).toThrow(/does not match/);
  });

  it("selects Validation and Orchestrator v6 outcome schemas from immutable node roles", () => {
    const validation: ValidationTaskEnvelopeV6 = {
      ...envelope(), role: "validation", task: "Validate produce.",
      validationNode: { id: "produce-validation", description: "Validate produce." },
      allowedTransitions: [],
      jobOutcome: { role: "job", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
    };
    const validationEvidence = composeExecutionPrompt(snapshot(), validation);
    expect(validationEvidence).toMatchObject({
      nodeRole: "validation", workflowNodeId: "produce-validation",
      outputSchemaId: "validation-node-outcome-v6"
    });
    expect(validationEvidence.outputSchemaSha256).toBe(sha256(canonicalJson(validationEvidence.outputSchema)));

    const orchestratorSnapshot = snapshot();
    orchestratorSnapshot.loops.push(testLoop("repair-loop"));
    orchestratorSnapshot.graph.repairEdges = [{
      id: "main-to-repair", source: "main-loop", target: "repair-loop",
      capability: "test:loop.transfer", description: "Allow a bounded repair."
    }];
    const orchestrator: OrchestratorTaskEnvelopeV6 = {
      version: 6, role: "orchestrator",
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
      nodeRole: "orchestrator", workflowNodeId: undefined, outputSchemaId: "orchestrator-node-outcome-v6",
      outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256.orchestrator
    });
    orchestrator.allowedCandidates[0]!.route.capability = "forged-capability";
    expect(() => composeExecutionPrompt(orchestratorSnapshot, orchestrator)).toThrow(/repair allowlist/);
  });

  it("fails visibly before provider execution when exact prompt bytes exceed the limit", () => {
    const oversized = snapshot();
    oversized.resources.find((candidate) => candidate.id === "project:worker")!.content = "x".repeat(512 * 1024);
    expect(() => composeExecutionPrompt(oversized, envelope())).toThrow(/maximum is 524288 bytes/);
  });
});
