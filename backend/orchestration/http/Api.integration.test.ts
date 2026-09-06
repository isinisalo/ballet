/* eslint-disable max-lines, max-lines-per-function -- One ordered fixture exercises the complete optimistic HTTP lifecycle without cross-test state cloning. */
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { afterEach, describe, expect, test } from "vitest";
import { actionAgentId, type ActionAgentDefinition, type ProjectConfigurationV26 } from "../../../shared/orchestration/environment.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import { isAllowedRefinementPath } from "../../../shared/orchestration/refinement.js";
import { sendKnownHttpError } from "../../http/errors.js";
import { loopbackSecurity } from "../../server/createBalletServer.js";
import { CriticSchedulerService } from "../governance/CriticSchedulerService.js";
import { FeedbackBoxService } from "../governance/FeedbackBoxService.js";
import { GovernanceExecutionService } from "../governance/GovernanceExecutionService.js";
import { RefinementApplyService } from "../governance/RefinementApplyService.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { LocalDatabase } from "../persistence/LocalDatabase.js";
import { refinementChangeListHash, ReviewStore } from "../persistence/ReviewStore.js";
import { ProjectDocumentRepository } from "../project/ProjectDocumentRepository.js";
import { ProjectConfigurationRepository } from "../project/ProjectConfigurationRepository.js";
import { ProjectDefinitionService } from "../project/ProjectDefinitionService.js";
import { EnvironmentRunPlanner } from "../runtime/EnvironmentRunPlanner.js";
import { EnvironmentRuntimeService } from "../runtime/EnvironmentRuntimeService.js";
import { planContinuationSeed } from "../runtime/ContinuationSeedPlanner.js";
import { DeterministicExecutionQueue } from "../runtime/ExecutionQueueBoundary.js";
import { ScriptedRuntimeProvider } from "../runtime/RuntimeProvider.js";
import { VALID_INSTRUCTION } from "../persistence/PersistenceTestFixtures.js";
import { ApiController } from "./ApiController.js";
import { createOrchestrationRouter } from "./createOrchestrationRouter.js";
import { InvalidationBroadcaster } from "./InvalidationBroadcaster.js";
import { validProjectConfig, TEST_AT } from "../testing/ProjectFixtures.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map((cleanup) => cleanup())); });

describe("orchestration HTTP integration", () => {
  test("enforces 83 project, run, feedback, review, routing, and security scenarios", async () => {
    const fixture = await startFixture();
    const request = (route: string, init?: RequestInit) => fetch(`${fixture.base}${route}`, init);
    const json = (method: string, body: unknown): RequestInit => ({
      method, headers: { "content-type": "application/json", origin: "http://127.0.0.1:4317",
        "sec-fetch-site": "same-origin" }, body: JSON.stringify(body)
    });

    let response = await request("/project");
    expect(response.status).toBe(200); expect((await response.json() as { config: { version: number } }).config.version).toBe(26);

    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: { ...fixture.config, graph: {} } }));
    expect(response.status).toBe(400);

    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: { ...fixture.config, version: 19 } }));
    expect(response.status).toBe(400);

    const duplicateOrder = structuredClone(fixture.config);
    duplicateOrder.environment.states.push({ ...duplicateOrder.environment.states[0]!, id: "state-duplicate" });
    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: duplicateOrder }));
    expect(response.status).toBe(400);

    response = await request("/project", json("PUT", { expectedHash: "f".repeat(64), config: fixture.config }));
    expect(response.status).toBe(409);

    response = await request("/project"); const authoringProject = await response.json() as { config: ProjectConfigurationV26 };
    const authored = { ...authoringProject.config, environment: { ...authoringProject.config.environment, description: "Authored" } };
    response = await request("/environment", json("PUT", { expectedConfigHash: fixture.configHash, environment: authored.environment }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash;

    response = await request("/project", json("PUT", { expectedHash: fixture.configHash, config: { ...authored, direction: {} } }));
    expect(response.status).toBe(400);

    response = await request("/environment"); const environmentView = await response.json() as {
      environment: ProjectConfigurationV26["environment"];
    };
    const secondState = structuredClone(environmentView.environment.states[0]!);
    secondState.id = "state-2"; secondState.name = "Second"; secondState.order = 2;
    secondState.actions[0]!.id = "action-state-2";
    secondState.actions[0]!.validation.agentId = actionAgentId("action-state-2", "validation");
    secondState.actions[0]!.work.agentId = actionAgentId("action-state-2", "work");
    response = await request("/environment/states", json("POST", { expectedConfigHash: fixture.configHash, state: secondState }));
    expect(response.status).toBe(201); const stateCreatedHash = (await response.json() as { configHash: string }).configHash;
    fixture.configHash = stateCreatedHash;
    response = await request("/environment/states/state-2");
    expect(response.status).toBe(200); expect((await response.json() as { state: { id: string } }).state.id).toBe("state-2");
    response = await request("/environment/states", json("POST", { expectedConfigHash: fixture.configHash, state: secondState }));
    expect(response.status).toBe(409);
    response = await request("/environment/states/reorder", json("POST", {
      expectedConfigHash: fixture.configHash, orderedIds: ["state-2", "state-1"]
    }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash;
    response = await request("/environment/states/reorder", json("POST", {
      expectedConfigHash: stateCreatedHash, orderedIds: ["state-1", "state-2"]
    }));
    expect(response.status).toBe(409);
    response = await request("/environment/states/state-2", json("DELETE", { expectedConfigHash: fixture.configHash }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash;
    response = await request("/environment/states/missing"); expect(response.status).toBe(404);

    response = await request("/environment"); const actionEnvironment = await response.json() as {
      environment: ProjectConfigurationV26["environment"];
    };
    const secondAction = structuredClone(actionEnvironment.environment.states[0]!.actions[0]!);
    secondAction.id = "action-2"; secondAction.name = "Second Action"; secondAction.priority = 2;
    secondAction.validation.agentId = actionAgentId("action-2", "validation");
    secondAction.work.agentId = actionAgentId("action-2", "work");
    response = await request("/environment/states/state-1/actions", json("POST", {
      expectedConfigHash: fixture.configHash, action: secondAction
    }));
    expect(response.status).toBe(201); fixture.configHash = (await response.json() as { configHash: string }).configHash;
    response = await request("/environment/states/state-1/actions/action-2");
    expect(response.status).toBe(200); expect((await response.json() as { action: { id: string } }).action.id).toBe("action-2");
    response = await request("/environment/states/state-1/actions", json("POST", {
      expectedConfigHash: fixture.configHash, action: secondAction
    }));
    expect(response.status).toBe(409);
    response = await request("/environment/states/state-1/actions/reprioritize", json("POST", {
      expectedConfigHash: fixture.configHash, orderedIds: ["action-2", "action-1"]
    }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash;
    response = await request("/environment/states/state-1/actions/reprioritize", json("POST", {
      expectedConfigHash: fixture.configHash, orderedIds: ["action-1", "action-1"]
    }));
    expect(response.status).toBe(409);
    response = await request("/environment/states/state-1/actions/action-2", json("DELETE", { expectedConfigHash: fixture.configHash }));
    expect(response.status).toBe(200); fixture.configHash = (await response.json() as { configHash: string }).configHash;
    response = await request("/environment/states/state-1/actions/missing"); expect(response.status).toBe(404);

    response = await request("/adrs"); expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(1);

    response = await request("/instructions", json("POST", { id: "extra", expectedHash: "absent", content: VALID_INSTRUCTION }));
    expect(response.status).toBe(201); const extra = await response.json() as { contentHash: string };
    response = await request("/instructions", json("POST", { id: "extra", expectedHash: "absent", content: VALID_INSTRUCTION }));
    expect(response.status).toBe(409);

    response = await request("/instructions/extra", json("PUT", { expectedHash: "a".repeat(64), content: `${VALID_INSTRUCTION}\n` }));
    expect(response.status).toBe(409);

    response = await request("/instructions/extra", json("PUT", { expectedHash: extra.contentHash, content: `${VALID_INSTRUCTION}\n` }));
    expect(response.status).toBe(200); const updatedExtra = await response.json() as { contentHash: string };

    response = await request("/instructions/instruction", json("DELETE", { expectedHash: fixture.instructionHash }));
    expect(response.status).toBe(204);

    response = await request("/instructions/%2E%2E", json("PUT", { expectedHash: "absent", content: "unsafe" }));
    expect([400, 404]).toContain(response.status);

    response = await request("/agents");
    const agents = await response.json() as { configHash: string; agents: Array<{ id: string; status: string; contentHash: string }> };
    expect(response.status).toBe(200); expect(agents.agents.map(({ id }) => id)).toEqual([
      "ballet-critic-agent", "ballet-refinement-agent"
    ]);
    response = await request("/agents/ballet-critic-agent");
    const critic = await response.json() as { status: string; contentHash: string; agent: { model: string } };
    expect(response.status).toBe(200); expect(critic).toMatchObject({ status: "ready", agent: { model: "gpt-5.6-sol" } });
    response = await request("/agents", json("POST", {})); expect(response.status).toBe(404);
    response = await request("/agents/ballet-critic-agent", json("DELETE", {})); expect(response.status).toBe(404);
    response = await request("/agents/ballet-critic-agent/execution"); expect(response.status).toBe(404);
    response = await request("/agents/ballet-critic-agent/execution", json("PUT", {})); expect(response.status).toBe(404);
    response = await request("/agents/ballet-critic-agent", json("PUT", {
      expectedConfigHash: agents.configHash, expectedDocumentHash: critic.contentHash,
      developerInstructions: "Inspect immutable evidence and propose only.", model: "gpt-5.6-sol",
      reasoningEffort: "low", skillResources: []
    }));
    expect(response.status, await response.clone().text()).toBe(200);
    fixture.configHash = (await response.json() as { configHash: string }).configHash;

    for (const removed of ["goals", "constraints", "use-cases"]) {
      for (const method of ["GET", "POST", "PUT", "DELETE"]) {
        expect((await request(`/${removed}`, method === "GET" ? undefined : json(method, {}))).status).toBe(404);
        expect((await request(`/${removed}/old-id`, method === "GET" ? undefined : json(method, {}))).status).toBe(404);
      }
      expect((await request(`/${removed}/old-id/approve`, json("POST", {}))).status).toBe(404);
    }

    response = await request("/overview"); expect(response.status).toBe(200);
    const overview = await response.json() as { content: string; contentHash: string };
    const overviewSource = "# Project\n\n## Purpose\nFor operators.\n\n## Outcomes\nAuditable work.\n\n## Scope\nLocal.\n\n## Shared requirements\nExact human approval.\n";
    response = await request("/overview", json("PUT", { content: overviewSource, expectedHash: overview.contentHash }));
    expect(response.status).toBe(200); const savedOverview = await response.json() as { contentHash: string };
    expect(await (await request("/overview")).json()).toMatchObject({ content: overviewSource, contentHash: savedOverview.contentHash });
    expect((await request("/overview", json("PUT", { content: "overwrite", expectedHash: overview.contentHash }))).status).toBe(409);
    expect((await request("/overview", json("PUT", { content: overviewSource, expectedHash: savedOverview.contentHash, actor: "agent" }))).status).toBe(400);
    expect((await (await request("/project")).json() as { configHash: string }).configHash).toBe(fixture.configHash);
    const adrContent = "---\nid: adr-extra\ntitle: Extra decision\nstatus: draft\n---\n\n# Context\nOne file only.\n";
    response = await request("/adrs", json("POST", { id: "adr-extra", content: adrContent, expectedHash: "absent" })); expect(response.status).toBe(201);
    const adr = await response.json() as { contentHash: string };
    expect(await (await request("/adrs/adr-extra")).json()).toMatchObject({ content: adrContent });
    expect((await request("/adrs/adr-extra", json("DELETE", { expectedHash: "f".repeat(64) }))).status).toBe(409);
    expect((await request("/adrs/adr-extra", json("DELETE", { expectedHash: adr.contentHash }))).status).toBe(204);

    response = await request("/environment-runs", json("POST", {
      environmentId: "environment-1", expectedConfigHash: fixture.configHash, source: "continuation"
    }));
    expect(response.status).toBe(400);

    response = await request("/environment/states/state-1/actions/action-1/runs", json("POST", {})); expect(response.status).toBe(404);

    commitAll(fixture.root, "canonical authoring baseline");

    response = await request("/environment-runs", json("POST", {
      environmentId: "environment-1", expectedConfigHash: fixture.configHash, input: "Human scope"
    }));
    expect(response.status).toBe(201); const run = await response.json() as { environmentRunId: string };

    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}`); const runDetail = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200); expect(runDetail).not.toHaveProperty("executionSnapshot");

    response = await request("/project"); const activeProject = await response.json() as { config: ProjectConfigurationV26 };
    response = await request("/project", json("PUT", { expectedHash: fixture.configHash,
      config: { ...activeProject.config, environment: { ...activeProject.config.environment, name: "Locked" } } }));
    expect(response.status).toBe(409);

    const activeRow = fixture.database().prepare("SELECT status, execution_snapshot_json FROM environment_runs WHERE environment_run_id = ?")
      .get(run.environmentRunId) as { status: string; execution_snapshot_json: string };
    expect(activeRow.status).toBe("running");
    expect((JSON.parse(activeRow.execution_snapshot_json) as { actionAgents: unknown[] }).actionAgents).toHaveLength(2);
    response = await request("/instructions/extra", json("PUT", {
      expectedHash: updatedExtra.contentHash, content: `${VALID_INSTRUCTION}\n\nupdated\n`
    }));
    expect(response.status, await response.clone().text()).toBe(200);
    const latestExtra = await response.json() as { contentHash: string };

    await fixture.runtime.processNext();
    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}`);
    const completed = await response.json() as { status: string; input: string; states: Array<{ done: boolean }> };
    expect(completed).toMatchObject({ status: "completed", input: "Human scope" });
    expect(completed.states[0]!.done).toBe(true);
    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}/evidence`);
    expect(response.status).toBe(200); expect(await response.json()).toHaveProperty("result_commit");

    response = await request("/environment-runs", json("POST", {
      environmentId: "environment-1", expectedConfigHash: fixture.configHash
    }));
    const blockedRun = await response.json() as { environmentRunId: string };
    await fixture.runtime.processNext();
    response = await request(`/environment-runs/${encodeURIComponent(blockedRun.environmentRunId)}`);
    expect((await response.json() as { status: string }).status).toBe("blocked");
    expect(fixture.database().prepare("SELECT source FROM feedback_entries WHERE environment_run_id = ?")
      .get(blockedRun.environmentRunId)).toEqual({ source: "validation_blocked" });

    response = await request(`/environment-runs/${encodeURIComponent(run.environmentRunId)}/events?after=0`);
    const stream = await response.text(); expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(stream).toContain("event: run-fact"); expect(stream).not.toContain("prompt");

    const feedbackBody = { category: "documentation", comment: "Inspect the result and correct it." };
    response = await request("/feedback", json("POST", { ...feedbackBody, actor: { id: "forged" } }));
    expect(response.status).toBe(400);

    response = await request("/feedback", json("POST", feedbackBody)); expect(response.status).toBe(201);
    const feedback = await response.json() as { feedback_entry_id: string; created_by: string };
    expect(feedback.created_by).toBe("trusted-local");

    response = await request("/feedback", json("POST", { ...feedbackBody, targetId: "missing" }));
    expect(response.status).toBe(400);

    response = await request(`/feedback?environmentRunId=${encodeURIComponent(blockedRun.environmentRunId)}&status=open`);
    expect(response.status).toBe(200); expect(await response.json()).toHaveLength(2);
    response = await request("/feedback?status=open");
    expect(response.status).toBe(200); expect((await response.json() as unknown[]).length).toBeGreaterThanOrEqual(2);

    response = await request(`/feedback/${encodeURIComponent(feedback.feedback_entry_id)}/decision`, json("POST", { from: "open", decision: "resolved" }));
    expect(response.status).toBe(204);

    response = await request(`/feedback/${encodeURIComponent(feedback.feedback_entry_id)}/decision`, json("POST", { from: "open", decision: "dismissed" }));
    expect(response.status).toBe(409);

    response = await request("/critic/schedules"); expect(response.status).toBe(200);
    response = await request("/critic/reconcile", json("POST", {})); expect(await response.json()).toEqual({ criticRunIds: [] });

    const reviewStore = new ReviewStore(fixture.database);
    reviewStore.createSchedule({ criticScheduleId: "manual", configHash: "a".repeat(64),
      config: { id: "manual", kind: "daily", timeZone: "UTC", localTimes: ["10:00"] },
      nextDueAt: TEST_AT, enabled: true, createdAt: TEST_AT });
    const runEvidence = fixture.database().prepare(
      "SELECT run_evidence_id FROM run_evidences WHERE environment_run_id = ?"
    ).get(run.environmentRunId) as { run_evidence_id: string };
    reviewStore.createCriticDue({ criticRunId: "critic-run-manual", criticScheduleId: "manual",
      dueAt: TEST_AT, dueKey: "manual:due", runEvidenceId: runEvidence.run_evidence_id, createdAt: TEST_AT });
    const criticContent = { proposalId: "critic-proposal-manual", title: "Evidence feedback", finding: "Improve evidence feedback", severity: "high" };
    const criticHash = hash(criticContent);
    reviewStore.createCriticProposal({ criticProposalId: "critic-proposal-manual", criticRunId: "critic-run-manual",
      content: criticContent, contentHash: criticHash, targetType: "environment_run", targetId: run.environmentRunId,
      category: "system", createdAt: TEST_AT });
    response = await request("/critic/proposals");
    expect((await response.json() as Array<{ title: string; finding: string; severity: string }>)[0]).toMatchObject({ title: criticContent.title, finding: criticContent.finding, severity: "high" });
    response = await request("/critic/proposals/critic-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: "f".repeat(64), expectedVersion: 2
    }));
    expect(response.status).toBe(409);
    response = await request("/critic/proposals/critic-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: criticHash, expectedVersion: 2
    }));
    expect(response.status).toBe(204);
    expect(fixture.database().prepare("SELECT created_by FROM feedback_entries WHERE critic_proposal_id = 'critic-proposal-manual'").get())
      .toEqual({ created_by: "trusted-local" });

    response = await request("/feedback", json("POST", { category: "code", comment: "Refine the Action instruction." }));
    const openFeedback = await response.json() as { feedback_entry_id: string };
    response = await request(`/feedback/${encodeURIComponent(openFeedback.feedback_entry_id)}/refinement`, json("POST", {}));
    expect(response.status).toBe(201); const refinement = await response.json() as { refinementRunId: string; taskId: string };
    expect(refinement).toHaveProperty("taskId");

    const refinedInstruction = fixture.actionAgentSource.replace("validation action-1 exact instructions", "validation action-1 refined exact instructions");
    const refinementBase = {
      refinementProposalId: "refinement-proposal-manual", refinementRunId: refinement.refinementRunId,
      targetActionId: "action-1", expectedBaseCommit: String(runDetail.baseCommit),
      impactScope: { actionIds: ["action-1"] }, changeListHash: "",
      expectedBehavioralImprovement: "More exact instruction", risks: ["Prompt behavior changes"],
      validationPlan: ["instruction_contract" as const], rollback: "Discard the local branch.",
      files: [{ operation: "replace" as const, relativePath: ".codex/agents/ballet-action-validation-action-1.toml",
        expectedPreimageHash: fixture.actionAgentHash, proposedContentHash: sha256(refinedInstruction),
        proposedContent: refinedInstruction, rationale: "Improve Action guidance", resourceId: "ballet-action-validation-action-1" }],
      createdAt: TEST_AT
    };
    reviewStore.createRefinementProposal({ ...refinementBase, changeListHash: refinementChangeListHash(refinementBase) });
    response = await request("/refinement/proposals/refinement-proposal-manual");
    expect(response.status).toBe(200);
    expect((await response.json() as { files: Array<{ preimage_content: string }> }).files[0]!.preimage_content).toBe(fixture.actionAgentSource);
    fixture.database().prepare("UPDATE refinement_proposal_files SET expected_preimage_hash = ? WHERE refinement_proposal_id = ?")
      .run("0".repeat(64), refinementBase.refinementProposalId);
    response = await request("/refinement/proposals/refinement-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: refinementChangeListHash(refinementBase), expectedVersion: 2,
      expectedChangeHashes: [sha256(refinedInstruction)], expectedImpactActionIds: ["action-1"],
      acknowledgeLocalCommitAndContinuation: true
    }));
    expect(response.status).toBe(409);
    expect(reviewStore.requireRefinementProposal(refinementBase.refinementProposalId).status).toBe("pending_human_review");
    fixture.database().prepare("UPDATE refinement_proposal_files SET expected_preimage_hash = ? WHERE refinement_proposal_id = ?")
      .run(fixture.actionAgentHash, refinementBase.refinementProposalId);


    response = await request("/refinement/proposals/refinement-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: refinementChangeListHash(refinementBase), expectedVersion: 2,
      expectedChangeHashes: ["f".repeat(64)], expectedImpactActionIds: ["action-1"],
      acknowledgeLocalCommitAndContinuation: true
    }));
    expect(response.status).toBe(409);
    response = await request("/refinement/proposals/refinement-proposal-manual/decision", json("POST", {
      decision: "approved", expectedContentHash: refinementChangeListHash(refinementBase), expectedVersion: 2,
      expectedChangeHashes: [sha256(refinedInstruction)], expectedImpactActionIds: ["action-1"],
      acknowledgeLocalCommitAndContinuation: true
    }));
    expect(response.status).toBe(204);
    response = await request("/refinement/proposals/refinement-proposal-manual/apply", json("POST", {}));
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toEqual({ status: "applied" });
    response = await request("/refinement/proposals/refinement-proposal-manual/apply");
    expect(response.status).toBe(200); expect(await response.json()).toHaveProperty("commit_sha");
    response = await request("/refinement/proposals/refinement-proposal-manual/continuation");
    expect(response.status).toBe(200); const continuation = await response.json() as { continuation_run_id: string };
    const continuationRow = fixture.database().prepare(
      "SELECT execution_snapshot_json FROM environment_runs WHERE environment_run_id = ?"
    ).get(continuation.continuation_run_id) as { execution_snapshot_json: string };
    const continuationSnapshot = JSON.parse(continuationRow.execution_snapshot_json) as {
      actionAgents: Array<{ id: string; contentSha256: string }>;
    };
    expect(continuationSnapshot.actionAgents).toContainEqual(expect.objectContaining({
      id: "ballet-action-validation-action-1", contentSha256: sha256(refinedInstruction)
    }));
    response = await request("/refinement/proposals/refinement-proposal-manual/apply", json("POST", {
      patch: [{ path: "../unsafe", content: "forged" }]
    }));
    expect(response.status).toBe(400);

    response = await request("/refinement/proposals"); expect(response.status).toBe(200);
    response = await request("/does-not-exist"); expect(response.status).toBe(404);
    const eventAbort = new AbortController();
    response = await request("/events?after=0", { signal: eventAbort.signal });
    const eventChunk = await response.body!.getReader().read(); eventAbort.abort();
    const invalidations = new TextDecoder().decode(eventChunk.value);
    expect(invalidations).toContain("project_changed"); expect(invalidations).not.toContain("prompt");

    response = await fetch(`${fixture.base}/project`, { method: "PUT", headers: {
      origin: "https://attacker.invalid", "content-type": "application/json"
    }, body: "{}" });
    expect(response.status).toBe(403);

    response = await fetch(`${fixture.base}/project`, { method: "PUT", headers: {
      "content-type": "application/json"
    }, body: "{}" });
    expect(response.status).toBe(403);

    response = await request("/project", { method: "PUT", headers: {
      "content-type": "application/json", origin: "http://127.0.0.1:4317"
    }, body: `{"padding":"${"x".repeat(1_100_000)}"}` });
    expect(response.status).toBe(413);

    response = await request("/instructions/extra", json("DELETE", { expectedHash: latestExtra.contentHash }));
    expect(response.status).toBe(204);
  });
});

const startFixture = async () => {
  const root = mkdtempSync(path.join(tmpdir(), "ballet-orchestration-http-"));
  mkdirSync(path.join(root, ".ballet"), { recursive: true });
  mkdirSync(path.join(root, ".codex", "agents"), { recursive: true });
  writeFileSync(path.join(root, "README.md"), "fixture\n");
  for (const id of ["ballet-critic-agent", "ballet-refinement-agent"] as const) writeFileSync(
    path.join(root, ".codex", "agents", `${id}.toml`),
    `name = "${id}"\ndescription = "Test Agent"\nmodel = "gpt-5.6-sol"\nmodel_reasoning_effort = "high"\nsandbox_mode = "read-only"\ndeveloper_instructions = """\n${VALID_INSTRUCTION}\n"""\n`
  );
  const config = validProjectConfig();
  for (const action of config.environment.states.flatMap(({ actions }) => actions)) for (const role of ["validation", "work"] as const) {
    const id = action[role].agentId;
    writeFileSync(path.join(root, ".codex", "agents", `${id}.toml`),
      `name = "${id}"\ndescription = "${role} Agent"\ndeveloper_instructions = "${role} ${action.id} exact instructions"\nmodel = "gpt-5.6-sol"\nmodel_reasoning_effort = "high"\n`);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "README.md", ".codex/agents"], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], { cwd: root });
  const stateDirectory = mkdtempSync(path.join(tmpdir(), "ballet-orchestration-http-state-"));
  const manager = new LocalDatabase(path.join(stateDirectory, "state.sqlite"));
  const connection = () => manager.connection(); connection();
  const projects = new ProjectConfigurationRepository(path.join(root, ".ballet", "project.json"), connection);
  const documents = new ProjectDocumentRepository(path.join(root, ".ballet"), connection);
  let configHash = projects.save(config, "absent").configHash;
  documents.put("adr", "adr-1", "# ADR 1\n", "absent");
  const instructionHash = documents.put("instruction", "instruction", VALID_INSTRUCTION, "absent").contentHash;
  const project = new ProjectDefinitionService(root, projects, documents);
  const actionAgentSlot = project.agents.requireAction("ballet-action-validation-action-1");
  const agentCapability = (agentId: string) => ({
    subject: { kind: "agent" as const, agentId },
    provider: "codex" as const, model: "gpt-5.6-sol", reasoningEffort: "high",
    cliVersion: "1.0.0",
    supportedModels: ["gpt-5.6-sol"], supportedReasoningEfforts: ["high"],
    supportsReadOnly: true, supportsWorkspaceWrite: true
  });
  const actionCapability = (actionId: string, profiles: { validation: ActionAgentDefinition; work: ActionAgentDefinition }) => ({
    subject: { kind: "action" as const, actionId }, provider: "codex" as const,
    cliVersion: "1.0.0",
    roles: {
      validation: { agentId: profiles.validation.id, model: profiles.validation.model, reasoningEffort: profiles.validation.reasoningEffort, supportedModels: ["gpt-5.6-sol"], supportedReasoningEfforts: ["high"] },
      work: { agentId: profiles.work.id, model: profiles.work.model, reasoningEffort: profiles.work.reasoningEffort, supportedModels: ["gpt-5.6-sol"], supportedReasoningEfforts: ["high"] }
    }, supportsReadOnly: true, supportsWorkspaceWrite: true
  });
  const preflight = {
    inspectAgent: async (agent: { id: string }) => { const value = agentCapability(agent.id); return { ...value, capabilitySha256: hash(value) }; },
    inspectAction: async (actionId: string, profiles: { validation: ActionAgentDefinition; work: ActionAgentDefinition }) => {
      const value = actionCapability(actionId, profiles); return { ...value, capabilitySha256: hash(value) };
    }
  };
  const planner = new EnvironmentRunPlanner(project, preflight, () => TEST_AT);
  const environmentQueue = new DeterministicExecutionQueue();
  const provider = new ScriptedRuntimeProvider([
    providerOutput({ phase: "precheck", decision: "done", evidence: {} }),
    providerOutput({ phase: "precheck", decision: "blocked", reason: "Needs correction",
      correctiveActions: ["Correct input"], evidence: {} })
  ]);
  let sequence = 0; const nextId = (kind: string) => `${kind}-${++sequence}`;
  const runtime = new EnvironmentRuntimeService(connection, environmentQueue, provider, {
    finalize: async (run, at) => ({ runEvidenceId: nextId("evidence"), environmentRunId: run.environmentRunId,
      branch: run.branch, worktreePath: run.worktreePath, baseCommit: run.baseCommit, resultCommit: run.baseCommit,
      changedFiles: [], artifactRefs: [], resourceHashes: {}, definitionHashes: {},
      validationSummary: { status: "passed" }, createdAt: at })
  }, nextId, () => TEST_AT);
  const feedbackService = new FeedbackBoxService(connection);
  const scheduler = new CriticSchedulerService(connection, { now: () => TEST_AT }, nextId);
  const governance = new GovernanceExecutionService(
    connection, new DeterministicExecutionQueue(), nextId, () => TEST_AT,
    { prepareReadOnly: async (_taskId, _commit, fallback) => fallback, releaseReadOnly: async () => undefined },
    isAllowedRefinementPath
  );
  const refinementWorktrees = mkdtempSync(path.join(tmpdir(), "ballet-orchestration-refinement-http-"));
  const refinementApply = new RefinementApplyService(connection, root, refinementWorktrees, { run: async () => undefined },
    async ({ refinementProposalId, refinementApplyId, commitSha }) => {
      const reviews = new ReviewStore(connection); const proposal = reviews.requireRefinementProposal(refinementProposalId);
      const source = connection().prepare("SELECT source_environment_run_id FROM refinement_runs WHERE refinement_run_id = ?")
        .get(String(proposal.refinement_run_id)) as { source_environment_run_id: string };
      const runs = new EnvironmentRunStore(connection); const parent = runs.require(source.source_environment_run_id);
      const worktreePath = path.join(refinementWorktrees, refinementApplyId.replace(/[^a-zA-Z0-9._-]/g, "-"));
      const worktreeProject = new ProjectDefinitionService(worktreePath,
        new ProjectConfigurationRepository(path.join(worktreePath, ".ballet", "project.json"), connection),
        new ProjectDocumentRepository(path.join(worktreePath, ".ballet"), connection));
      const replanned = await new EnvironmentRunPlanner(worktreeProject, preflight, () => TEST_AT).plan();
      const continuationRunId = nextId("environment-run");
      const planned = replanned.createInput({ environmentRunId: continuationRunId, worktreePath,
        branch: `ballet/refinement/${refinementProposalId}`, createdAt: TEST_AT, input: parent.input });
      const parentActions = runs.states(parent.environmentRunId).flatMap(({ stateExecutionId }) => runs.actions(stateExecutionId));
      const impact = JSON.parse(String(proposal.impact_scope_json)) as { actionIds: string[] };
      const seed = planContinuationSeed({ parent, parentActions, planned, targetActionId: String(proposal.target_action_id),
        impactActionIds: impact.actionIds, refinementProposalId,
        refinementApprovalId: `${refinementProposalId}:decision`, refinementCommitSha: commitSha });
      return { ...seed, continuationLinkId: nextId("continuation-link"), continuationSnapshotHash: seed.executionSnapshotHash };
    }, () => TEST_AT, isAllowedRefinementPath);
  const controller = new ApiController({ connection, project, planner, runtime,
    workspace: { prepare: async (runId) => ({ worktreePath: root, branch: `test/${runId}` }), discard: async () => undefined },
    feedback: feedbackService, scheduler, governance, refinementApply,
    invalidations: new InvalidationBroadcaster(), nextId, now: () => TEST_AT });
  const app = express(); app.disable("x-powered-by"); app.use(loopbackSecurity(4317)); app.use(express.json({ limit: "1mb" }));
  app.use("/api", createOrchestrationRouter({ controller, actor: () => ({ id: "trusted-local", source: "request_context" }) }));
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
  return { base: `http://127.0.0.1:${address.port}/api`, root, config, get configHash() { return configHash; },
    set configHash(value: string) { configHash = value; }, instructionHash,
    actionAgentHash: actionAgentSlot.contentHash, actionAgentSource: actionAgentSlot.source, database: connection, runtime };
};

const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue));
const commitAll = (root: string, message: string): void => {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", message], { cwd: root });
};
const providerOutput = (result: Record<string, unknown>) => ({
  kind: "output" as const, providerOutcomeKey: `provider:${String(result.decision)}`,
  raw: JSON.stringify({ version: 11, role: "validation", summary: "Validated",
    checks: [{ name: "fixture", status: "passed", evidenceRefs: ["test:fixture"] }], result })
});
