import { describe, expect, it } from "vitest";
import type { JobTaskEnvelopeV6, OrchestratorTaskEnvelopeV6, ValidationTaskEnvelopeV6 } from "../../shared/domain/taskEnvelope.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { selectRelevantHistory, serializeTaskEnvelopeV6, TaskEnvelopeValidationError } from "./TaskEnvelopeV6.js";

const jobEnvelope = (): JobTaskEnvelopeV6 => ({
  version: 6,
  role: "job",
  run: { rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "node-run", jobRunId: "job-run" },
  loop: { id: "main-loop", description: "Produce one validated result." },
  jobNode: { id: "produce", description: "Produce the result." },
  task: "Produce the requested result.",
  state: { revision: 2, value: { beta: 2, alpha: 1 }, sha256: jsonSha256({ alpha: 1, beta: 2 }) },
  jobAttempt: 2,
  previousValidationFeedback: { feedback: "Value is incomplete.", expectedCorrection: "Add the missing value." },
  relevantHistory: [
    { sequence: 2, nodeRunId: "validation-1", role: "validation", state: "completed", summary: "Retry.", stateRevision: 2 },
    { sequence: 1, nodeRunId: "job-1", role: "job", state: "completed", summary: "Produced.", stateRevision: 1 }
  ]
});

describe("Task Envelope V6", () => {
  it("serializes deterministically with canonical State and history order", () => {
    const first = serializeTaskEnvelopeV6(jobEnvelope());
    const reordered = jobEnvelope();
    reordered.state.value = { alpha: 1, beta: 2 };
    reordered.relevantHistory.reverse();
    const second = serializeTaskEnvelopeV6(reordered);
    expect(first.serialized).toBe(second.serialized);
    expect(first.sha256).toBe(second.sha256);
    expect(first.envelope).toMatchObject({ version: 6, role: "job", jobNode: { id: "produce" }, jobAttempt: 2 });
    expect(first.envelope.relevantHistory.map(({ sequence }) => sequence)).toEqual([1, 2]);
  });

  it("selects exactly the newest eight relevant entries without truncating an entry", () => {
    const history = Array.from({ length: 12 }, (_, sequence) => ({
      sequence, nodeRunId: `node-${sequence}`, role: "job" as const,
      state: "completed" as const, summary: `Summary ${sequence}.`, stateRevision: sequence
    })).reverse();
    expect(selectRelevantHistory(history).map(({ sequence }) => sequence)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("measures Unicode as UTF-8 bytes while preserving exact content", () => {
    const value = jobEnvelope();
    value.task = "Tarkista ääkköset ja π.";
    const result = serializeTaskEnvelopeV6(value);
    expect(result.serialized).toContain("Tarkista ääkköset ja π.");
    expect(result.sizeBytes).toBe(Buffer.byteLength(result.serialized, "utf8"));
  });

  it("includes Validation Job evidence and a generic Orchestrator allowlist", () => {
    const { previousValidationFeedback: _feedback, ...validationBase } = jobEnvelope();
    void _feedback;
    const validation: ValidationTaskEnvelopeV6 = {
      ...validationBase, role: "validation", task: "Validate the result.",
      validationNode: { id: "produce-validation", description: "Validate the result." },
      allowedTransitions: [],
      jobOutcome: { role: "job", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
    };
    const orchestrator = orchestratorEnvelope();
    expect(serializeTaskEnvelopeV6(validation).envelope).toMatchObject({ role: "validation", validationNode: { id: "produce-validation" }, jobOutcome: { role: "job" } });
    expect(serializeTaskEnvelopeV6(orchestrator).envelope).toMatchObject({ role: "orchestrator", allowedCandidates: [{ id: "a-loop" }, { id: "z-loop" }], orchestrationRequest: { id: "request" } });
  });
});

describe("Task Envelope V6 limits", () => {
  it.each([
    ["State hash mismatch", (value: JobTaskEnvelopeV6) => { value.state.sha256 = "0".repeat(64); }, /State SHA-256/],
    ["unknown field", (value: JobTaskEnvelopeV6) => Object.assign(value, { hiddenReasoning: "private" }), /unrecognized/i],
    ["oversized State", (value: JobTaskEnvelopeV6) => { value.state.value = "x".repeat(262_144); value.state.sha256 = jsonSha256(value.state.value); }, /maximum is 262144 bytes/],
    ["oversized relevant history", (value: JobTaskEnvelopeV6) => { value.relevantHistory = Array.from({ length: 8 }, (_, sequence) => ({ sequence, nodeRunId: `node-${sequence}`, role: "job", state: "completed", summary: "x".repeat(9_000), stateRevision: sequence })); }, /relevant history.*maximum/i],
    ["oversized resume context", (value: JobTaskEnvelopeV6) => { value.resume = { question: "q".repeat(16_000), context: "c".repeat(16_000), response: "r".repeat(16_000) }; }, /resume context.*maximum/i]
  ])("fails closed for %s", (_label, mutate, message) => {
    const value = jobEnvelope();
    mutate(value);
    expect(() => serializeTaskEnvelopeV6(value)).toThrow(message);
  });

  it("rejects duplicate Orchestrator candidates and an oversized request", () => {
    const value = orchestratorEnvelope();
    value.allowedCandidates[1] = { ...value.allowedCandidates[0]!, route: { ...value.allowedCandidates[0]!.route } };
    expect(() => serializeTaskEnvelopeV6(value)).toThrow(/duplicate allowed candidate/);
    value.allowedCandidates = [value.allowedCandidates[0]!];
    value.orchestrationRequest.completionEvidence = "x".repeat(65_536);
    expect(() => serializeTaskEnvelopeV6(value)).toThrow(TaskEnvelopeValidationError);
    expect(() => serializeTaskEnvelopeV6(value)).toThrow(/Orchestration Request.*maximum/i);
  });

  it("fails the complete Envelope limit without truncating valid fields", () => {
    const value = jobEnvelope();
    value.state.value = "s".repeat(250_000);
    value.state.sha256 = jsonSha256(value.state.value);
    value.loop.description = "l".repeat(20_000);
    value.jobNode.description = "n".repeat(20_000);
    value.task = "t".repeat(20_000);
    value.resume = { question: "q".repeat(10_000), context: "c".repeat(10_000), response: "r".repeat(10_000) };
    value.relevantHistory = Array.from({ length: 8 }, (_, sequence) => ({ sequence, nodeRunId: `node-${sequence}`, role: "job", state: "completed", summary: "h".repeat(7_000), stateRevision: sequence }));
    expect(() => serializeTaskEnvelopeV6(value)).toThrow(/Task Envelope is .*maximum is 393216 bytes/);
    expect(value.state.value).toHaveLength(250_000);
  });
});

const orchestratorEnvelope = (): OrchestratorTaskEnvelopeV6 => ({
  version: 6,
  role: "orchestrator",
  run: { rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "orchestrator-run" },
  loop: { id: "main-loop", description: "Produce one validated result." },
  task: "Route the persisted Repair Request.",
  state: jobEnvelope().state,
  orchestrationRequest: {
    id: "request", kind: "repair", sourceLoopId: "main-loop", sourceLoopRunId: "loop-run",
    sourceNodeRunId: "validation-run", stateRevisionAtRequest: 2,
    completionSummary: "A specialist repair is required.", completionEvidence: {},
    requestedCapability: "repair structured state"
  },
  allowedCandidates: [
    { id: "z-loop", description: "Z repair.", capabilities: { accepts: [], provides: ["repair structured state"] }, route: { kind: "repair", capability: "repair structured state", description: "Use Z." } },
    { id: "a-loop", description: "A repair.", capabilities: { accepts: [], provides: ["repair structured state"] }, route: { kind: "repair", capability: "repair structured state", description: "Use A." } }
  ],
  relevantHistory: []
});
