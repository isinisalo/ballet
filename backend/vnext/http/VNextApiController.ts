/* eslint-disable max-lines -- One typed application facade keeps every vNext HTTP adapter free of persistence and domain decisions. */
import type Database from "better-sqlite3";
import type { ProjectConfigurationV20 } from "../../../shared/vnext/environment.js";
import type { FeedbackCategory, FeedbackTargetType } from "../../../shared/vnext/reviews.js";
import type { TrustedHumanActor } from "../../../shared/vnext/persistence.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/vnext/primitives.js";
import { actionFlags, validateRunnableEnvironment } from "../../../shared/vnext/gates.js";
import type { ActionDefinition, EnvironmentDefinition, StateDefinition } from "../../../shared/vnext/environment.js";
import type { EnvironmentRuntimeService } from "../runtime/EnvironmentRuntimeService.js";
import type { EnvironmentRunPlanner } from "../runtime/EnvironmentRunPlanner.js";
import { ControlFlowStore } from "../persistence/ControlFlowStore.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { FeedbackStore } from "../persistence/FeedbackStore.js";
import { ReviewCoordinator } from "../persistence/ReviewCoordinator.js";
import { ReviewStore } from "../persistence/ReviewStore.js";
import { VNextConflictError, VNextNotFoundError } from "../persistence/VNextErrors.js";
import type { CriticSchedulerService } from "../governance/CriticSchedulerService.js";
import type { FeedbackBoxService } from "../governance/FeedbackBoxService.js";
import type { GovernanceExecutionService } from "../governance/GovernanceExecutionService.js";
import type { RefinementApplyService } from "../governance/RefinementApplyService.js";
import type { VNextProjectService, DirectionValue } from "../project/VNextProjectService.js";
import type { VNextDocumentKind } from "../project/VNextReferenceIndex.js";
import { VNextReferenceIndex } from "../project/VNextReferenceIndex.js";
import { ProductSnapshotStore } from "../persistence/ProductSnapshotStore.js";
import type {
  VNextInvalidationBroadcaster
} from "./VNextInvalidationBroadcaster.js";
import type { VNextInvalidationKind } from "../../../shared/vnext/httpContracts.js";

export interface VNextWorkspacePort {
  prepare(runId: string, expectedBaseCommit?: string): Promise<{ worktreePath: string; branch: string }>;
  discard(runId: string): Promise<void>;
}

export interface VNextControllerDependencies {
  connection: () => Database.Database;
  project: VNextProjectService;
  planner: EnvironmentRunPlanner;
  runtime: EnvironmentRuntimeService;
  workspace: VNextWorkspacePort;
  feedback: FeedbackBoxService;
  scheduler: CriticSchedulerService;
  governance: GovernanceExecutionService;
  refinementApply?: RefinementApplyService;
  invalidations?: VNextInvalidationBroadcaster;
  nextId(kind: string): string;
  now(): string;
}

export class VNextApiController {
  private readonly runs: EnvironmentRunStore;
  private readonly events: ControlFlowStore;
  private readonly reviews: ReviewCoordinator;
  private readonly reviewStore: ReviewStore;
  private readonly feedbackStore: FeedbackStore;
  private readonly products: ProductSnapshotStore;

  constructor(private readonly dependencies: VNextControllerDependencies) {
    this.runs = new EnvironmentRunStore(dependencies.connection);
    this.events = new ControlFlowStore(dependencies.connection);
    this.reviews = new ReviewCoordinator(dependencies.connection);
    this.reviewStore = new ReviewStore(dependencies.connection);
    this.feedbackStore = new FeedbackStore(dependencies.connection);
    this.products = new ProductSnapshotStore(dependencies.connection);
  }

  project(): unknown { return this.dependencies.project.projects.load(); }
  putProject(config: ProjectConfigurationV20, expectedHash: string | "absent"): unknown {
    const current = this.dependencies.project.projects.loadOptional();
    if (current && canonical(current.config.direction) !== canonical(config.direction)) {
      throw new VNextConflictError("Direction and Use Case mutations require their dedicated document commands.");
    }
    if (!current && config.direction.useCases.some(({ status }) => status === "approved")) {
      throw new VNextConflictError("Initial Use Cases must be draft and use the dedicated human approval command.");
    }
    const saved = this.dependencies.project.projects.save(config, expectedHash);
    this.changed("project_changed");
    if (!current || canonical(current.config.critic) !== canonical(config.critic)) this.changed("schedule_changed");
    return saved;
  }
  documents(kind: VNextDocumentKind): unknown { return this.dependencies.project.documents.list(kind); }
  document(kind: VNextDocumentKind, id: string): unknown {
    const document = this.dependencies.project.documents.require(kind, id);
    if (kind === "instruction" || kind === "skill") return document;
    const config = this.dependencies.project.projects.load().config;
    return { ...document, value: directionValues(config, kind).find((value) => value.id === id) };
  }
  referenceIndex(): unknown {
    const config = this.dependencies.project.projects.load().config;
    const activeRunIds = (this.dependencies.connection().prepare(
      "SELECT environment_run_id FROM environment_runs WHERE status IN ('pending','running') ORDER BY environment_run_id"
    ).all() as Array<{ environment_run_id: string }>).map(({ environment_run_id }) => environment_run_id);
    const runReferences = (["goal", "adr", "constraint", "use-case", "instruction", "skill"] as const)
      .flatMap((kind) => this.dependencies.project.documents.list(kind).flatMap(({ id }) => {
        const runIds = this.dependencies.project.documents.runReferences(kind, id);
        return runIds.length > 0 ? [{ kind, id, runIds }] : [];
      }));
    return { entries: new VNextReferenceIndex(config).entries(), runReferences, activeRunIds };
  }
  createResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    if (expectedHash !== "absent" || this.dependencies.project.documents.list(kind).some((item) => item.id === id)) {
      throw new VNextConflictError(`${kind} ${id} already exists.`);
    }
    return this.putResource(kind, id, content, expectedHash);
  }
  updateResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    if (expectedHash === "absent") throw new VNextNotFoundError(`${kind} ${id} was not found.`);
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
  createDirection(input: Parameters<VNextProjectService["putDirection"]>[0]): unknown {
    const loaded = this.dependencies.project.projects.load();
    if (input.expectedDocumentHash !== "absent"
      || directionValues(loaded.config, input.kind).some(({ id }) => id === input.id)
      || this.dependencies.project.documents.list(input.kind).some(({ id }) => id === input.id)) {
      throw new VNextConflictError(`${input.kind} ${input.id} already exists.`);
    }
    return this.putDirection(input);
  }
  updateDirection(input: Parameters<VNextProjectService["putDirection"]>[0]): unknown {
    const loaded = this.dependencies.project.projects.load();
    if (input.expectedDocumentHash === "absent"
      || !directionValues(loaded.config, input.kind).some(({ id }) => id === input.id)) {
      throw new VNextNotFoundError(`${input.kind} ${input.id} was not found.`);
    }
    this.dependencies.project.documents.require(input.kind, input.id);
    return this.putDirection(input);
  }
  private putDirection(input: Parameters<VNextProjectService["putDirection"]>[0]): unknown {
    const saved = this.dependencies.project.putDirection(input); this.changed("project_changed", input.id); return saved;
  }
  removeDirection(input: Parameters<VNextProjectService["removeDirection"]>[0]): unknown {
    const configHash = this.dependencies.project.removeDirection(input); this.changed("project_changed", input.id);
    return { configHash };
  }
  approveUseCase(id: string, hash: string, actor: TrustedHumanActor): unknown {
    const configHash = this.dependencies.project.approveUseCase(id, hash, actor, this.dependencies.now());
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
    if (!state) throw new VNextNotFoundError(`State ${id} was not found.`);
    return { state, configHash: loaded.configHash };
  }
  createState(state: StateDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    if (loaded.config.environment.states.some(({ id }) => id === state.id)) {
      throw new VNextConflictError(`State ${state.id} already exists.`);
    }
    return this.saveState(loaded.config.environment.states, state, loaded.config.environment, expectedConfigHash);
  }
  updateState(state: StateDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    if (!loaded.config.environment.states.some(({ id }) => id === state.id)) {
      throw new VNextNotFoundError(`State ${state.id} was not found.`);
    }
    return this.saveState(loaded.config.environment.states, state, loaded.config.environment, expectedConfigHash);
  }
  removeState(id: string, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    if (!loaded.config.environment.states.some((state) => state.id === id)) throw new VNextNotFoundError(`State ${id} was not found.`);
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
    if (!state) throw new VNextNotFoundError(`State ${stateId} was not found.`);
    const action = state.actions.find(({ id }) => id === actionId);
    if (!action) throw new VNextNotFoundError(`Action ${actionId} was not found.`);
    return { action, configHash: loaded.configHash };
  }
  createAction(stateId: string, action: ActionDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new VNextNotFoundError(`State ${stateId} was not found.`);
    if (state.actions.some(({ id }) => id === action.id)) throw new VNextConflictError(`Action ${action.id} already exists.`);
    return this.saveState(loaded.config.environment.states, { ...state, actions: [...state.actions, action] }, loaded.config.environment, expectedConfigHash);
  }
  updateAction(stateId: string, action: ActionDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new VNextNotFoundError(`State ${stateId} was not found.`);
    if (!state.actions.some(({ id }) => id === action.id)) throw new VNextNotFoundError(`Action ${action.id} was not found.`);
    return this.saveState(loaded.config.environment.states, { ...state, actions: replace(state.actions, action) }, loaded.config.environment, expectedConfigHash);
  }
  removeAction(stateId: string, actionId: string, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new VNextNotFoundError(`State ${stateId} was not found.`);
    if (!state.actions.some(({ id }) => id === actionId)) throw new VNextNotFoundError(`Action ${actionId} was not found.`);
    return this.saveState(loaded.config.environment.states,
      { ...state, actions: state.actions.filter(({ id }) => id !== actionId) }, loaded.config.environment, expectedConfigHash);
  }
  reprioritizeActions(stateId: string, ids: string[], expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new VNextNotFoundError(`State ${stateId} was not found.`);
    assertExactOrder(ids, state.actions.map(({ id }) => id), "Action");
    const byId = new Map(state.actions.map((action) => [action.id, action]));
    return this.saveState(loaded.config.environment.states,
      { ...state, actions: ids.map((id, index) => ({ ...byId.get(id)!, priority: index + 1 })) },
      loaded.config.environment, expectedConfigHash);
  }

  async startRun(environmentId: string, expectedConfigHash: string, input?: string): Promise<unknown> {
    const loaded = this.dependencies.project.projects.load();
    if (loaded.configHash !== expectedConfigHash) throw new VNextConflictError("vNext Project Config optimistic hash is stale.");
    if (loaded.config.environment.id !== environmentId) throw new VNextNotFoundError(`Environment ${environmentId} was not found.`);
    let plan: Awaited<ReturnType<EnvironmentRunPlanner["plan"]>>;
    try { plan = await this.dependencies.planner.plan(); }
    catch (error) {
      if (error instanceof VNextConflictError) throw error;
      throw new VNextConflictError(`Environment preflight failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (plan.snapshot.projectConfigSha256 !== expectedConfigHash) throw new VNextConflictError("Planned Project Config changed.");
    const runId = this.dependencies.nextId("environment-run");
    let workspace: Awaited<ReturnType<VNextWorkspacePort["prepare"]>>;
    try { workspace = await this.dependencies.workspace.prepare(runId, plan.snapshot.projectHeadSha); }
    catch (error) {
      throw new VNextConflictError(`Environment workspace preflight failed: ${error instanceof Error ? error.message : String(error)}`);
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
    const activeAgent = run.activeAgentRunId ? this.dependencies.connection().prepare(`
      SELECT agent_run_id, role, phase, status, attempt, parent_agent_run_id, created_at, updated_at
      FROM agent_runs WHERE agent_run_id = ?
    `).get(run.activeAgentRunId) : undefined;
    const product = run.status === "completed" ? this.products.requireByRun(id) : undefined;
    return { ...publicRun(run), activeAgent, states, events: this.eventFacts(id, 0), product };
  }
  listRuns(): unknown[] {
    const rows = this.dependencies.connection().prepare(
      "SELECT environment_run_id FROM environment_runs ORDER BY created_at DESC LIMIT 200"
    ).all() as Array<{ environment_run_id: string }>;
    return rows.map(({ environment_run_id }) => publicRun(this.runs.require(environment_run_id)));
  }
  cancelRun(id: string): unknown {
    const run = publicRun(this.dependencies.runtime.cancel(id)); this.changed("run_changed", id); return run;
  }
  product(id: string): unknown { this.runs.require(id); return this.products.requireByRun(id); }
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
  createFeedback(input: {
    environmentRunId: string; category: FeedbackCategory; targetType: FeedbackTargetType; targetId: string;
    title: string; description: string; correctiveActions: string[]; evidenceRefs?: string[];
  }, actor: TrustedHumanActor): unknown {
    const id = this.dependencies.nextId("feedback");
    this.dependencies.feedback.createHuman({ ...input, feedbackEntryId: id, createdAt: this.dependencies.now() }, actor);
    this.changed("feedback_changed", id);
    return this.feedbackStore.require(id);
  }
  decideFeedback(id: string, from: "open" | "in_refinement", to: "resolved" | "dismissed", actor: TrustedHumanActor): void {
    this.dependencies.feedback.transitionHuman(id, from, to, this.dependencies.now(), actor);
    this.changed("feedback_changed", id);
  }
  feedback(id: string): unknown { return this.feedbackStore.require(id); }

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
    const product = this.dependencies.connection().prepare(
      "SELECT product_snapshot_id FROM product_snapshots ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ).get() as { product_snapshot_id: string } | undefined;
    if (!product) throw new VNextConflictError("Manual Critic requires a Product Snapshot.");
    const at = this.dependencies.now(); const scheduleId = "manual";
    this.reviewStore.upsertSchedule({ criticScheduleId: scheduleId, configHash: sha256("manual"),
      config: { id: scheduleId, kind: "daily", timeZone: "UTC", localTimes: ["00:00"] },
      nextDueAt: at, enabled: true, createdAt: at });
    const criticRunId = this.dependencies.nextId("critic-run");
    this.reviews.createCriticDue({ criticRunId, criticScheduleId: scheduleId, dueAt: at,
      dueKey: `${scheduleId}:${criticRunId}`, productSnapshotId: product.product_snapshot_id, createdAt: at });
    const taskId = await this.dependencies.governance.queueCritic(criticRunId);
    this.changed("critic_changed", criticRunId); return { criticRunId, taskId };
  }
  decideCritic(id: string, input: {
    decision: "approved" | "rejected"; expectedContentHash: string; expectedVersion: 1; rationale?: string;
    feedback?: { feedbackEntryId: string; environmentRunId: string; title: string; description: string; correctiveActions: string[]; evidenceRefs?: string[] };
  }, actor: TrustedHumanActor): void {
    const proposal = this.reviewStore.requireCriticProposal(id);
    const feedback = input.decision === "approved" && input.feedback ? {
      ...input.feedback, source: "approved_critic_proposal" as const,
      category: proposal.category as FeedbackCategory, targetType: proposal.target_type as FeedbackTargetType,
      targetId: String(proposal.target_id), criticProposalId: id,
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
    return { ...this.reviewStore.requireRefinementProposal(id), files: this.reviewStore.refinementFiles(id) };
  }
  refinementApplyStatus(id: string): unknown {
    const row = this.dependencies.connection().prepare(
      "SELECT * FROM refinement_applies WHERE refinement_proposal_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(id);
    if (!row) throw new VNextNotFoundError(`Refinement apply for ${id} was not found.`);
    return row;
  }
  continuation(id: string): unknown {
    const row = this.dependencies.connection().prepare(`
      SELECT cl.* FROM continuation_links cl JOIN refinement_applies ra ON ra.refinement_apply_id = cl.refinement_apply_id
      WHERE ra.refinement_proposal_id = ? ORDER BY cl.created_at DESC LIMIT 1
    `).get(id);
    if (!row) throw new VNextNotFoundError(`Continuation for ${id} was not found.`);
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
    if (!this.dependencies.refinementApply) throw new VNextConflictError("Refinement apply is not configured.");
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

  invalidationEvents(after: number): unknown[] { return this.dependencies.invalidations?.list(after) ?? []; }

  private requireConfigHash(expectedConfigHash: string): ReturnType<VNextProjectService["projects"]["load"]> {
    const loaded = this.dependencies.project.projects.load();
    if (loaded.configHash !== expectedConfigHash) throw new VNextConflictError("vNext Project Config optimistic hash is stale.");
    return loaded;
  }
  private saveState(states: StateDefinition[], state: StateDefinition,
    environment: EnvironmentDefinition, expectedConfigHash: string): unknown {
    return this.putEnvironment({ ...environment, states: replace(states, state) }, expectedConfigHash);
  }
  private changed(kind: VNextInvalidationKind, entityId?: string): void {
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
    throw new VNextConflictError(`${label} reorder must contain every current ID exactly once.`);
  }
};
const directionValues = (
  config: ProjectConfigurationV20, kind: Exclude<VNextDocumentKind, "instruction" | "skill">
) => kind === "goal" ? config.direction.goals : kind === "adr" ? config.direction.adrs
  : kind === "constraint" ? config.direction.constraints : config.direction.useCases;

// Kept lazy to avoid a runtime cycle through the project service's type-only dependencies.
const requireIndex = (): typeof VNextReferenceIndex => VNextReferenceIndex;

export type { DirectionValue };
