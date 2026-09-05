import { AuthoringController } from "./AuthoringController.js";
import { RunQueries, publicRun } from "./RunQueries.js";
import { ReviewQueries } from "./ReviewQueries.js";
import type Database from "better-sqlite3";
import type { FeedbackCategory, FeedbackTargetType } from "../../../shared/orchestration/reviews.js";
import type { TrustedHumanActor } from "../../../shared/orchestration/persistence.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import type { EnvironmentRuntimeService } from "../runtime/EnvironmentRuntimeService.js";
import type { EnvironmentRunPlanner } from "../runtime/EnvironmentRunPlanner.js";
import { FeedbackStore } from "../persistence/FeedbackStore.js";
import { ReviewCoordinator } from "../persistence/ReviewCoordinator.js";
import { ReviewStore } from "../persistence/ReviewStore.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";
import type { CriticSchedulerService } from "../governance/CriticSchedulerService.js";
import type { FeedbackBoxService } from "../governance/FeedbackBoxService.js";
import type { GovernanceExecutionService } from "../governance/GovernanceExecutionService.js";
import type { RefinementApplyService } from "../governance/RefinementApplyService.js";
import type { ProjectDefinitionService, DirectionValue } from "../project/ProjectDefinitionService.js";
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
  readonly authoring: AuthoringController;
  readonly runQueries: RunQueries;
  readonly reviewQueries: ReviewQueries;
  private readonly reviews: ReviewCoordinator;
  private readonly reviewStore: ReviewStore;
  private readonly feedbackStore: FeedbackStore;

  constructor(private readonly dependencies: OrchestrationControllerDependencies) {
    this.authoring = new AuthoringController(dependencies, (kind, id) => this.changed(kind, id));
    this.runQueries = new RunQueries(dependencies.connection);
    this.reviewQueries = new ReviewQueries(dependencies.connection, dependencies.project.root);
    this.reviews = new ReviewCoordinator(dependencies.connection);
    this.reviewStore = new ReviewStore(dependencies.connection);
    this.feedbackStore = new FeedbackStore(dependencies.connection);
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
  async cancelRun(id: string): Promise<unknown> {
    const run = publicRun(await this.dependencies.runtime.cancel(id)); this.changed("run_changed", id); return run;
  }
  answerWorkInput(id: string, input: {
    expectedAgentRunId: string; expectedAgentRevision: number; answer: string;
  }, actor: TrustedHumanActor): unknown {
    const run = this.dependencies.runtime.answerWorkInput({ environmentRunId: id, ...input, actorId: actor.id });
    this.changed("run_changed", id); return publicRun(run);
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
  async decideRefinement(
    id: string,
    input: Omit<Parameters<ReviewCoordinator["decideRefinement"]>[1], "decidedAt">,
    actor: TrustedHumanActor
  ): Promise<void> {
    if (input.decision === "approved") await this.reviewQueries.refinementProposal(id);
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

  private changed(kind: InvalidationKind, entityId?: string): void {
    this.dependencies.invalidations?.publish(kind, this.dependencies.now(), entityId);
  }
}

export type { DirectionValue };
