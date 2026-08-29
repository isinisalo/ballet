/* eslint-disable max-lines, max-lines-per-function -- One ordered fixture exercises the complete optimistic HTTP lifecycle without cross-test state cloning. */
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { afterEach, describe, expect, test } from "vitest";
import type { ProjectConfigurationV20 } from "../../../shared/vnext/environment.js";
import type { UseCase } from "../../../shared/vnext/direction.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/vnext/primitives.js";
import { isAllowedVNextRefinementPath } from "../../../shared/vnext/refinement.js";
import { sendKnownHttpError } from "../../http/errors.js";
import { loopbackSecurity } from "../../server/createBalletServer.js";
import { CriticSchedulerService } from "../governance/CriticSchedulerService.js";
import { FeedbackBoxService } from "../governance/FeedbackBoxService.js";
import { GovernanceExecutionService } from "../governance/GovernanceExecutionService.js";
import { RefinementApplyService } from "../governance/RefinementApplyService.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { VNextConnection } from "../persistence/VNextConnection.js";
import { refinementChangeListHash, ReviewStore } from "../persistence/ReviewStore.js";
import { VNextMarkdownRepository } from "../project/VNextMarkdownRepository.js";
import { VNextProjectRepository } from "../project/VNextProjectRepository.js";
import { VNextProjectService } from "../project/VNextProjectService.js";
import { EnvironmentRunPlanner } from "../runtime/EnvironmentRunPlanner.js";
import { EnvironmentRuntimeService } from "../runtime/EnvironmentRuntimeService.js";
import { planContinuationSeed } from "../runtime/ContinuationSeedPlanner.js";
import { DeterministicExecutionQueue } from "../runtime/ExecutionQueueBoundary.js";
import { ScriptedRuntimeProvider } from "../runtime/RuntimeProvider.js";
import { VALID_INSTRUCTION } from "../persistence/PersistenceTestFixtures.js";
import { VNextApiController } from "./VNextApiController.js";
import { createVNextRouter } from "./createVNextRouter.js";
import { VNextInvalidationBroadcaster } from "./VNextInvalidationBroadcaster.js";
import { validVNextProjectConfig, VNEXT_TEST_AT } from "../testing/VNextProjectFixtures.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map((cleanup) => cleanup())); });

describe("vNext HTTP integration", () => {
  test("enforces 76 project, run, feedback, review, routing, and security scenarios", async () => {
    const fixture = await startFixture();
    let scenarios = 0;
    const request = (route: string, init?: RequestInit) => fetch(`${fixture.base}${route}`, init);
    const json = (method: string, body: unknown): RequestInit => ({
      method, headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });

    let response = await request("/project");
    expect(response.status).toBe(200); expect((await response.json() as { config: { version: number } }).config.version).toBe(20); scenarios += 1;

    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: { ...fixture.config, graph: {} } }));
    expect(response.status).toBe(400); scenarios += 1;

    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: { ...fixture.config, version: 19 } }));
    expect(response.status).toBe(400); scenarios += 1;

    const duplicateOrder = structuredClone(fixture.config);
    duplicateOrder.environment.states.push({ ...duplicateOrder.environment.states[0]!, id: "state-duplicate" });
    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: duplicateOrder }));
    expect(response.status).toBe(400); scenarios += 1;

    response = await request("/project", json("PUT", { expectedHash: "f".repeat(64), config: fixture.config }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/project"); const authoringProject = await response.json() as { config: ProjectConfigurationV20 };
    const authored = { ...authoringProject.config, environment: { ...authoringProject.config.environment, description: "Authored" } };
    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: authored }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;

    const forged = structuredClone(authored);
    forged.direction.useCases[0]!.approval!.approvedBy = "forged-body-actor";
    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: forged }));
    expect(response.status).toBe(409); scenarios += 1;

    const draftUseCase = {
      id: "UC-2", name: "Draft Use Case", status: "draft", examples: [{ given: "Draft", when: "Edited", then: "Reviewed" }],
      successGoals: ["Clear"], failureGoals: ["Ambiguous"], expectedOutcomes: ["Approved"],
      goalIds: ["goal-1"], adrIds: ["adr-1"], constraintIds: ["constraint-1"]
    } as const;
    response = await request("/use-cases", json("POST", { expectedConfigHash: fixture.configHash,
      expectedDocumentHash: "absent", markdown: "# Draft Use Case\n", value: draftUseCase }));
    expect(response.status).toBe(201); let authoringHashes = await response.json() as { configHash: string; documentHash: string };
    fixture.configHash = authoringHashes.configHash; scenarios += 1;
    response = await request("/use-cases/UC-2/approve", json("POST", { expectedConfigHash: fixture.configHash }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;
    response = await request("/use-cases/UC-2"); const approvedUseCase = await response.json() as {
      contentHash: string; value: UseCase;
    };
    expect(approvedUseCase.value.approval).toMatchObject({ approvedBy: "trusted-local" });
    response = await request("/use-cases/UC-2", json("PUT", { expectedConfigHash: fixture.configHash,
      expectedDocumentHash: approvedUseCase.contentHash, markdown: "# Draft Use Case\n",
      value: { ...approvedUseCase.value, approval: { ...approvedUseCase.value.approval!, approvedBy: "forged" } } }));
    expect(response.status).toBe(409); scenarios += 1;
    response = await request("/use-cases/UC-2", json("PUT", { expectedConfigHash: fixture.configHash,
      expectedDocumentHash: approvedUseCase.contentHash, markdown: "# Changed Use Case\n",
      value: { ...approvedUseCase.value, name: "Changed Use Case" } }));
    expect(response.status).toBe(200); authoringHashes = await response.json() as { configHash: string; documentHash: string };
    fixture.configHash = authoringHashes.configHash;
    response = await request("/use-cases/UC-2");
    expect((await response.json() as { value: { status: string } }).value.status).toBe("draft"); scenarios += 1;
    response = await request("/use-cases/UC-2", json("DELETE", { expectedConfigHash: fixture.configHash,
      expectedHash: authoringHashes.documentHash }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;

    response = await request("/environment"); const environmentView = await response.json() as {
      environment: ProjectConfigurationV20["environment"];
    };
    const secondState = structuredClone(environmentView.environment.states[0]!);
    secondState.id = "state-2"; secondState.name = "Second"; secondState.order = 2;
    secondState.actions[0]!.id = "action-state-2";
    response = await request("/environment/states", json("POST", { expectedConfigHash: fixture.configHash, state: secondState }));
    expect(response.status).toBe(201); const stateCreatedHash = (await response.json() as { configHash: string }).configHash;
    fixture.configHash = stateCreatedHash; scenarios += 1;
    response = await request("/environment/states/state-2");
    expect(response.status).toBe(200); expect((await response.json() as { state: { id: string } }).state.id).toBe("state-2"); scenarios += 1;
    response = await request("/environment/states", json("POST", { expectedConfigHash: fixture.configHash, state: secondState }));
    expect(response.status).toBe(409); scenarios += 1;
    response = await request("/environment/states/reorder", json("POST", {
      expectedConfigHash: fixture.configHash, orderedIds: ["state-2", "state-1"]
    }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;
    response = await request("/environment/states/reorder", json("POST", {
      expectedConfigHash: stateCreatedHash, orderedIds: ["state-1", "state-2"]
    }));
    expect(response.status).toBe(409); scenarios += 1;
    response = await request("/environment/states/state-2", json("DELETE", { expectedConfigHash: fixture.configHash }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;
    response = await request("/environment/states/missing"); expect(response.status).toBe(404); scenarios += 1;

    response = await request("/environment"); const actionEnvironment = await response.json() as {
      environment: ProjectConfigurationV20["environment"];
    };
    const secondAction = structuredClone(actionEnvironment.environment.states[0]!.actions[0]!);
    secondAction.id = "action-2"; secondAction.name = "Second Action"; secondAction.priority = 2;
    response = await request("/environment/states/state-1/actions", json("POST", {
      expectedConfigHash: fixture.configHash, action: secondAction
    }));
    expect(response.status).toBe(201); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;
    response = await request("/environment/states/state-1/actions/action-2");
    expect(response.status).toBe(200); expect((await response.json() as { action: { id: string } }).action.id).toBe("action-2"); scenarios += 1;
    response = await request("/environment/states/state-1/actions", json("POST", {
      expectedConfigHash: fixture.configHash, action: secondAction
    }));
    expect(response.status).toBe(409); scenarios += 1;
    response = await request("/environment/states/state-1/actions/reprioritize", json("POST", {
      expectedConfigHash: fixture.configHash, orderedIds: ["action-2", "action-1"]
    }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;
    response = await request("/environment/states/state-1/actions/reprioritize", json("POST", {
      expectedConfigHash: fixture.configHash, orderedIds: ["action-1", "action-1"]
    }));
    expect(response.status).toBe(409); scenarios += 1;
    response = await request("/environment/states/state-1/actions/action-2", json("DELETE", { expectedConfigHash: fixture.configHash }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;
    response = await request("/environment/states/state-1/actions/missing"); expect(response.status).toBe(404); scenarios += 1;

    response = await request("/goals"); expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(1); scenarios += 1;

    response = await request("/instructions", json("POST", { id: "extra", expectedHash: "absent", content: VALID_INSTRUCTION }));
    expect(response.status).toBe(201); const extra = await response.json() as { contentHash: string }; scenarios += 1;
    response = await request("/instructions", json("POST", { id: "extra", expectedHash: "absent", content: VALID_INSTRUCTION }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/instructions/extra", json("PUT", { expectedHash: "a".repeat(64), content: `${VALID_INSTRUCTION}\n` }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/instructions/extra", json("PUT", { expectedHash: extra.contentHash, content: `${VALID_INSTRUCTION}\n` }));
    expect(response.status).toBe(200); const updatedExtra = await response.json() as { contentHash: string }; scenarios += 1;

    response = await request("/instructions/instruction", json("DELETE", { expectedHash: fixture.instructionHash }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/instructions/%2E%2E", json("PUT", { expectedHash: "absent", content: "unsafe" }));
    expect([400, 404]).toContain(response.status); scenarios += 1;

    response = await request("/goals", json("POST", {
      expectedConfigHash: fixture.configHash, expectedDocumentHash: "absent", markdown: "# Extra\n",
      value: { id: "goal-extra", name: "Extra", status: "draft" }
    }));
    expect(response.status).toBe(201); const hashes = await response.json() as { configHash: string; documentHash: string };
    fixture.configHash = hashes.configHash; scenarios += 1;
    response = await request("/goals", json("POST", {
      expectedConfigHash: fixture.configHash, expectedDocumentHash: "absent", markdown: "# Extra\n",
      value: { id: "goal-extra", name: "Extra", status: "draft" }
    }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/goals/goal-extra", json("DELETE", {
      expectedConfigHash: fixture.configHash, expectedHash: hashes.documentHash
    }));
    expect(response.status, await response.clone().text()).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;

    response = await request("/goals/goal-1", json("DELETE", {
      expectedConfigHash: fixture.configHash, expectedHash: fixture.goalHash
    }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/use-cases/UC-1/approve", json("POST", { expectedConfigHash: fixture.configHash }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/use-cases/UC-1/return-to-draft", json("POST", { expectedConfigHash: fixture.configHash }));
    expect(response.status, await response.clone().text()).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;

    response = await request("/environment-runs", json("POST", {
      environmentId: "environment-1", expectedConfigHash: fixture.configHash, input: "Human scope"
    }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/use-cases/UC-1/approve", json("POST", {
      expectedConfigHash: fixture.configHash, actor: { id: "forged" }
    }));
    expect(response.status).toBe(400); scenarios += 1;

    response = await request("/use-cases/UC-1/approve", json("POST", { expectedConfigHash: fixture.configHash }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash; scenarios += 1;

    response = await request("/environment-runs", json("POST", {
      environmentId: "environment-1", expectedConfigHash: fixture.configHash, source: "continuation"
    }));
    expect(response.status).toBe(400); scenarios += 1;

    response = await request("/environment/states/state-1/actions/action-1/runs", json("POST", {})); expect(response.status).toBe(404); scenarios += 1;

    commitAll(fixture.root, "vNext authoring baseline");

    response = await request("/environment-runs", json("POST", {
      environmentId: "environment-1", expectedConfigHash: fixture.configHash, input: "Human scope"
    }));
    expect(response.status).toBe(201); const run = await response.json() as { environmentRunId: string }; scenarios += 1;

    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}`); const runDetail = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200); expect(runDetail).not.toHaveProperty("executionSnapshot"); scenarios += 1;

    response = await request("/project"); const activeProject = await response.json() as { config: ProjectConfigurationV20 };
    response = await request("/project", json("PUT", { expectedHash: fixture.configHash,
      config: { ...activeProject.config, environment: { ...activeProject.config.environment, name: "Locked" } } }));
    expect(response.status).toBe(409); scenarios += 1;

    const activeRow = fixture.database().prepare("SELECT status, execution_snapshot_json FROM environment_runs WHERE environment_run_id = ?")
      .get(run.environmentRunId) as { status: string; execution_snapshot_json: string };
    expect(activeRow.status).toBe("running");
    expect((JSON.parse(activeRow.execution_snapshot_json) as { resources: Array<{ id: string }> }).resources)
      .toContainEqual(expect.objectContaining({ id: "instruction" }));
    response = await request("/instructions/instruction", json("PUT", {
      expectedHash: fixture.instructionHash, content: `${VALID_INSTRUCTION}\n`
    }));
    expect(response.status, await response.clone().text()).toBe(409); scenarios += 1;

    await fixture.runtime.processNext();
    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}`);
    const completed = await response.json() as { status: string; input: string; states: Array<{ done: boolean }> };
    expect(completed).toMatchObject({ status: "completed", input: "Human scope" });
    expect(completed.states[0]!.done).toBe(true); scenarios += 1;
    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}/product`);
    expect(response.status).toBe(200); expect(await response.json()).toHaveProperty("result_commit"); scenarios += 1;

    response = await request("/environment-runs", json("POST", {
      environmentId: "environment-1", expectedConfigHash: fixture.configHash
    }));
    const blockedRun = await response.json() as { environmentRunId: string };
    await fixture.runtime.processNext();
    response = await request(`/environment-runs/${encodeURIComponent(blockedRun.environmentRunId)}`);
    expect((await response.json() as { status: string }).status).toBe("blocked");
    expect(fixture.database().prepare("SELECT source FROM feedback_entries WHERE environment_run_id = ?")
      .get(blockedRun.environmentRunId)).toEqual({ source: "validation_blocked" }); scenarios += 1;

    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}/events?after=0`);
    const stream = await response.text(); expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(stream).toContain("event: run-fact"); expect(stream).not.toContain("prompt"); scenarios += 1;

    const feedbackBody = { environmentRunId: run.environmentRunId, category: "product", targetType: "environment_run",
      targetId: run.environmentRunId, title: "Review", description: "Inspect the result", correctiveActions: ["Correct it"] };
    response = await request("/feedback", json("POST", { ...feedbackBody, actor: { id: "forged" } }));
    expect(response.status).toBe(400); scenarios += 1;

    response = await request("/feedback", json("POST", feedbackBody)); expect(response.status).toBe(201);
    const feedback = await response.json() as { feedback_entry_id: string; created_by: string };
    expect(feedback.created_by).toBe("trusted-local"); scenarios += 1;

    response = await request("/feedback", json("POST", { ...feedbackBody, targetId: "missing" }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request(`/feedback?environmentRunId=${encodeURIComponent(run.environmentRunId)}&status=open`);
    expect(response.status).toBe(200); expect(await response.json()).toHaveLength(1); scenarios += 1;
    response = await request("/feedback?status=open");
    expect(response.status).toBe(200); expect((await response.json() as unknown[]).length).toBeGreaterThanOrEqual(2); scenarios += 1;

    response = await request(`/feedback/${encodeURIComponent(feedback.feedback_entry_id)}/decision`, json("POST", { from: "open", decision: "resolved" }));
    expect(response.status).toBe(204); scenarios += 1;

    response = await request(`/feedback/${encodeURIComponent(feedback.feedback_entry_id)}/decision`, json("POST", { from: "open", decision: "dismissed" }));
    expect(response.status).toBe(409); scenarios += 1;

    response = await request("/critic/schedules"); expect(response.status).toBe(200); scenarios += 1;
    response = await request("/critic/reconcile", json("POST", {})); expect(await response.json()).toEqual({ criticRunIds: [] }); scenarios += 1;

    const reviewStore = new ReviewStore(fixture.database);
    reviewStore.createSchedule({ criticScheduleId: "manual", configHash: "a".repeat(64),
      config: { id: "manual", kind: "daily", timeZone: "UTC", localTimes: ["10:00"] },
      nextDueAt: VNEXT_TEST_AT, enabled: true, createdAt: VNEXT_TEST_AT });
    reviewStore.createCriticDue({ criticRunId: "critic-run-manual", criticScheduleId: "manual",
      dueAt: VNEXT_TEST_AT, dueKey: "manual:due", skipReason: "no_product_snapshot", createdAt: VNEXT_TEST_AT });
    const criticContent = { proposalId: "critic-proposal-manual", summary: "Improve product feedback" };
    const criticHash = hash(criticContent);
    reviewStore.createCriticProposal({ criticProposalId: "critic-proposal-manual", criticRunId: "critic-run-manual",
      content: criticContent, contentHash: criticHash, targetType: "environment_run", targetId: run.environmentRunId,
      category: "product", createdAt: VNEXT_TEST_AT });
    response = await request("/critic/proposals/critic-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: "f".repeat(64), expectedVersion: 1,
      feedback: { feedbackEntryId: "critic-feedback", environmentRunId: run.environmentRunId,
        title: "Critic feedback", description: "Approved feedback", correctiveActions: ["Improve"] }
    }));
    expect(response.status).toBe(409); scenarios += 1;
    response = await request("/critic/proposals/critic-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: criticHash, expectedVersion: 1,
      feedback: { feedbackEntryId: "critic-feedback", environmentRunId: run.environmentRunId,
        title: "Critic feedback", description: "Approved feedback", correctiveActions: ["Improve"] }
    }));
    expect(response.status).toBe(204);
    expect(fixture.database().prepare("SELECT created_by FROM feedback_entries WHERE feedback_entry_id = 'critic-feedback'").get())
      .toEqual({ created_by: "trusted-local" }); scenarios += 1;

    response = await request("/feedback", json("POST", { ...feedbackBody, title: "Refine" }));
    const openFeedback = await response.json() as { feedback_entry_id: string };
    response = await request("/refinement/runs", json("POST", {
      sourceEnvironmentRunId: run.environmentRunId, feedbackEntryIds: [openFeedback.feedback_entry_id]
    }));
    expect(response.status).toBe(201); const refinement = await response.json() as { refinementRunId: string; taskId: string };
    expect(refinement).toHaveProperty("taskId"); scenarios += 1;

    const refinedInstruction = `${VALID_INSTRUCTION}\n\nRefined guidance.\n`;
    const refinementBase = {
      refinementProposalId: "refinement-proposal-manual", refinementRunId: refinement.refinementRunId,
      targetActionId: "action-1", expectedBaseCommit: String(runDetail.baseCommit),
      impactScope: { actionIds: ["action-1"] }, changeListHash: "",
      expectedBehavioralImprovement: "More exact instruction", risks: ["Prompt behavior changes"],
      validationPlan: ["instruction_contract" as const], rollback: "Discard the local branch.",
      files: [{ operation: "replace" as const, relativePath: ".ballet/vnext/instructions/instruction.md",
        expectedPreimageHash: fixture.instructionHash, proposedContentHash: sha256(refinedInstruction),
        proposedContent: refinedInstruction, rationale: "Improve Action guidance", resourceId: "instruction" }],
      createdAt: VNEXT_TEST_AT
    };
    reviewStore.createRefinementProposal({ ...refinementBase, changeListHash: refinementChangeListHash(refinementBase) });
    response = await request("/refinement/proposals/refinement-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: refinementChangeListHash(refinementBase), expectedVersion: 1,
      expectedChangeHashes: ["f".repeat(64)], expectedImpactActionIds: ["action-1"],
      acknowledgeLocalCommitAndContinuation: true
    }));
    expect(response.status).toBe(409); scenarios += 1;
    response = await request("/refinement/proposals/refinement-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: refinementChangeListHash(refinementBase), expectedVersion: 1,
      expectedChangeHashes: [sha256(refinedInstruction)], expectedImpactActionIds: ["action-1"],
      acknowledgeLocalCommitAndContinuation: true
    }));
    expect(response.status).toBe(204); scenarios += 1;
    response = await request("/refinement/proposals/refinement-proposal-manual/apply", json("POST", {}));
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toEqual({ status: "applied" }); scenarios += 1;
    response = await request("/refinement/proposals/refinement-proposal-manual/apply");
    expect(response.status).toBe(200); expect(await response.json()).toHaveProperty("commit_sha"); scenarios += 1;
    response = await request("/refinement/proposals/refinement-proposal-manual/continuation");
    expect(response.status).toBe(200); const continuation = await response.json() as { continuation_run_id: string };
    const continuationRow = fixture.database().prepare(
      "SELECT execution_snapshot_json FROM environment_runs WHERE environment_run_id = ?"
    ).get(continuation.continuation_run_id) as { execution_snapshot_json: string };
    const continuationSnapshot = JSON.parse(continuationRow.execution_snapshot_json) as {
      resources: Array<{ id: string; sourceSha256: string }>;
    };
    expect(continuationSnapshot.resources).toContainEqual(expect.objectContaining({
      id: "instruction", sourceSha256: sha256(refinedInstruction)
    })); scenarios += 1;
    response = await request("/refinement/proposals/refinement-proposal-manual/apply", json("POST", {
      patch: [{ path: "../unsafe", content: "forged" }]
    }));
    expect(response.status).toBe(400); scenarios += 1;

    response = await request("/refinement/proposals"); expect(response.status).toBe(200); scenarios += 1;
    response = await request("/does-not-exist"); expect(response.status).toBe(404); scenarios += 1;
    response = await request("/events?after=0"); const invalidations = await response.text();
    expect(invalidations).toContain("project_changed"); expect(invalidations).not.toContain("prompt"); scenarios += 1;

    response = await fetch(`${fixture.base}/project`, { method: "PUT", headers: {
      origin: "https://attacker.invalid", "content-type": "application/json"
    }, body: "{}" });
    expect(response.status).toBe(403); scenarios += 1;

    response = await request("/project", { method: "PUT", headers: { "content-type": "application/json" }, body: `{"padding":"${"x".repeat(1_100_000)}"}` });
    expect(response.status).toBe(413); scenarios += 1;

    response = await request("/instructions/extra", json("DELETE", { expectedHash: updatedExtra.contentHash }));
    expect(response.status).toBe(204); scenarios += 1;
    expect(scenarios).toBe(76);
  });
});

const startFixture = async () => {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-vnext-http-"));
  mkdirSync(path.join(root, ".ballet"), { recursive: true });
  writeFileSync(path.join(root, "README.md"), "fixture\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], { cwd: root });
  const stateDirectory = mkdtempSync(path.join(tmpdir(), "ballet-vnext-http-state-"));
  const manager = new VNextConnection(path.join(stateDirectory, "state.sqlite"));
  const connection = () => manager.connection(); connection();
  const projects = new VNextProjectRepository(path.join(root, ".ballet", "vnext", "project.json"), connection);
  const documents = new VNextMarkdownRepository(path.join(root, ".ballet", "vnext"), connection);
  const config = validVNextProjectConfig();
  let configHash = projects.save(config, "absent").configHash;
  const goalHash = documents.put("goal", "goal-1", "# Goal 1\n", "absent").contentHash;
  documents.put("adr", "adr-1", "# ADR 1\n", "absent");
  documents.put("constraint", "constraint-1", "# Constraint 1\n", "absent");
  documents.put("use-case", "UC-1", "# Use Case 1\n", "absent");
  const instructionHash = documents.put("instruction", "instruction", VALID_INSTRUCTION, "absent").contentHash;
  const project = new VNextProjectService(root, projects, documents);
  const capability = {
    executionProfileId: "profile", provider: "codex" as const, cliVersion: "1.0.0",
    supportedModels: ["model"], supportedReasoningEfforts: ["high"],
    supportsReadOnly: true, supportsWorkspaceWrite: true
  };
  const planner = new EnvironmentRunPlanner(project, { inspect: async () => ({ ...capability, capabilitySha256: hash(capability) }) }, () => VNEXT_TEST_AT);
  const environmentQueue = new DeterministicExecutionQueue();
  const provider = new ScriptedRuntimeProvider([
    providerOutput({ phase: "precheck", decision: "done", evidence: {} }),
    providerOutput({ phase: "precheck", decision: "blocked", reason: "Needs correction",
      correctiveActions: ["Correct input"], evidence: {} })
  ]);
  let sequence = 0; const nextId = (kind: string) => `${kind}-${++sequence}`;
  const runtime = new EnvironmentRuntimeService(connection, environmentQueue, provider, {
    finalize: async (run, at) => ({ productSnapshotId: nextId("product"), environmentRunId: run.environmentRunId,
      branch: run.branch, worktreePath: run.worktreePath, baseCommit: run.baseCommit, resultCommit: run.baseCommit,
      changedFiles: [], artifactRefs: [], resourceHashes: {}, definitionHashes: {},
      validationSummary: { status: "passed" }, createdAt: at })
  }, nextId, () => VNEXT_TEST_AT);
  const feedbackService = new FeedbackBoxService(connection);
  const scheduler = new CriticSchedulerService(connection, { now: () => VNEXT_TEST_AT }, nextId);
  const governance = new GovernanceExecutionService(
    connection, new DeterministicExecutionQueue(), nextId, () => VNEXT_TEST_AT,
    { prepareReadOnly: async (_taskId, _commit, fallback) => fallback, releaseReadOnly: async () => undefined },
    isAllowedVNextRefinementPath
  );
  const refinementWorktrees = mkdtempSync(path.join(tmpdir(), "ballet-vnext-refinement-http-"));
  const refinementApply = new RefinementApplyService(connection, root, refinementWorktrees, { run: async () => undefined },
    async ({ refinementProposalId, refinementApplyId, commitSha }) => {
      const reviews = new ReviewStore(connection); const proposal = reviews.requireRefinementProposal(refinementProposalId);
      const source = connection().prepare("SELECT source_environment_run_id FROM refinement_runs WHERE refinement_run_id = ?")
        .get(String(proposal.refinement_run_id)) as { source_environment_run_id: string };
      const runs = new EnvironmentRunStore(connection); const parent = runs.require(source.source_environment_run_id);
      const worktreePath = path.join(refinementWorktrees, refinementApplyId.replace(/[^a-zA-Z0-9._-]/g, "-"));
      const worktreeProject = new VNextProjectService(worktreePath,
        new VNextProjectRepository(path.join(worktreePath, ".ballet", "vnext", "project.json"), connection),
        new VNextMarkdownRepository(path.join(worktreePath, ".ballet", "vnext"), connection));
      const replanned = await new EnvironmentRunPlanner(worktreeProject,
        { inspect: async () => ({ ...capability, capabilitySha256: hash(capability) }) }, () => VNEXT_TEST_AT).plan();
      const continuationRunId = nextId("environment-run");
      const planned = replanned.createInput({ environmentRunId: continuationRunId, worktreePath,
        branch: `ballet/refinement/${refinementProposalId}`, createdAt: VNEXT_TEST_AT, input: parent.input });
      const parentActions = runs.states(parent.environmentRunId).flatMap(({ stateExecutionId }) => runs.actions(stateExecutionId));
      const impact = JSON.parse(String(proposal.impact_scope_json)) as { actionIds: string[] };
      const seed = planContinuationSeed({ parent, parentActions, planned, targetActionId: String(proposal.target_action_id),
        impactActionIds: impact.actionIds, refinementProposalId,
        refinementApprovalId: `${refinementProposalId}:decision`, refinementCommitSha: commitSha });
      return { ...seed, continuationLinkId: nextId("continuation-link"), continuationSnapshotHash: seed.executionSnapshotHash };
    }, () => VNEXT_TEST_AT, isAllowedVNextRefinementPath);
  const controller = new VNextApiController({ connection, project, planner, runtime,
    workspace: { prepare: async (runId) => ({ worktreePath: root, branch: `test/${runId}` }), discard: async () => undefined },
    feedback: feedbackService, scheduler, governance, refinementApply,
    invalidations: new VNextInvalidationBroadcaster(), nextId, now: () => VNEXT_TEST_AT });
  const app = express(); app.disable("x-powered-by"); app.use(loopbackSecurity(4317)); app.use(express.json({ limit: "1mb" }));
  app.use("/api/vnext", createVNextRouter({ controller, actor: () => ({ id: "trusted-local", source: "request_context" }) }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next; if (!sendKnownHttpError(error, res)) res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected" });
  });
  const server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Expected port.");
  cleanups.push(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve())); manager.close();
    rmSync(root, { recursive: true, force: true }); rmSync(stateDirectory, { recursive: true, force: true });
    rmSync(refinementWorktrees, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${address.port}/api/vnext`, root, config, get configHash() { return configHash; },
    set configHash(value: string) { configHash = value; }, goalHash, instructionHash, database: connection, runtime };
};

const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue));
const commitAll = (root: string, message: string): void => {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", message], { cwd: root });
};
const providerOutput = (result: Record<string, unknown>) => ({
  kind: "output" as const, providerOutcomeKey: `provider:${String(result.decision)}`,
  raw: JSON.stringify({ version: 10, role: "validation", summary: "Validated", checks: [], result })
});
