import type Database from "better-sqlite3";
import type { AgentComposition } from "../../../shared/orchestration/environment.js";
import type { ExecutionSpecV12 } from "../../../shared/orchestration/execution.js";
import type { CriticOutcome, RefinementOutcome } from "../../../shared/orchestration/outcomes.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import type { StoredEnvironmentRun } from "../../../shared/orchestration/persistenceRecords.js";
import type { TaskEnvelopeV10 } from "../../../shared/orchestration/taskEnvelopes.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { ReviewCoordinator } from "../persistence/ReviewCoordinator.js";
import { refinementChangeListHash } from "../persistence/ReviewStore.js";
import { AgentExecutionStore } from "../persistence/AgentExecutionStore.js";
import type { ExecutionQueueBoundary } from "../runtime/ExecutionQueueBoundary.js";
import { composeOrchestrationPrompt } from "../runtime/PromptComposer.js";
import { parseOrchestrationStructuredOutput } from "../runtime/StructuredOutputValidator.js";
import type { OrchestrationRuntimeProvider } from "../runtime/RuntimeProvider.js";
import { mapProviderPermissions } from "../runtime/ProviderPermissions.js";
import { buildCriticEnvelope, buildRefinementEnvelope } from "./GovernanceEnvelopeBuilder.js";
import { isAllowedCanonicalRefinementPath } from "../../../shared/orchestration/refinement.js";

export class GovernanceExecutionService {
  private readonly execution: AgentExecutionStore;
  private readonly runs: EnvironmentRunStore;
  private readonly reviews: ReviewCoordinator;
  private activeTaskId?: string;
  private stopping = false;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly queue: ExecutionQueueBoundary,
    private readonly nextId: (kind: string) => string,
    private readonly now: () => string,
    private readonly workspaces: GovernanceWorkspaceBoundary = passthroughGovernanceWorkspace,
    private readonly allowedRefinementPath: (relativePath: string) => boolean = isAllowedCanonicalRefinementPath
  ) {
    this.execution = new AgentExecutionStore(connection);
    this.runs = new EnvironmentRunStore(connection);
    this.reviews = new ReviewCoordinator(connection);
  }

  async queueCritic(criticRunId: string): Promise<string> {
    const row = this.connection().prepare(`
      SELECT cr.product_snapshot_id, ps.environment_run_id, ps.result_commit FROM critic_runs cr
      JOIN product_snapshots ps ON ps.product_snapshot_id = cr.product_snapshot_id
      WHERE cr.critic_run_id = ? AND cr.status = 'queued'
    `).get(criticRunId) as { environment_run_id: string; result_commit: string } | undefined;
    if (!row) throw new Error(`Critic Run ${criticRunId} is not queueable.`);
    const run = this.runs.require(row.environment_run_id);
    const taskId = this.nextId("critic-task");
    const checkoutRoot = await this.workspaces.prepareReadOnly(taskId, row.result_commit, run.worktreePath);
    try {
      const envelope = buildCriticEnvelope({ connection: this.connection(), criticRunId, taskId, snapshotSha256: run.executionSnapshotHash });
      return this.persistGovernanceDispatch(run, run.executionSnapshot.governance.critic, envelope, { criticRunId }, checkoutRoot);
    } catch (error) { await this.workspaces.releaseReadOnly(taskId); throw error; }
  }

  async queueRefinement(refinementRunId: string): Promise<string> {
    const row = this.connection().prepare(`
      SELECT source_environment_run_id FROM refinement_runs WHERE refinement_run_id = ? AND status = 'queued'
    `).get(refinementRunId) as { source_environment_run_id: string } | undefined;
    if (!row) throw new Error(`Refinement Run ${refinementRunId} is not queueable.`);
    const run = this.runs.require(row.source_environment_run_id);
    const taskId = this.nextId("refinement-task");
    const checkoutRoot = await this.workspaces.prepareReadOnly(taskId, run.resultCommit ?? run.baseCommit, run.worktreePath);
    try {
      const envelope = buildRefinementEnvelope({ connection: this.connection(), refinementRunId, taskId, snapshotSha256: run.executionSnapshotHash });
      return this.persistGovernanceDispatch(run, run.executionSnapshot.governance.refinement, envelope, { refinementRunId }, checkoutRoot);
    } catch (error) { await this.workspaces.releaseReadOnly(taskId); throw error; }
  }

  async reconcile(): Promise<number> {
    this.execution.recoverAfterRestart(this.now());
    this.connection().prepare(`
      UPDATE critic_runs SET status = 'queued', agent_run_id = NULL, updated_at = ?
      WHERE status = 'running' AND NOT EXISTS (
        SELECT 1 FROM agent_runs agent JOIN execution_tasks task ON task.agent_run_id = agent.agent_run_id
        WHERE agent.critic_run_id = critic_runs.critic_run_id
          AND agent.status IN ('queued','running') AND task.status IN ('queued','running','succeeded','failed')
      )
    `).run(this.now());
    this.connection().prepare(`
      UPDATE refinement_runs SET status = 'queued', agent_run_id = NULL, updated_at = ?
      WHERE status = 'running' AND NOT EXISTS (
        SELECT 1 FROM agent_runs agent JOIN execution_tasks task ON task.agent_run_id = agent.agent_run_id
        WHERE agent.refinement_run_id = refinement_runs.refinement_run_id
          AND agent.status IN ('queued','running') AND task.status IN ('queued','running','succeeded','failed')
      )
    `).run(this.now());
    let count = 0;
    for (const task of this.execution.recoverableTasks().filter(({ spec }) => ["critic", "refinement"].includes(spec.evidence.role))) {
      if (!this.queue.has(task.taskId)) { this.queue.enqueue(task.taskId); count += 1; }
    }
    const critics = this.connection().prepare(`
      SELECT critic_run_id FROM critic_runs WHERE status = 'queued' AND agent_run_id IS NULL ORDER BY created_at
    `).all() as Array<{ critic_run_id: string }>;
    for (const { critic_run_id } of critics) { await this.queueCritic(critic_run_id); count += 1; }
    const refinements = this.connection().prepare(`
      SELECT refinement_run_id FROM refinement_runs WHERE status = 'queued' AND agent_run_id IS NULL ORDER BY created_at
    `).all() as Array<{ refinement_run_id: string }>;
    for (const { refinement_run_id } of refinements) { await this.queueRefinement(refinement_run_id); count += 1; }
    return count;
  }

  async processNext(provider: OrchestrationRuntimeProvider): Promise<boolean> {
    if (this.stopping) return false;
    const taskId = this.queue.next();
    if (!taskId) return false;
    const task = this.execution.requireTask(taskId);
    if (["succeeded", "failed"].includes(task.status)) {
      this.applyPersistedTerminal(task);
      return true;
    }
    if (task.status !== "queued" || !this.execution.claimTask(taskId, this.now())) return true;
    this.activeTaskId = taskId;
    try {
      const terminal = await provider.execute(task.spec, mapProviderPermissions({
        provider: task.spec.runtime.provider, role: task.spec.evidence.role,
        toolPolicy: "read_only", networkAccess: task.spec.runtime.networkAccess,
        worktreePath: task.spec.project.checkoutRoot
      }));
      if (this.stopping) return true;
      this.applyProviderOutput(taskId, terminal.providerOutcomeKey,
        terminal.kind === "output" ? terminal.raw : JSON.stringify({ providerFailure: terminal.errorMessage }));
      return true;
    } finally {
      this.activeTaskId = undefined;
      await this.workspaces.releaseReadOnly(taskId);
    }
  }

  async shutdown(provider: OrchestrationRuntimeProvider): Promise<void> {
    this.stopping = true;
    if (this.activeTaskId) await provider.cancel?.(this.activeTaskId, "Ballet orchestration is shutting down.");
    this.connection().transaction(() => {
      this.connection().prepare(`
        UPDATE execution_tasks SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE role IN ('critic','refinement') AND status IN ('queued','running')
      `).run(this.now(), this.now());
      this.connection().prepare(`
        UPDATE agent_runs SET status = 'interrupted', revision = revision + 1, completed_at = ?, updated_at = ?
        WHERE role IN ('critic','refinement') AND status IN ('queued','running')
      `).run(this.now(), this.now());
      this.connection().prepare("UPDATE refinement_runs SET status = 'queued', updated_at = ? WHERE status = 'running'")
        .run(this.now());
    })();
  }

  applyProviderOutput(taskId: string, providerOutcomeKey: string, raw: string): "proposal" | "completed" | "failed" {
    const task = this.execution.requireTask(taskId);
    const agent = this.execution.requireAgent(task.agentRunId);
    if (!agent.criticRunId && !agent.refinementRunId) throw new Error("Task is not a governance proposal task.");
    const at = this.now();
    const parsed = parseOrchestrationStructuredOutput(raw, { role: agent.role, phase: agent.phase });
    if (!parsed.success || (parsed.outcome.role !== "critic" && parsed.outcome.role !== "refinement")) {
      this.execution.finishTask(taskId, providerOutcomeKey, "failed", {
        errorCode: "invalid_structured_output", errorMessage: parsed.success ? "Wrong governance role." : parsed.error
      }, at);
      this.execution.failAgent(agent.agentRunId, providerOutcomeKey, "invalid_structured_output",
        parsed.success ? "Wrong governance role." : parsed.error, at);
      this.failGovernanceRun(agent.criticRunId, agent.refinementRunId, at);
      return "failed";
    }
    this.execution.finishTask(taskId, providerOutcomeKey, "succeeded", { outcome: parsed.outcome }, at);
    this.execution.completeAgent(agent.agentRunId, providerOutcomeKey, parsed.outcome, at);
    if (parsed.outcome.role === "critic") return this.applyCritic(agent.criticRunId!, parsed.outcome, at);
    this.applyRefinement(agent.refinementRunId!, parsed.outcome, at);
    return "proposal";
  }

  private applyPersistedTerminal(task: ReturnType<AgentExecutionStore["requireTask"]>): void {
    const agent = this.execution.requireAgent(task.agentRunId);
    if (!task.providerOutcomeKey) throw new Error(`Governance task ${task.taskId} lacks a provider outcome key.`);
    const at = this.now();
    if (task.status === "failed") {
      this.execution.failAgent(agent.agentRunId, task.providerOutcomeKey,
        task.errorCode ?? "provider_failure", task.errorMessage ?? "Provider failed.", at);
      this.failGovernanceRun(agent.criticRunId, agent.refinementRunId, at);
      return;
    }
    if (!task.outcome || (Reflect.get(task.outcome as object, "role") !== "critic"
      && Reflect.get(task.outcome as object, "role") !== "refinement")) {
      throw new Error(`Governance task ${task.taskId} lacks its persisted role outcome.`);
    }
    const outcome = task.outcome as CriticOutcome | RefinementOutcome;
    this.execution.completeAgent(agent.agentRunId, task.providerOutcomeKey, outcome, at);
    if (outcome.role === "critic") this.applyCritic(agent.criticRunId!, outcome, at);
    else this.applyRefinement(agent.refinementRunId!, outcome, at);
  }

  private persistGovernanceDispatch(
    run: StoredEnvironmentRun,
    composition: AgentComposition,
    envelope: TaskEnvelopeV10,
    owner: { criticRunId?: string; refinementRunId?: string },
    checkoutRoot: string
  ): string {
    if (composition.toolPolicy !== "read_only") throw new Error("Governance proposal Agent must be read-only.");
    const profile = run.executionSnapshot.executionProfiles.find(({ id }) => id === composition.executionProfileId)!;
    const capability = run.executionSnapshot.runtimeCapabilities.find(({ executionProfileId }) => executionProfileId === profile.id)!;
    const agentRunId = this.nextId(`${envelope.role}-agent`);
    const evidence = composeOrchestrationPrompt({ snapshot: run.executionSnapshot, envelope, composition });
    const spec: ExecutionSpecV12 = {
      version: 12, taskId: envelope.taskId, kind: "agent_execution", environmentRunId: run.environmentRunId,
      agentRunId, evidence,
      runtime: { provider: profile.provider, cliVersion: capability.cliVersion, model: profile.model,
        reasoningEffort: profile.reasoningEffort, networkAccess: profile.networkAccess, capabilityHash: capability.capabilitySha256 },
      project: { checkoutRoot, headSha: run.resultCommit ?? run.baseCommit,
        configHash: run.executionSnapshot.projectConfigSha256, snapshotHash: run.executionSnapshotHash },
      createdAt: this.now()
    };
    this.connection().transaction(() => {
      this.execution.createAgent({
        agentRunId, environmentRunId: run.environmentRunId, ...owner,
        role: envelope.role, phase: "proposal", attempt: 1, taskEnvelope: envelope,
        taskEnvelopeHash: hash(envelope), createdAt: spec.createdAt
      });
      this.execution.createTask({ spec, specHash: hash(spec) });
      const table = owner.criticRunId ? "critic_runs" : "refinement_runs";
      const key = owner.criticRunId ? "critic_run_id" : "refinement_run_id";
      const id = owner.criticRunId ?? owner.refinementRunId!;
      this.connection().prepare(`UPDATE ${table} SET agent_run_id = ?, status = 'running', updated_at = ? WHERE ${key} = ?`)
        .run(agentRunId, spec.createdAt, id);
    })();
    this.queue.enqueue(spec.taskId);
    return spec.taskId;
  }

  private applyCritic(criticRunId: string, outcome: CriticOutcome, at: string): "proposal" | "completed" {
    if (!outcome.proposal) {
      this.connection().prepare(`UPDATE critic_runs SET status = 'completed', completed_at = ?, updated_at = ? WHERE critic_run_id = ?`)
        .run(at, at, criticRunId);
      return "completed";
    }
    this.reviews.createCriticProposal({
      criticProposalId: outcome.proposal.proposalId, criticRunId,
      content: json(outcome.proposal), contentHash: hash(outcome.proposal),
      targetType: outcome.proposal.targetType, targetId: outcome.proposal.targetId,
      category: outcome.proposal.category, createdAt: at
    });
    return "proposal";
  }

  private applyRefinement(refinementRunId: string, outcome: RefinementOutcome, at: string): void {
    if (outcome.files.some(({ relativePath }) => !this.allowedRefinementPath(relativePath))) {
      this.failGovernanceRun(undefined, refinementRunId, at);
      throw new Error("Refinement outcome contains a path outside this composition namespace.");
    }
    const selectedFeedback = (this.connection().prepare(`
      SELECT feedback_entry_id FROM refinement_run_feedback WHERE refinement_run_id = ? ORDER BY feedback_entry_id
    `).all(refinementRunId) as Array<{ feedback_entry_id: string }>).map(({ feedback_entry_id }) => feedback_entry_id);
    if (JSON.stringify(selectedFeedback) !== JSON.stringify([...outcome.feedbackIds].sort())) {
      throw new Error("Refinement outcome Feedback IDs differ from the human-selected set.");
    }
    const source = this.connection().prepare(`
      SELECT er.base_commit, er.result_commit FROM refinement_runs rr
      JOIN environment_runs er ON er.environment_run_id = rr.source_environment_run_id
      WHERE rr.refinement_run_id = ?
    `).get(refinementRunId) as { base_commit: string; result_commit: string | null };
    const proposal = {
      refinementProposalId: outcome.proposalId, refinementRunId, targetActionId: outcome.targetActionId,
      expectedBaseCommit: source.result_commit ?? source.base_commit,
      impactScope: { actionIds: [...outcome.impactedActionIds].sort() }, changeListHash: "",
      expectedBehavioralImprovement: outcome.expectedBehavioralImprovement, risks: outcome.risks,
      validationPlan: outcome.validationPlan, rollback: outcome.rollback,
      files: outcome.files.map((file) => ({
        operation: file.operation, relativePath: file.relativePath, expectedPreimageHash: file.preimageSha256,
        proposedContentHash: file.proposedContentSha256, proposedContent: file.proposedContent,
        rationale: file.rationale, resourceId: file.resourceId
      })),
      createdAt: at
    };
    proposal.changeListHash = refinementChangeListHash(proposal);
    this.reviews.createRefinementProposal(proposal);
  }

  private failGovernanceRun(criticRunId: string | undefined, refinementRunId: string | undefined, at: string): void {
    if (criticRunId) this.connection().prepare(`UPDATE critic_runs SET status = 'failed', completed_at = ?, updated_at = ? WHERE critic_run_id = ?`)
      .run(at, at, criticRunId);
    if (refinementRunId) this.connection().prepare(`UPDATE refinement_runs SET status = 'failed', completed_at = ?, updated_at = ? WHERE refinement_run_id = ?`)
      .run(at, at, refinementRunId);
  }
}

export interface GovernanceWorkspaceBoundary {
  prepareReadOnly(taskId: string, commitSha: string, fallbackPath: string): Promise<string>;
  releaseReadOnly(taskId: string): Promise<void>;
}

const passthroughGovernanceWorkspace: GovernanceWorkspaceBoundary = {
  prepareReadOnly: async (_taskId, _commitSha, fallbackPath) => fallbackPath,
  releaseReadOnly: async () => undefined
};

const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
const hash = (value: unknown): string => sha256(canonicalJson(json(value)));
