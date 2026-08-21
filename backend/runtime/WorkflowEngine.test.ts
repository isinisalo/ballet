import { describe, expect, it } from "vitest";
import type { ValidationCompletedOutcome } from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { testJobPair } from "../tests/v13TestConfig.js";
import { createRuntimeStoreFixture } from "./RuntimeStore.test-fixture.js";

const failOutcome = (summary = "Correction required."): ValidationCompletedOutcome => ({
  role: "validation",
  state: "completed",
  decision: "FAIL",
  summary,
  evidence: { check: "failed" },
  checks: [],
  feedback: "Correct the value.",
  expectedCorrection: "Set corrected true.",
  escalation: {
    reason: "The Workflow cannot complete without a corrected value.",
    requestedCapability: "test:loop.transfer",
    evidenceRefs: ["check-1"]
  }
});

describe("WorkflowEngine transitions", () => {
  it("runs Job → paired Validation → PassEdge → Workflow PASS with canonical State readback", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const job = runtime.startLoopRun("root-run").nodeRuns[0]!;

    const validation = runtime.applyNodeOutcome("root-run", job.nodeRunId, {
      role: "job", state: "completed", summary: "Job completed.", artifacts: {}, checks: [],
      statePatch: [{ op: "replace", path: "/count", value: 1 }]
    }).nodeRuns.at(-1)!;
    expect(validation).toMatchObject({ role: "validation", workflowNodeId: "job-validation", status: "waiting_for_input", stateRevisionBefore: 1 });

    const completed = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "PASS", summary: "Accepted.",
      evidence: { check: "passed" }, checks: []
    });
    expect(completed).toMatchObject({ status: "completed", completionStateRevision: 1 });
    expect(completed.jobRuns[0]).toMatchObject({ jobAttempt: 1, status: "completed", terminal: "completed" });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 1, state: { count: 1 } });
    expect(runtime.listControlFlowEvents("root-run").map(({ kind }) => kind)).toEqual(["job_completed", "validation_pass"]);
    runtime.close();
    await fixture.close();
  });

  it("follows PassEdge to a new JobRun with its retry counter reset", async () => {
    const first = testJobPair("first");
    const second = testJobPair("second");
    const loop = {
      id: "main-loop", description: "Two Job Workflow.", state: { description: "State.", initial: {} },
      capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
      workflow: {
        startJobNodeId: first.job.id,
        jobNodes: [first.job, second.job],
        validationNodes: [first.validation, second.validation],
        passEdges: [
          { id: "first-pass", sourceValidationNodeId: first.validation.id, target: { jobNodeId: second.job.id } },
          { id: "second-pass", sourceValidationNodeId: second.validation.id, target: { workflowResult: "PASS" as const } }
        ],
        failEdges: [first, second].map((pair) => ({ id: `${pair.job.id}-fail`, sourceValidationNodeId: pair.validation.id, target: { workflowResult: "FAIL" as const } }))
      }
    };
    const fixture = await createRuntimeStoreFixture({}, { loop });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const firstJob = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const firstValidation = completeJob(runtime, firstJob.nodeRunId, "First completed.");
    const next = runtime.applyNodeOutcome("root-run", firstValidation.nodeRunId, passOutcome("First accepted."));

    expect(next.jobRuns).toHaveLength(2);
    expect(next.jobRuns[0]).toMatchObject({ jobNodeId: "first", status: "completed" });
    expect(next.jobRuns[1]).toMatchObject({ jobNodeId: "second", status: "running", jobAttempt: 1 });
    expect(next.nodeRuns.at(-1)).toMatchObject({ role: "job", workflowNodeId: "second", status: "queued" });
    expect(runtime.listControlFlowEvents("root-run").at(-1)).toMatchObject({ kind: "validation_pass", targetJobRunId: next.jobRuns[1]?.jobRunId });
    runtime.close();
    await fixture.close();
  });

  it("allows three local retries and sends the fourth Validation FAIL through FailEdge to the Orchestrator", async () => {
    const fixture = await createRuntimeStoreFixture({ corrected: false });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    let job = runtime.startLoopRun("root-run").nodeRuns.at(-1)!;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const validation = completeJob(runtime, job.nodeRunId, `Job attempt ${attempt}.`);
      const retried = runtime.applyNodeOutcome("root-run", validation.nodeRunId, failOutcome(`Retry ${attempt}.`));
      expect(retried.jobRuns[0]).toMatchObject({ jobAttempt: attempt + 1, status: "running" });
      expect(runtime.connection().prepare("SELECT COUNT(*) FROM repair_requests").pluck().get()).toBe(0);
      job = retried.nodeRuns.at(-1)!;
      expect(job.context).toEqual({ previousValidationFeedback: { feedback: "Correct the value.", expectedCorrection: "Set corrected true." } });
    }

    const fourthValidation = completeJob(runtime, job.nodeRunId, "Fourth Job execution.");
    const escalated = runtime.applyNodeOutcome("root-run", fourthValidation.nodeRunId, failOutcome("Retry budget exhausted."));
    expect(escalated.jobRuns[0]).toMatchObject({ jobAttempt: 4, status: "waiting_for_input", activeNodeRunId: undefined });
    expect(escalated.nodeRuns.at(-1)).toMatchObject({ role: "orchestrator", status: "queued" });
    const request = runtime.connection().prepare("SELECT repair_request_id FROM repair_requests").pluck().get();
    expect(runtime.getRepairRequest(String(request))).toMatchObject({
      status: "pending",
      requesterValidationNodeRunId: fourthValidation.nodeRunId,
      returnValidationNodeDefinitionId: fourthValidation.nodeDefinitionId,
      requestedCapability: "test:loop.transfer"
    });
    runtime.close();
    await fixture.close();
  });

  it("starts a Human Job and accepts its canonical outcome", async () => {
    const pair = testJobPair();
    pair.job = {
      id: pair.job.id, description: pair.job.description, validationNodeId: pair.job.validationNodeId,
      maxRetries: pair.job.maxRetries, type: "human", task: "Perform the Job.", nodeStyle: "terra", nodeSize: "medium"
    };
    const fixture = await createRuntimeStoreFixture({}, { loop: {
      id: "main-loop", description: "Human Job Workflow.", state: { description: "State.", initial: {} },
      capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
      workflow: {
        startJobNodeId: pair.job.id, jobNodes: [pair.job], validationNodes: [pair.validation],
        passEdges: [{ id: "job-pass", sourceValidationNodeId: pair.validation.id, target: { workflowResult: "PASS" } }],
        failEdges: [{ id: "job-fail", sourceValidationNodeId: pair.validation.id, target: { workflowResult: "FAIL" } }]
      }
    } });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const job = runtime.startLoopRun("root-run").nodeRuns[0]!;
    expect(job).toMatchObject({ role: "job", status: "waiting_for_input", executionTaskId: undefined });
    expect(runtime.applyNodeOutcome("root-run", job.nodeRunId, {
      role: "job", state: "completed", summary: "Human Job completed.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)).toMatchObject({ role: "validation", status: "waiting_for_input" });
    runtime.close();
    await fixture.close();
  });
});

describe("WorkflowEngine suspension and failure boundaries", () => {
  it("needs_input resumes the same Workflow node without changing State or Job retry count", async () => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const job = runtime.startLoopRun("root-run").nodeRuns[0]!;
    runtime.applyNodeOutcome("root-run", job.nodeRunId, {
      role: "job", state: "needs_input", summary: "Need a choice.", checks: [], question: "Which option?", context: "A or B"
    });
    const resumed = runtime.resumeNode("root-run", job.nodeRunId, "A");
    expect(resumed.jobRuns[0]).toMatchObject({ jobAttempt: 1, status: "running" });
    expect(resumed.nodeRuns.at(-1)).toMatchObject({ role: "job", workflowNodeId: "job", attempt: 2, stateRevisionBefore: 0, status: "queued" });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { stable: true } });
    runtime.close();
    await fixture.close();
  });

  it.each(["blocked", "failed"] as const)("technical Job %s terminates without traversing FailEdge", async (state) => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const job = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const terminal = runtime.applyNodeOutcome("root-run", job.nodeRunId, { role: "job", state, summary: `Job ${state}.`, checks: [] });
    expect(terminal).toMatchObject({ status: state, completionStateRevision: 0 });
    expect(runtime.connection().prepare("SELECT COUNT(*) FROM repair_requests").pluck().get()).toBe(0);
    runtime.close();
    await fixture.close();
  });

  it("rolls back an invalid Job patch and does not create Validation", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const job = runtime.startLoopRun("root-run").nodeRuns[0]!;
    expect(() => runtime.applyNodeOutcome("root-run", job.nodeRunId, {
      role: "job", state: "completed", summary: "Invalid patch.", artifacts: {}, checks: [],
      statePatch: [{ op: "replace", path: "/missing", value: true }]
    })).toThrow(/does not exist/);
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { count: 0 } });
    expect(runtime.listRootLoopRuns("root-run")[0]?.nodeRuns).toHaveLength(1);
    runtime.close();
    await fixture.close();
  });
});

function completeJob(runtime: RuntimeDatabase, nodeRunId: string, summary: string) {
  return runtime.applyNodeOutcome("root-run", nodeRunId, {
    role: "job", state: "completed", summary, artifacts: {}, checks: []
  }).nodeRuns.at(-1)!;
}

const passOutcome = (summary: string): ValidationCompletedOutcome => ({
  role: "validation", state: "completed", decision: "PASS", summary, evidence: {}, checks: []
});
