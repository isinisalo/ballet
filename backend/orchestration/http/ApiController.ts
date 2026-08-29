/* eslint-disable max-lines -- One typed application facade keeps every orchestration HTTP adapter free of persistence and domain decisions. */
import type Database from "better-sqlite3";
import type { ProjectConfigurationV21 } from "../../../shared/orchestration/environment.js";
import type { FeedbackCategory, FeedbackTargetType } from "../../../shared/orchestration/reviews.js";
import type { TrustedHumanActor } from "../../../shared/orchestration/persistence.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import { actionFlags, validateRunnableEnvironment } from "../../../shared/orchestration/gates.js";
import type { ActionDefinition, EnvironmentDefinition, StateDefinition } from "../../../shared/orchestration/environment.js";
import type { EnvironmentRuntimeService } from "../runtime/EnvironmentRuntimeService.js";
import type { EnvironmentRunPlanner } from "../runtime/EnvironmentRunPlanner.js";
import { ControlFlowStore } from "../persistence/ControlFlowStore.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { FeedbackStore } from "../persistence/FeedbackStore.js";
import { ReviewCoordinator } from "../persistence/ReviewCoordinator.js";
import { ReviewStore } from "../persistence/ReviewStore.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";
import type { CriticSchedulerService } from "../governance/CriticSchedulerService.js";
import type { FeedbackBoxService } from "../governance/FeedbackBoxService.js";
import type { GovernanceExecutionService } from "../governance/GovernanceExecutionService.js";
import type { RefinementApplyService } from "../governance/RefinementApplyService.js";
import type { ProjectDefinitionService, DirectionValue } from "../project/ProjectDefinitionService.js";
import type { ProjectDocumentKind } from "../project/ProjectReferenceIndex.js";
import { ProjectReferenceIndex } from "../project/ProjectReferenceIndex.js";
import { RunEvidenceStore } from "../persistence/RunEvidenceStore.js";
import type {
  InvalidationBroadcaster
} from "./InvalidationBroadcaster.js";
import type { InvalidationEvent, InvalidationKind } from "../../../shared/orchestration/httpContracts.js";

export interface OrchestrationWorkspacePort {
  prepare(runId: string, expectedBaseCommit?: string): Promise<{ worktreePath: string; branch: string }>;
  discard(runId: string): Promise<void>;
}

export interface OrchestrationControllerDependencies {
  connection: () => Database.Database;
  project: ProjectDefinitionService;
  planner: EnvironmentRunPlanner;
  runtime: EnvironmentRuntimeService;
  workspace: OrchestrationWorkspacePort;
  feedback: FeedbackBoxService;
  scheduler: CriticSchedulerService;
  governance: GovernanceExecutionService;
  refinementApply?: RefinementApplyService;
  invalidations?: InvalidationBroadcaster;
  nextId(kind: string): string;
  now(): string;
}

export class ApiController {
  private readonly runs: EnvironmentRunStore;
  private readonly events: ControlFlowStore;
  private readonly reviews: ReviewCoordinator;
  private readonly reviewStore: ReviewStore;
  private readonly feedbackStore: FeedbackStore;
  private readonly runEvidences: RunEvidenceStore;

  constructor(private readonly dependencies: OrchestrationControllerDependencies) {
    this.runs = new EnvironmentRunStore(dependencies.connection);
    this.events = new ControlFlowStore(dependencies.connection);
    this.reviews = new ReviewCoordinator(dependencies.connection);
    this.reviewStore = new ReviewStore(dependencies.connection);
    this.feedbackStore = new FeedbackStore(dependencies.connection);
    this.runEvidences = new RunEvidenceStore(dependencies.connection);
  }

  project(): unknown { return this.dependencies.project.projects.load(); }
  putProject(config: ProjectConfigurationV21, expectedHash: string | "absent"): unknown {
    const current = this.dependencies.project.projects.loadOptional();
    if (current && canonical(current.config.direction) !== canonical(config.direction)) {
      throw new ConflictError("Direction and Use Case mutations require their dedicated document commands.");
    }
    if (!current && config.direction.useCases.some(({ status }) => status === "approved")) {
      throw new ConflictError("Initial Use Cases must be draft and use the dedicated human approval command.");
    }
    if (current && canonical(current.config.agents) !== canonical(config.agents)) {
      throw new ConflictError("Agent mutations require their dedicated Markdown document commands.");
    }
    const saved = this.dependencies.project.projects.save(config, expectedHash);
    this.changed("project_changed");
    if (!current || canonical(current.config.critic) !== canonical(config.critic)) this.changed("schedule_changed");
    return saved;
  }
  documents(kind: ProjectDocumentKind): unknown { return this.dependencies.project.documents.list(kind); }
  document(kind: ProjectDocumentKind, id: string): unknown {
    const document = this.dependencies.project.documents.require(kind, id);
    if (kind === "instruction" || kind === "skill") return document;
    const config = this.dependencies.project.projects.load().config;
    if (kind === "agent") return { ...document, value: config.agents.find((value) => value.id === id) };
    return { ...document, value: directionValues(config, kind).find((value) => value.id === id) };
  }
  createAgent(input: Parameters<ProjectDefinitionService["putAgent"]>[0]): unknown {
    if (input.expectedDocumentHash !== "absent" || this.dependencies.project.documents.list("agent").some(({ id }) => id === input.id)) {
      throw new ConflictError(`Agent ${input.id} already exists.`);
    }
    const saved = this.dependencies.project.putAgent(input); this.changed("project_changed", input.id); return saved;
  }
  updateAgent(input: Parameters<ProjectDefinitionService["putAgent"]>[0]): unknown {
    if (input.expectedDocumentHash === "absent") throw new NotFoundError(`Agent ${input.id} was not found.`);
    this.dependencies.project.documents.require("agent", input.id);
    const saved = this.dependencies.project.putAgent(input); this.changed("project_changed", input.id); return saved;
  }
  removeAgent(input: Parameters<ProjectDefinitionService["removeAgent"]>[0]): unknown {
    const hash = this.dependencies.project.removeAgent(input); this.changed("project_changed", input.id); return { configHash: hash };
  }
  referenceIndex(): unknown {
    const config = this.dependencies.project.projects.load().config;
    const activeRunIds = (this.dependencies.connection().prepare(
      "SELECT environment_run_id FROM environment_runs WHERE status IN ('pending','running') ORDER BY environment_run_id"
    ).all() as Array<{ environment_run_id: string }>).map(({ environment_run_id }) => environment_run_id);
    const runReferences = (["goal", "adr", "constraint", "use-case", "agent", "instruction", "skill"] as const)
      .flatMap((kind) => this.dependencies.project.documents.list(kind).flatMap(({ id }) => {
        const runIds = this.dependencies.project.documents.runReferences(kind, id);
        return runIds.length > 0 ? [{ kind, id, runIds }] : [];
      }));
    return { entries: new ProjectReferenceIndex(config).entries(), runReferences, activeRunIds };
  }
  createResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    if (expectedHash !== "absent" || this.dependencies.project.documents.list(kind).some((item) => item.id === id)) {
      throw new ConflictError(`${kind} ${id} already exists.`);
    }
    return this.putResource(kind, id, content, expectedHash);
  }
  updateResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    if (expectedHash === "absent") throw new NotFoundError(`${kind} ${id} was not found.`);
    this.dependencies.project.documents.require(kind, id);
    return this.putResource(kind, id, content, expectedHash);
  }
  private putResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    const saved = this.dependencies.project.documents.put(kind, id, content, expectedHash);
    this.changed("project_changed", id); return saved;
  }
  removeResource(kind: "instruction" | "skill", id: string, expectedHash: string): void {
    const config = this.dependencies.project.projects.load().config;
    const blockers = new (requireIndex())(config).for(kind, id)
      .map(({ ownerType, ownerId, field }) => `${ownerType}:${ownerId}.${field}`);
    blockers.push(...this.dependencies.project.documents.runReferences(kind, id)
      .map((runId) => `environment-run:${runId}.snapshot`));
    this.dependencies.project.documents.remove(kind, id, expectedHash, blockers);
    this.changed("project_changed", id);
  }
  createDirection(input: Parameters<ProjectDefinitionService["putDirection"]>[0]): unknown {
    const loaded = this.dependencies.project.projects.load();
    if (input.expectedDocumentHash !== "absent"
      || directionValues(loaded.config, input.kind).some(({ id }) => id === input.id)
      || this.dependencies.project.documents.list(input.kind).some(({ id }) => id === input.id)) {
      throw new ConflictError(`${input.kind} ${input.id} already exists.`);
    }
    return this.putDirection(input);
  }
  updateDirection(input: Parameters<ProjectDefinitionService["putDirection"]>[0]): unknown {
    const loaded = this.dependencies.project.projects.load();
    if (input.expectedDocumentHash === "absent"
      || !directionValues(loaded.config, input.kind).some(({ id }) => id === input.id)) {
      throw new NotFoundError(`${input.kind} ${input.id} was not found.`);
    }
    this.dependencies.project.documents.require(input.kind, input.id);
    return this.putDirection(input);
  }
  private putDirection(input: Parameters<ProjectDefinitionService["putDirection"]>[0]): unknown {
    const saved = this.dependencies.project.putDirection(input); this.changed("project_changed", input.id); return saved;
  }
  removeDirection(input: Parameters<ProjectDefinitionService["removeDirection"]>[0]): unknown {
    const configHash = this.dependencies.project.removeDirection(input); this.changed("project_changed", input.id);
    return { configHash };
  }
  approveUseCase(id: string, hash: string, contentHash: string, actor: TrustedHumanActor): unknown {
    const configHash = this.dependencies.project.approveUseCase(id, hash, contentHash, actor, this.dependencies.now());
    this.changed("project_changed", id); return { configHash };
  }
  revokeUseCase(id: string, hash: string): unknown {
    const configHash = this.dependencies.project.revokeUseCase(id, hash);
    this.changed("project_changed", id); return { configHash };
  }
  environment(): unknown {
    const loaded = this.dependencies.project.projects.load();
    const activeRunIds = (this.referenceIndex() as { activeRunIds: string[] }).activeRunIds;
    return { environment: loaded.config.environment, configHash: loaded.configHash,
      readinessIssues: validateRunnableEnvironment(loaded.config.environment, loaded.config.direction),
      activeRunIds, locked: activeRunIds.length > 0 };
  }
  putEnvironment(environment: EnvironmentDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const saved = this.dependencies.project.projects.save({ ...loaded.config, environment }, expectedConfigHash);
    this.changed("project_changed", environment.id); return saved;
  }
  state(id: string): unknown {
    const loaded = this.dependencies.project.projects.load();
    const state = loaded.config.environment.states.find((candidate) => candidate.id === id);
    if (!state) throw new NotFoundError(`State ${id} was not found.`);
    return { state, configHash: loaded.configHash };
  }
  createState(state: StateDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    if (loaded.config.environment.states.some(({ id }) => id === state.id)) {
      throw new ConflictError(`State ${state.id} already exists.`);
    }
    return this.saveState(loaded.config.environment.states, state, loaded.config.environment, expectedConfigHash);
  }
  updateState(state: StateDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    if (!loaded.config.environment.states.some(({ id }) => id === state.id)) {
      throw new NotFoundError(`State ${state.id} was not found.`);
    }
    return this.saveState(loaded.config.environment.states, state, loaded.config.environment, expectedConfigHash);
  }
  removeState(id: string, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    if (!loaded.config.environment.states.some((state) => state.id === id)) throw new NotFoundError(`State ${id} was not found.`);
    return this.putEnvironment({ ...loaded.config.environment,
      states: loaded.config.environment.states.filter((state) => state.id !== id) }, expectedConfigHash);
  }
  reorderStates(ids: string[], expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const current = loaded.config.environment.states;
    assertExactOrder(ids, current.map(({ id }) => id), "State");
    const byId = new Map(current.map((state) => [state.id, state]));
    return this.putEnvironment({ ...loaded.config.environment,
      states: ids.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })) }, expectedConfigHash);
  }
  action(stateId: string, actionId: string): unknown {
    const loaded = this.dependencies.project.projects.load();
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new NotFoundError(`State ${stateId} was not found.`);
    const action = state.actions.find(({ id }) => id === actionId);
    if (!action) throw new NotFoundError(`Action ${actionId} was not found.`);
    return { action, configHash: loaded.configHash };
  }
  createAction(stateId: string, action: ActionDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new NotFoundError(`State ${stateId} was not found.`);
    if (state.actions.some(({ id }) => id === action.id)) throw new ConflictError(`Action ${action.id} already exists.`);
    return this.saveState(loaded.config.environment.states, { ...state, actions: [...state.actions, action] }, loaded.config.environment, expectedConfigHash);
  }
  updateAction(stateId: string, action: ActionDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new NotFoundError(`State ${stateId} was not found.`);
    if (!state.actions.some(({ id }) => id === action.id)) throw new NotFoundError(`Action ${action.id} was not found.`);
    return this.saveState(loaded.config.environment.states, { ...state, actions: replace(state.actions, action) }, loaded.config.environment, expectedConfigHash);
  }
  removeAction(stateId: string, actionId: string, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new NotFoundError(`State ${stateId} was not found.`);
    if (!state.actions.some(({ id }) => id === actionId)) throw new NotFoundError(`Action ${actionId} was not found.`);
    return this.saveState(loaded.config.environment.states,
      { ...state, actions: state.actions.filter(({ id }) => id !== actionId) }, loaded.config.environment, expectedConfigHash);
  }
  reprioritizeActions(stateId: string, ids: string[], expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new NotFoundError(`State ${stateId} was not found.`);
    assertExactOrder(ids, state.actions.map(({ id }) => id), "Action");
    const byId = new Map(state.actions.map((action) => [action.id, action]));
    return this.saveState(loaded.config.environment.states,
      { ...state, actions: ids.map((id, index) => ({ ...byId.get(id)!, priority: index + 1 })) },
      loaded.config.environment, expectedConfigHash);
  }

  async startRun(environmentId: string, expectedConfigHash: string, input?: string): Promise<unknown> {
    const loaded = this.dependencies.project.projects.load();
    if (loaded.configHash !== expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    if (loaded.config.environment.id !== environmentId) throw new NotFoundError(`Environment ${environmentId} was not found.`);
    let plan: Awaited<ReturnType<EnvironmentRunPlanner["plan"]>>;
    try { plan = await this.dependencies.planner.plan(); }
    catch (error) {
      if (error instanceof ConflictError) throw error;
      throw new ConflictError(`Environment preflight failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (plan.snapshot.projectConfigSha256 !== expectedConfigHash) throw new ConflictError("Planned Project Config changed.");
    const runId = this.dependencies.nextId("environment-run");
    let workspace: Awaited<ReturnType<OrchestrationWorkspacePort["prepare"]>>;
    try { workspace = await this.dependencies.workspace.prepare(runId, plan.snapshot.projectHeadSha); }
    catch (error) {
      throw new ConflictError(`Environment workspace preflight failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      const started = await this.dependencies.runtime.start(plan.createInput({
        environmentRunId: runId, worktreePath: workspace.worktreePath,
        branch: workspace.branch, createdAt: this.dependencies.now(), input
      }));
      this.changed("run_changed", runId); return started;
    } catch (error) { await this.dependencies.workspace.discard(runId); throw error; }
  }
  run(id: string): unknown {
    const run = this.runs.require(id);
    const states = this.runs.states(id).map((state) => {
      const actions = this.runs.actions(state.stateExecutionId).map((action) => ({
        ...action, definitionSnapshot: undefined, ...actionFlags(action.status)
      }));
      return { ...state, definitionSnapshot: undefined, actions,
        done: actions.length > 0 && actions.every(({ status }) => status === "done"),
        blocked: actions.some(({ status }) => status === "blocked") };
    });
    const activeAgentRow = run.activeAgentRunId ? this.dependencies.connection().prepare(`
      SELECT agent_run_id, role, phase, status, revision, attempt, parent_agent_run_id, outcome_json, created_at, updated_at
      FROM agent_runs WHERE agent_run_id = ?
    `).get(run.activeAgentRunId) : undefined;
    const activeAgent = activeAgentRow ? { ...(activeAgentRow as Record<string, unknown>),
      outcome: Reflect.get(activeAgentRow as object, "outcome_json")
        ? JSON.parse(String(Reflect.get(activeAgentRow as object, "outcome_json"))) : undefined,
      outcome_json: undefined } : undefined;
    const evidence = run.status === "completed" ? this.runEvidences.requireByRun(id) : undefined;
    return { ...publicRun(run), activeAgent, states, events: this.eventFacts(id, 0), evidence };
  }
  listRuns(): unknown[] {
    const rows = this.dependencies.connection().prepare(
      "SELECT environment_run_id FROM environment_runs ORDER BY created_at DESC LIMIT 200"
    ).all() as Array<{ environment_run_id: string }>;
    return rows.map(({ environment_run_id }) => publicRun(this.runs.require(environment_run_id)));
  }
  async cancelRun(id: string): Promise<unknown> {
    const run = publicRun(await this.dependencies.runtime.cancel(id)); this.changed("run_changed", id); return run;
  }
  answerWorkInput(id: string, input: {
    expectedAgentRunId: string; expectedAgentRevision: number; answer: string;
  }, actor: TrustedHumanActor): unknown {
    const run = this.dependencies.runtime.answerWorkInput({ environmentRunId: id, ...input, actorId: actor.id });
    this.changed("run_changed", id); return publicRun(run);
  }
  evidence(id: string): unknown { this.runs.require(id); return this.runEvidences.requireByRun(id); }
  eventFacts(id: string, after: number): unknown[] {
    this.runs.require(id);
    return this.events.list(id).filter((row) => Number(row.sequence) > after).slice(0, 500).map((row) => ({
      sequence: row.sequence, kind: row.kind, stateExecutionId: row.state_execution_id,
      actionExecutionId: row.action_execution_id, createdAt: row.created_at
    }));
  }

  listFeedback(input: { environmentRunId?: string; status?: string; category?: FeedbackCategory }): unknown {
    return this.dependencies.feedback.list(input);
  }
  async createFeedback(input: { category: FeedbackCategory; comment: string }, actor: TrustedHumanActor): Promise<unknown> {
    const id = this.dependencies.nextId("feedback");
    const project = await this.dependencies.project.load();
    this.dependencies.feedback.createHuman({ ...input, sourceCommit: project.baseCommit,
      feedbackEntryId: id, createdAt: this.dependencies.now() }, actor);
    this.changed("feedback_changed", id);
    return this.feedbackStore.require(id);
  }
  decideFeedback(id: string, from: "open" | "in_refinement", to: "resolved" | "dismissed", actor: TrustedHumanActor): void {
    this.dependencies.feedback.transitionHuman(id, from, to, this.dependencies.now(), actor);
    this.changed("feedback_changed", id);
  }
  feedback(id: string): unknown { return this.feedbackStore.require(id); }

  async createRefinementForFeedback(id: string): Promise<unknown> {
    const feedback = this.feedbackStore.require(id);
    if (typeof feedback.environment_run_id !== "string") {
      throw new ConflictError("Project-level Feedback needs a completed Environment Run before Refinement can start.");
    }
    return this.createRefinement(feedback.environment_run_id, [id]);
  }

  async reconcileCritic(): Promise<unknown> {
    const config = this.dependencies.project.projects.load().config.critic;
    this.dependencies.scheduler.configure(config.schedules, config.enabled);
    const ids = this.dependencies.scheduler.tick();
    for (const id of ids) {
      const row = this.dependencies.connection().prepare("SELECT status FROM critic_runs WHERE critic_run_id = ?").get(id) as { status: string };
      if (row.status === "queued") await this.dependencies.governance.queueCritic(id);
    }
    this.changed("schedule_changed"); return { criticRunIds: ids };
  }
  listCritic(kind: "schedules" | "runs" | "proposals"): unknown[] {
    const queries = {
      schedules: "SELECT critic_schedule_id, enabled, next_due_at, updated_at FROM critic_schedules ORDER BY critic_schedule_id",
      runs: "SELECT critic_run_id, critic_schedule_id, due_at, status, skip_reason, created_at, updated_at FROM critic_runs ORDER BY created_at DESC LIMIT 200",
      proposals: "SELECT critic_proposal_id, critic_run_id, content_hash, target_type, target_id, category, status, version, created_at, updated_at FROM critic_proposals ORDER BY created_at DESC LIMIT 200"
    };
    return this.dependencies.connection().prepare(queries[kind]).all() as unknown[];
  }
  criticProposal(id: string): unknown { return this.reviewStore.requireCriticProposal(id); }
  async manualCritic(): Promise<unknown> {
    const evidence = this.dependencies.connection().prepare(
      "SELECT run_evidence_id FROM run_evidences ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ).get() as { run_evidence_id: string } | undefined;
    if (!evidence) throw new ConflictError("Manual Critic requires a Run Evidence.");
    const at = this.dependencies.now(); const scheduleId = "manual";
    this.reviewStore.upsertSchedule({ criticScheduleId: scheduleId, configHash: sha256("manual"),
      config: { id: scheduleId, kind: "daily", timeZone: "UTC", localTimes: ["00:00"] },
      nextDueAt: at, enabled: true, createdAt: at });
    const criticRunId = this.dependencies.nextId("critic-run");
    this.reviews.createCriticDue({ criticRunId, criticScheduleId: scheduleId, dueAt: at,
      dueKey: `${scheduleId}:${criticRunId}`, runEvidenceId: evidence.run_evidence_id, createdAt: at });
    const taskId = await this.dependencies.governance.queueCritic(criticRunId);
    this.changed("critic_changed", criticRunId); return { criticRunId, taskId };
  }
  decideCritic(id: string, input: {
    decision: "approved" | "rejected"; expectedContentHash: string; expectedVersion: 2; rationale?: string;
  }, actor: TrustedHumanActor): void {
    const proposal = this.reviewStore.requireCriticProposal(id);
    const owner = this.dependencies.connection().prepare(`
      SELECT ps.environment_run_id FROM critic_proposals cp
      JOIN critic_runs cr ON cr.critic_run_id = cp.critic_run_id
      JOIN run_evidences ps ON ps.run_evidence_id = cr.run_evidence_id
      WHERE cp.critic_proposal_id = ?
    `).get(id) as { environment_run_id: string } | undefined;
    if (input.decision === "approved" && !owner) {
      throw new ConflictError("Critic proposal has no immutable Run Evidence owner.");
    }
    const content = JSON.parse(String(proposal.content_json)) as Record<string, unknown>;
    const recommendations = Array.isArray(content.recommendedCorrectiveActions)
      ? content.recommendedCorrectiveActions.filter((value): value is string => typeof value === "string") : [];
    const evidenceRefs = Array.isArray(content.evidenceRefs)
      ? content.evidenceRefs.filter((value): value is string => typeof value === "string") : [];
    const feedback = input.decision === "approved" ? {
      feedbackEntryId: this.dependencies.nextId("feedback"), environmentRunId: owner!.environment_run_id,
      source: "approved_critic_proposal" as const,
      category: proposal.category as FeedbackCategory, targetType: proposal.target_type as FeedbackTargetType,
      targetId: String(proposal.target_id), criticProposalId: id,
      comment: [String(content.finding ?? "Critic finding"), ...recommendations].join("\n\n"), evidenceRefs,
      provenance: { proposalContentHash: input.expectedContentHash }, createdAt: this.dependencies.now()
    } : undefined;
    this.reviews.decideCritic(id, { decision: input.decision, expectedContentHash: input.expectedContentHash,
      expectedVersion: input.expectedVersion, decidedAt: this.dependencies.now(), rationale: input.rationale }, actor, feedback);
    this.changed("critic_changed", id);
  }

  async createRefinement(sourceEnvironmentRunId: string, feedbackEntryIds: string[]): Promise<unknown> {
    const id = this.dependencies.nextId("refinement-run");
    this.reviews.createRefinementRun({ refinementRunId: id, sourceEnvironmentRunId,
      feedbackEntryIds, createdAt: this.dependencies.now() });
    const taskId = await this.dependencies.governance.queueRefinement(id); this.changed("refinement_changed", id);
    return { refinementRunId: id, taskId };
  }
  listRefinement(kind: "runs" | "proposals"): unknown[] {
    const query = kind === "runs"
      ? "SELECT refinement_run_id, source_environment_run_id, status, created_at, updated_at FROM refinement_runs ORDER BY created_at DESC LIMIT 200"
      : "SELECT refinement_proposal_id, refinement_run_id, target_action_id, change_list_hash, impact_scope_json, status, version, created_at, updated_at FROM refinement_proposals ORDER BY created_at DESC LIMIT 200";
    return this.dependencies.connection().prepare(query).all() as unknown[];
  }
  refinementProposal(id: string): unknown {
    const proposal = this.reviewStore.requireRefinementProposal(id);
    const row = this.dependencies.connection().prepare(`
      SELECT er.execution_snapshot_json FROM refinement_runs rr
      JOIN environment_runs er ON er.environment_run_id = rr.source_environment_run_id
      WHERE rr.refinement_run_id = ?
    `).get(proposal.refinement_run_id) as { execution_snapshot_json: string } | undefined;
    if (!row) throw new ConflictError("Refinement proposal has no immutable source snapshot.");
    const snapshot = JSON.parse(row.execution_snapshot_json) as {
      resources?: Array<{ relativePath: string; content: string }>;
    };
    const resources = new Map((snapshot.resources ?? []).map((resource) => [resource.relativePath, resource.content]));
    const files = this.reviewStore.refinementFiles(id).map((file) => ({
      ...file,
      preimage_content: String(file.operation) === "create" ? null : resources.get(String(file.relative_path)) ?? null
    }));
    return { ...proposal, files };
  }
  refinementApplyStatus(id: string): unknown {
    const row = this.dependencies.connection().prepare(
      "SELECT * FROM refinement_applies WHERE refinement_proposal_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(id);
    if (!row) throw new NotFoundError(`Refinement apply for ${id} was not found.`);
    return row;
  }
  continuation(id: string): unknown {
    const row = this.dependencies.connection().prepare(`
      SELECT cl.* FROM continuation_links cl JOIN refinement_applies ra ON ra.refinement_apply_id = cl.refinement_apply_id
      WHERE ra.refinement_proposal_id = ? ORDER BY cl.created_at DESC LIMIT 1
    `).get(id);
    if (!row) throw new NotFoundError(`Continuation for ${id} was not found.`);
    return row;
  }
  decideRefinement(
    id: string,
    input: Omit<Parameters<ReviewCoordinator["decideRefinement"]>[1], "decidedAt">,
    actor: TrustedHumanActor
  ): void {
    this.reviews.decideRefinement(id, { ...input, decidedAt: this.dependencies.now() }, actor);
    this.changed("refinement_changed", id);
  }
  async applyRefinement(id: string): Promise<unknown> {
    if (!this.dependencies.refinementApply) throw new ConflictError("Refinement apply is not configured.");
    const status = await this.dependencies.refinementApply.apply(id, this.dependencies.nextId("refinement-apply"));
    if (status === "applied") {
      const row = this.dependencies.connection().prepare(`
        SELECT cl.continuation_run_id FROM continuation_links cl
        JOIN refinement_applies ra ON ra.refinement_apply_id = cl.refinement_apply_id
        WHERE ra.refinement_proposal_id = ? ORDER BY cl.created_at DESC LIMIT 1
      `).get(id) as { continuation_run_id: string } | undefined;
      if (row) await this.dependencies.runtime.resume(row.continuation_run_id);
    }
    this.changed("refinement_changed", id); return { status };
  }

  invalidationEvents(after: number): InvalidationEvent[] { return this.dependencies.invalidations?.list(after) ?? []; }
  subscribeInvalidations(listener: (event: InvalidationEvent) => void): () => void {
    return this.dependencies.invalidations?.subscribe(listener) ?? (() => undefined);
  }

  private requireConfigHash(expectedConfigHash: string): ReturnType<ProjectDefinitionService["projects"]["load"]> {
    const loaded = this.dependencies.project.projects.load();
    if (loaded.configHash !== expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    return loaded;
  }
  private saveState(states: StateDefinition[], state: StateDefinition,
    environment: EnvironmentDefinition, expectedConfigHash: string): unknown {
    return this.putEnvironment({ ...environment, states: replace(states, state) }, expectedConfigHash);
  }
  private changed(kind: InvalidationKind, entityId?: string): void {
    this.dependencies.invalidations?.publish(kind, this.dependencies.now(), entityId);
  }
}

const publicRun = (run: ReturnType<EnvironmentRunStore["require"]>) => ({
  environmentRunId: run.environmentRunId, environmentDefinitionId: run.environmentDefinitionId,
  source: run.source, previousRunId: run.previousRunId, input: run.input, status: run.status, revision: run.revision,
  baseCommit: run.baseCommit, resultCommit: run.resultCommit, branch: run.branch,
  transitionCount: run.transitionCount, transitionLimit: run.transitionLimit,
  createdAt: run.createdAt, updatedAt: run.updatedAt, completedAt: run.completedAt
});
const canonical = (value: unknown): string => canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue);
const replace = <T extends { id: string }>(values: T[], value: T): T[] =>
  [...values.filter(({ id }) => id !== value.id), value];
const assertExactOrder = (received: string[], current: string[], label: string): void => {
  if (received.length !== current.length || new Set(received).size !== received.length
    || received.some((id) => !current.includes(id))) {
    throw new ConflictError(`${label} reorder must contain every current ID exactly once.`);
  }
};
const directionValues = (
  config: ProjectConfigurationV21, kind: Exclude<ProjectDocumentKind, "instruction" | "skill">
) => kind === "goal" ? config.direction.goals : kind === "adr" ? config.direction.adrs
  : kind === "constraint" ? config.direction.constraints : config.direction.useCases;

// Kept lazy to avoid a runtime cycle through the project service's type-only dependencies.
const requireIndex = (): typeof ProjectReferenceIndex => ProjectReferenceIndex;

export type { DirectionValue };
