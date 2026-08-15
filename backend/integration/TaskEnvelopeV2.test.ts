import { describe, expect, it } from "vitest";
import type { TaskEnvelopeV2, WorkTaskEnvelopeV2 } from "../../shared/domain/taskEnvelope.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import {
  selectRelevantHistory, serializeTaskEnvelopeV2, TaskEnvelopeValidationError
} from "./TaskEnvelopeV2.js";

const workEnvelope = (): WorkTaskEnvelopeV2 => ({
  version: 2,
  role: "work",
  run: {
    rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "node-run",
    workLoopNodeRunId: "work-loop-node-run"
  },
  loop: { id: "main-loop", description: "Produce one validated result." },
  workLoopNode: { id: "produce", description: "Produce the result." },
  task: "Produce the requested result.",
  state: { revision: 2, value: { beta: 2, alpha: 1 }, sha256: jsonSha256({ alpha: 1, beta: 2 }) },
  localAttempt: 2,
  previousValidationFeedback: { feedback: "Value is incomplete.", expectedCorrection: "Add the missing value." },
  relevantHistory: [
    { sequence: 2, nodeRunId: "validation-1", role: "validation", state: "completed", summary: "Retry.", stateRevision: 2 },
    { sequence: 1, nodeRunId: "work-1", role: "work", state: "completed", summary: "Produced.", stateRevision: 1 }
  ]
});

describe("Task Envelope V2", () => {
  it("serializes deterministically with canonical State and history order", () => {
    const first = serializeTaskEnvelopeV2(workEnvelope());
    const reordered = workEnvelope();
    reordered.state.value = { alpha: 1, beta: 2 };
    reordered.relevantHistory.reverse();
    const second = serializeTaskEnvelopeV2(reordered);

    expect(first.serialized).toBe(second.serialized);
    expect(first.sha256).toBe(second.sha256);
    expect(first.serialized).toBe(
      "{\"localAttempt\":2,\"loop\":{\"description\":\"Produce one validated result.\",\"id\":\"main-loop\"},\"previousValidationFeedback\":{\"expectedCorrection\":\"Add the missing value.\",\"feedback\":\"Value is incomplete.\"},\"relevantHistory\":[{\"nodeRunId\":\"work-1\",\"role\":\"work\",\"sequence\":1,\"state\":\"completed\",\"stateRevision\":1,\"summary\":\"Produced.\"},{\"nodeRunId\":\"validation-1\",\"role\":\"validation\",\"sequence\":2,\"state\":\"completed\",\"stateRevision\":2,\"summary\":\"Retry.\"}],\"role\":\"work\",\"run\":{\"loopRunId\":\"loop-run\",\"nodeRunId\":\"node-run\",\"rootRunId\":\"root-run\",\"workLoopNodeRunId\":\"work-loop-node-run\"},\"state\":{\"revision\":2,\"sha256\":\"955c071f4fbee40a01b9bc6e8fb3627e81bda84811ae9c29fcc5812ba3a45162\",\"value\":{\"alpha\":1,\"beta\":2}},\"task\":\"Produce the requested result.\",\"version\":2,\"workLoopNode\":{\"description\":\"Produce the result.\",\"id\":\"produce\"}}"
    );
  });

  it("selects exactly the newest eight relevant entries without truncating an entry", () => {
    const history = Array.from({ length: 12 }, (_, sequence) => ({
      sequence, nodeRunId: `node-${sequence}`, role: "work" as const,
      state: "completed" as const, summary: `Summary ${sequence}.`, stateRevision: sequence
    })).reverse();
    expect(selectRelevantHistory(history).map(({ sequence }) => sequence)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("measures Unicode as UTF-8 bytes while preserving exact semantic content", () => {
    const value = workEnvelope();
    value.task = "Tarkista ääkköset ja π.";
    const result = serializeTaskEnvelopeV2(value);
    expect(result.serialized).toContain("Tarkista ääkköset ja π.");
    expect(result.sizeBytes).toBe(Buffer.byteLength(result.serialized, "utf8"));
  });

  it("includes Validation work evidence and Orchestrator repair allowlist", () => {
    const { previousValidationFeedback: _feedback, ...validationBase } = workEnvelope();
    void _feedback;
    const validation: TaskEnvelopeV2 = {
      ...validationBase, role: "validation", task: "Validate the result.",
      workOutcome: { role: "work", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
    };
    const orchestrator: TaskEnvelopeV2 = {
      version: 2, role: "orchestrator",
      run: { rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "orchestrator-run" },
      loop: { id: "main-loop", description: "Produce one validated result." },
      task: "Route the persisted Repair Request.", state: workEnvelope().state,
      repairRequest: {
        id: "repair-request", requesterLoopRunId: "loop-run",
        requesterWorkLoopNodeRunId: "work-loop-node-run", requesterValidationNodeRunId: "validation-run",
        reason: "A specialist capability is required.", requestedCapability: "repair structured state",
        stateRevisionAtRequest: 2, nestingDepth: 0
      },
      allowedTargetLoops: [
        { id: "z-loop", description: "Z repair." },
        { id: "a-loop", description: "A repair." }
      ],
      relevantHistory: []
    };

    expect(serializeTaskEnvelopeV2(validation).envelope).toMatchObject({ role: "validation", workOutcome: { role: "work" } });
    expect(serializeTaskEnvelopeV2(orchestrator).envelope).toMatchObject({
      role: "orchestrator",
      allowedTargetLoops: [{ id: "a-loop" }, { id: "z-loop" }],
      repairRequest: { id: "repair-request" }
    });
  });

  it.each([
    ["State hash mismatch", (value: WorkTaskEnvelopeV2) => { value.state.sha256 = "0".repeat(64); }, /State SHA-256/],
    ["unknown field", (value: WorkTaskEnvelopeV2) => Object.assign(value, { hiddenReasoning: "private" }), /unrecognized/i],
    ["oversized State", (value: WorkTaskEnvelopeV2) => {
      value.state.value = "x".repeat(262_144);
      value.state.sha256 = jsonSha256(value.state.value);
    }, /maximum is 262144 bytes/],
    ["oversized relevant history", (value: WorkTaskEnvelopeV2) => {
      value.relevantHistory = Array.from({ length: 8 }, (_, sequence) => ({
        sequence, nodeRunId: `node-${sequence}`, role: "work", state: "completed",
        summary: "x".repeat(9_000), stateRevision: sequence
      }));
    }, /relevant history.*maximum/i],
    ["oversized resume context", (value: WorkTaskEnvelopeV2) => {
      value.resume = { question: "q".repeat(16_000), context: "c".repeat(16_000), response: "r".repeat(16_000) };
    }, /resume context.*maximum/i]
  ])("fails closed for %s", (_label, mutate, message) => {
    const value = workEnvelope();
    mutate(value);
    expect(() => serializeTaskEnvelopeV2(value)).toThrow(message);
  });

  it("rejects duplicate Orchestrator target Loops and an oversized Repair Request", () => {
    const base: TaskEnvelopeV2 = {
      version: 2, role: "orchestrator",
      run: { rootRunId: "root", loopRunId: "loop", nodeRunId: "node" },
      loop: { id: "source", description: "Source Loop." }, task: "Route repair.",
      state: { revision: 0, value: {}, sha256: jsonSha256({}) },
      repairRequest: {
        id: "repair", requesterLoopRunId: "loop", requesterWorkLoopNodeRunId: "work",
        requesterValidationNodeRunId: "validation", reason: "Repair.", requestedOutcome: {},
        stateRevisionAtRequest: 0, nestingDepth: 0
      },
      allowedTargetLoops: [{ id: "target", description: "Target." }, { id: "target", description: "Target." }],
      relevantHistory: []
    };
    expect(() => serializeTaskEnvelopeV2(base)).toThrow(/duplicate allowed target Loop/);
    base.allowedTargetLoops = [{ id: "target", description: "Target." }];
    base.repairRequest.evidence = "x".repeat(65_536);
    expect(() => serializeTaskEnvelopeV2(base)).toThrow(TaskEnvelopeValidationError);
    expect(() => serializeTaskEnvelopeV2(base)).toThrow(/Repair Request.*maximum/i);
  });

  it("fails the complete Envelope limit without truncating individually valid fields", () => {
    const value = workEnvelope();
    value.state.value = "s".repeat(250_000);
    value.state.sha256 = jsonSha256(value.state.value);
    value.loop.description = "l".repeat(20_000);
    value.workLoopNode.description = "n".repeat(20_000);
    value.task = "t".repeat(20_000);
    value.resume = { question: "q".repeat(10_000), context: "c".repeat(10_000), response: "r".repeat(10_000) };
    value.relevantHistory = Array.from({ length: 8 }, (_, sequence) => ({
      sequence, nodeRunId: `node-${sequence}`, role: "work", state: "completed",
      summary: "h".repeat(7_000), stateRevision: sequence
    }));

    expect(() => serializeTaskEnvelopeV2(value)).toThrow(/Task Envelope is .*maximum is 393216 bytes/);
    expect(value.state.value).toHaveLength(250_000);
  });
});
