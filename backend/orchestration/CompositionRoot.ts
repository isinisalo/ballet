import { randomUUID } from "node:crypto";
import { lstat, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import type Database from "better-sqlite3";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import { runGit } from "../execution/git/gitProcess.js";
import { CriticSchedulerService } from "./governance/CriticSchedulerService.js";
import { FeedbackBoxService } from "./governance/FeedbackBoxService.js";
import { GovernanceExecutionService } from "./governance/GovernanceExecutionService.js";
import { RefinementApplyService, type RefinementValidationId } from "./governance/RefinementApplyService.js";
import { ApiController } from "./http/ApiController.js";
import { createOrchestrationRouter } from "./http/createOrchestrationRouter.js";
import { InvalidationBroadcaster } from "./http/InvalidationBroadcaster.js";
import { EnvironmentRunStore } from "./persistence/EnvironmentRunStore.js";
import { ReviewStore } from "./persistence/ReviewStore.js";
import { LocalDatabase } from "./persistence/LocalDatabase.js";
import { ProjectDocumentRepository } from "./project/ProjectDocumentRepository.js";
import { ProjectConfigurationRepository } from "./project/ProjectConfigurationRepository.js";
import { ProjectDefinitionService } from "./project/ProjectDefinitionService.js";
import { planContinuationSeed } from "./runtime/ContinuationSeedPlanner.js";
import { EnvironmentRunPlanner } from "./runtime/EnvironmentRunPlanner.js";
import { EnvironmentRuntimeService } from "./runtime/EnvironmentRuntimeService.js";
import { DeterministicExecutionQueue } from "./runtime/ExecutionQueueBoundary.js";
import { LocalProviderAdapter } from "./runtime/LocalProviderAdapter.js";
import { EnvironmentWorkspaceManager } from "./runtime/EnvironmentWorkspaceManager.js";
import { isAllowedRefinementPath } from "../../shared/orchestration/refinement.js";
import { validateActionInstruction } from "../../shared/orchestration/instructionContract.js";

export interface CompositionOptions {
  context: ProjectContext;
  runtime: LocalRuntimeService;
  schedulerIntervalMs?: number;
  workerIntervalMs?: number;
}

export const createCompositionRoot = async (options: CompositionOptions) => {
  const connection = new LocalDatabase(options.context.databasePath);
  connection.connection();
  const database = () => connection.connection();
  const dataRoot = path.join(options.context.root, ".ballet");
  const projects = new ProjectConfigurationRepository(path.join(dataRoot, "project.json"), database);
  projects.load();
  const documents = new ProjectDocumentRepository(dataRoot, database);
  const project = new ProjectDefinitionService(options.context.root, projects, documents);
  const provider = new LocalProviderAdapter(options.runtime);
  const planner = new EnvironmentRunPlanner(project, provider, now);
  const environmentQueue = new DeterministicExecutionQueue();
  const governanceQueue = new DeterministicExecutionQueue();
  const nextId = (kind: string) => `${kind}:${randomUUID()}`;
  const worktrees = new EnvironmentWorkspaceManager(options.context.root, path.join(options.context.worktreesRoot, "environment"), nextId);
  const environment = new EnvironmentRuntimeService(database, environmentQueue, provider, worktrees, nextId, now);
  const feedback = new FeedbackBoxService(database);
  const scheduler = new CriticSchedulerService(database, { now }, nextId);
  const governance = new GovernanceExecutionService(
    database, governanceQueue, nextId, now, worktrees, isAllowedRefinementPath
  );
  const reviews = new ReviewStore(database);
  const refinementRoot = path.join(options.context.worktreesRoot, "refinement");
  const refinementApply = new RefinementApplyService(
    database, options.context.root, refinementRoot,
    { run: (id, worktreePath) => runRefinementValidation(id, worktreePath, options.context.root) },
    async ({ refinementProposalId, refinementApplyId, commitSha }) => {
      const worktreePath = path.join(refinementRoot, safeId(refinementApplyId));
      const proposal = reviews.requireRefinementProposal(refinementProposalId);
      const row = database().prepare(`
        SELECT rr.source_environment_run_id FROM refinement_runs rr
        WHERE rr.refinement_run_id = ?
      `).get(String(proposal.refinement_run_id)) as { source_environment_run_id: string };
      const worktreeProject = new ProjectDefinitionService(
        worktreePath,
        new ProjectConfigurationRepository(path.join(worktreePath, ".ballet", "project.json"), database),
        new ProjectDocumentRepository(path.join(worktreePath, ".ballet"), database)
      );
      const planned = await new EnvironmentRunPlanner(worktreeProject, provider, now).plan();
      const runId = nextId("environment-run");
      const branch = (await runGit(["branch", "--show-current"], { cwd: worktreePath })).stdout.trim();
      const seed = planned.createInput({ environmentRunId: runId, worktreePath, branch, createdAt: now() });
      const source = new EnvironmentRunStore(database);
      const parent = source.require(row.source_environment_run_id);
      const parentActions = source.states(parent.environmentRunId).flatMap(({ stateExecutionId }) => source.actions(stateExecutionId));
      const impact = JSON.parse(String(proposal.impact_scope_json)) as { actionIds: string[] };
      const continuation = planContinuationSeed({
        parent, parentActions, planned: seed, targetActionId: String(proposal.target_action_id),
        impactActionIds: impact.actionIds, refinementProposalId,
        refinementApprovalId: `${refinementProposalId}:decision`, refinementCommitSha: commitSha
      });
      return { ...continuation, continuationLinkId: nextId("continuation-link"),
        continuationSnapshotHash: continuation.executionSnapshotHash };
    }, now, isAllowedRefinementPath
  );
  const invalidations = new InvalidationBroadcaster();
  const controller = new ApiController({ connection: database, project, planner, runtime: environment,
    workspace: worktrees, feedback, scheduler, governance, refinementApply, invalidations, nextId, now });
  const router = createOrchestrationRouter({ controller, actor: localActor });

  await environment.reconcile();
  await governance.reconcile();
  await configureScheduler(projects, scheduler, governance, database);
  let stopped = false;
  let pumping = false;
  const pump = async () => {
    if (stopped || pumping) return;
    pumping = true;
    try {
      while (!stopped) {
        if (await environment.processNext()) { invalidations.publish("run_changed", now()); continue; }
        if (await governance.processNext(provider)) {
          invalidations.publish("critic_changed", now());
          invalidations.publish("refinement_changed", now());
          continue;
        }
        break;
      }
    } finally { pumping = false; }
  };
  const workerTimer = setInterval(() => { void pump(); }, options.workerIntervalMs ?? 100);
  const schedulerTimer = setInterval(() => {
    if (stopped) return;
    void configureScheduler(projects, scheduler, governance, database).catch(() => undefined);
  }, options.schedulerIntervalMs ?? 60_000);
  workerTimer.unref(); schedulerTimer.unref();
  void pump();

  const shutdown = async (): Promise<void> => {
    stopped = true; clearInterval(workerTimer); clearInterval(schedulerTimer);
    await Promise.all([environment.shutdown(), governance.shutdown(provider)]);
    scheduler.shutdown();
    while (pumping) await new Promise<void>((resolve) => setTimeout(resolve, 10));
    connection.close();
  };
  return { router, controller, connection, project, environment, governance, scheduler, shutdown };
};

const configureScheduler = async (
  projects: ProjectConfigurationRepository, scheduler: CriticSchedulerService,
  governance: GovernanceExecutionService, connection: () => Database.Database
): Promise<void> => {
  let loaded: ReturnType<ProjectConfigurationRepository["loadOptional"]>;
  try { loaded = projects.loadOptional(); } catch { return; }
  if (!loaded) return;
  scheduler.configure(loaded.config.critic.schedules, loaded.config.critic.enabled);
  if (!loaded.config.critic.enabled) return;
  for (const id of scheduler.tick()) {
    const row = connection().prepare("SELECT status FROM critic_runs WHERE critic_run_id = ?").get(id) as { status: string };
    if (row.status === "queued") await governance.queueCritic(id);
  }
};

const runRefinementValidation = async (id: RefinementValidationId, worktreePath: string, sourceRoot: string): Promise<void> => {
  if (id === "instruction_contract") {
    const listed = await runGit(["ls-files", "--cached", "--others", "--exclude-standard",
      ".ballet/instructions"], { cwd: worktreePath });
    for (const relativePath of listed.stdout.split("\n").filter((item) => item.endsWith(".md"))) {
      const source = await readFile(path.join(worktreePath, relativePath), "utf8");
      const issues = validateActionInstruction(source);
      if (issues.length > 0) throw new Error(`${relativePath}: ${issues[0]!.message}`);
    }
    await runGit(["diff", "--check"], { cwd: worktreePath });
    return;
  }
  if (id === "resource_contract") {
    await runGit(["diff", "--check"], { cwd: worktreePath });
    return;
  }
  const vitest = path.join(sourceRoot, "node_modules", "vitest", "vitest.mjs");
  const nodeModules = path.join(worktreePath, "node_modules");
  const createdLink = !await lstat(nodeModules).catch(() => undefined);
  if (createdLink) await symlink(path.join(sourceRoot, "node_modules"), nodeModules, "dir");
  const { execFile } = await import("node:child_process");
  try {
    await new Promise<void>((resolve, reject) => execFile(process.execPath, [vitest, "run", "backend/orchestration"],
      { cwd: worktreePath, maxBuffer: 8 * 1024 * 1024 }, (error) => error ? reject(error) : resolve()));
  } finally {
    if (createdLink) await rm(nodeModules);
  }
};
const localActor = () => ({ id: `local-operator:${process.getuid?.() ?? "unknown"}`, source: "local_operator" as const });
const now = (): string => new Date().toISOString();
const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
