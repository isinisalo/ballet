import { describe, expect, it } from "vitest";
import type { TaskEnvelopeV4, WorkTaskEnvelopeV4 } from "../../shared/domain/taskEnvelope.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import {
  selectRelevantHistory, serializeTaskEnvelopeV4, TaskEnvelopeValidationError
} from "./TaskEnvelopeV4.js";

const workEnvelope = (): WorkTaskEnvelopeV4 => ({
  version: 4,
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

describe("Task Envelope V4", () => {
  it("serializes deterministically with canonical State and history order", () => {
    const first = serializeTaskEnvelopeV4(workEnvelope());
    const reordered = workEnvelope();
    reordered.state.value = { alpha: 1, beta: 2 };
    reordered.relevantHistory.reverse();
    const second = serializeTaskEnvelopeV4(reordered);

    expect(first.serialized).toBe(second.serialized);
    expect(first.sha256).toBe(second.sha256);
    expect(first.serialized).toBe(
      "{\"localAttempt\":2,\"loop\":{\"description\":\"Produce one validated result.\",\"id\":\"main-loop\"},\"previousValidationFeedback\":{\"expectedCorrection\":\"Add the missing value.\",\"feedback\":\"Value is incomplete.\"},\"relevantHistory\":[{\"nodeRunId\":\"work-1\",\"role\":\"work\",\"sequence\":1,\"state\":\"completed\",\"stateRevision\":1,\"summary\":\"Produced.\"},{\"nodeRunId\":\"validation-1\",\"role\":\"validation\",\"sequence\":2,\"state\":\"completed\",\"stateRevision\":2,\"summary\":\"Retry.\"}],\"role\":\"work\",\"run\":{\"loopRunId\":\"loop-run\",\"nodeRunId\":\"node-run\",\"rootRunId\":\"root-run\",\"workLoopNodeRunId\":\"work-loop-node-run\"},\"state\":{\"revision\":2,\"sha256\":\"955c071f4fbee40a01b9bc6e8fb3627e81bda84811ae9c29fcc5812ba3a45162\",\"value\":{\"alpha\":1,\"beta\":2}},\"task\":\"Produce the requested result.\",\"version\":4,\"workLoopNode\":{\"description\":\"Produce the result.\",\"id\":\"produce\"}}"
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
    const result = serializeTaskEnvelopeV4(value);
    expect(result.serialized).toContain("Tarkista ääkköset ja π.");
    expect(result.sizeBytes).toBe(Buffer.byteLength(result.serialized, "utf8"));
  });

  it("includes Validation work evidence and a generic Orchestrator allowlist", () => {
    const { previousValidationFeedback: _feedback, ...validationBase } = workEnvelope();
    void _feedback;
    const validation: TaskEnvelopeV4 = {
      ...validationBase, role: "validation", task: "Validate the result.",
      workOutcome: { role: "work", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
    };
    const orchestrator: TaskEnvelopeV4 = {
      version: 4, role: "orchestrator",
      run: { rootRunId: "root-run", loopRunId: "loop-run", nodeRunId: "orchestrator-run" },
      loop: { id: "main-loop", description: "Produce one validated result." },
      task: "Route the persisted Repair Request.", state: workEnvelope().state,
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
    };

    expect(serializeTaskEnvelopeV4(validation).envelope).toMatchObject({ role: "validation", workOutcome: { role: "work" } });
    expect(serializeTaskEnvelopeV4(orchestrator).envelope).toMatchObject({
      role: "orchestrator",
      allowedCandidates: [{ id: "a-loop" }, { id: "z-loop" }],
      orchestrationRequest: { id: "request" }
    });
  });
});

describe("Task Envelope V4 limits", () => {
  it.each([
    ["State hash mismatch", (value: WorkTaskEnvelopeV4) => { value.state.sha256 = "0".repeat(64); }, /State SHA-256/],
    ["unknown field", (value: WorkTaskEnvelopeV4) => Object.assign(value, { hiddenReasoning: "private" }), /unrecognized/i],
    ["oversized State", (value: WorkTaskEnvelopeV4) => {
      value.state.value = "x".repeat(262_144);
      value.state.sha256 = jsonSha256(value.state.value);
    }, /maximum is 262144 bytes/],
    ["oversized relevant history", (value: WorkTaskEnvelopeV4) => {
      value.relevantHistory = Array.from({ length: 8 }, (_, sequence) => ({
        sequence, nodeRunId: `node-${sequence}`, role: "work", state: "completed",
        summary: "x".repeat(9_000), stateRevision: sequence
      }));
    }, /relevant history.*maximum/i],
    ["oversized resume context", (value: WorkTaskEnvelopeV4) => {
      value.resume = { question: "q".repeat(16_000), context: "c".repeat(16_000), response: "r".repeat(16_000) };
    }, /resume context.*maximum/i]
  ])("fails closed for %s", (_label, mutate, message) => {
    const value = workEnvelope();
    mutate(value);
    expect(() => serializeTaskEnvelopeV4(value)).toThrow(message);
  });

  it("rejects duplicate Orchestrator candidates and an oversized Orchestration Request", () => {
    const base: TaskEnvelopeV4 = {
      version: 4, role: "orchestrator",
      run: { rootRunId: "root", loopRunId: "loop", nodeRunId: "node" },
      loop: { id: "source", description: "Source Loop." }, task: "Route repair.",
      state: { revision: 0, value: {}, sha256: jsonSha256({}) },
      orchestrationRequest: {
        id: "request", kind: "flow", sourceLoopId: "source", sourceLoopRunId: "loop",
        sourceNodeRunId: "node", stateRevisionAtRequest: 0,
        completionSummary: "Complete.", completionEvidence: {}
      },
      allowedCandidates: [
        { id: "target", description: "Target.", capabilities: { accepts: ["next"], provides: [] }, route: { kind: "flow", capability: "next", description: "A." } },
        { id: "target", description: "Target.", capabilities: { accepts: ["next"], provides: [] }, route: { kind: "flow", capability: "next", description: "B." } }
      ],
      relevantHistory: []
    };
    expect(() => serializeTaskEnvelopeV4(base)).toThrow(/duplicate allowed candidate/);
    base.allowedCandidates = [{
      id: "target", description: "Target.", capabilities: { accepts: ["next"], provides: [] }, route: { kind: "flow", capability: "next", description: "Route." }
    }];
    base.orchestrationRequest.completionEvidence = "x".repeat(65_536);
    expect(() => serializeTaskEnvelopeV4(base)).toThrow(TaskEnvelopeValidationError);
    expect(() => serializeTaskEnvelopeV4(base)).toThrow(/Orchestration Request.*maximum/i);
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

    expect(() => serializeTaskEnvelopeV4(value)).toThrow(/Task Envelope is .*maximum is 393216 bytes/);
    expect(value.state.value).toHaveLength(250_000);
  });
});
