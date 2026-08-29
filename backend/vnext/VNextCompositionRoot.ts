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
import { VNextApiController } from "./http/VNextApiController.js";
import { createVNextRouter } from "./http/createVNextRouter.js";
import { VNextInvalidationBroadcaster } from "./http/VNextInvalidationBroadcaster.js";
import { EnvironmentRunStore } from "./persistence/EnvironmentRunStore.js";
import { ReviewStore } from "./persistence/ReviewStore.js";
import { VNextConnection } from "./persistence/VNextConnection.js";
import { VNextMarkdownRepository } from "./project/VNextMarkdownRepository.js";
import { VNextProjectRepository } from "./project/VNextProjectRepository.js";
import { VNextProjectService } from "./project/VNextProjectService.js";
import { planContinuationSeed } from "./runtime/ContinuationSeedPlanner.js";
import { EnvironmentRunPlanner } from "./runtime/EnvironmentRunPlanner.js";
import { EnvironmentRuntimeService } from "./runtime/EnvironmentRuntimeService.js";
import { DeterministicExecutionQueue } from "./runtime/ExecutionQueueBoundary.js";
import { LocalVNextProviderAdapter } from "./runtime/LocalVNextProviderAdapter.js";
import { VNextWorkspaceManager } from "./runtime/VNextWorkspaceManager.js";
import { isAllowedVNextRefinementPath } from "../../shared/vnext/refinement.js";
import { validateActionInstruction } from "../../shared/vnext/instructionContract.js";

export interface VNextCompositionOptions {
  context: ProjectContext;
  runtime: LocalRuntimeService;
  schedulerIntervalMs?: number;
  workerIntervalMs?: number;
}

export const createVNextCompositionRoot = async (options: VNextCompositionOptions) => {
  const stateRoot = path.join(options.context.stateRoot, "vnext");
  const connection = new VNextConnection(path.join(stateRoot, "state.sqlite"));
  connection.connection();
  const database = () => connection.connection();
  const dataRoot = path.join(options.context.root, ".ballet", "vnext");
  const projects = new VNextProjectRepository(path.join(dataRoot, "project.json"), database);
  const documents = new VNextMarkdownRepository(dataRoot, database);
  const project = new VNextProjectService(options.context.root, projects, documents);
  const provider = new LocalVNextProviderAdapter(options.runtime);
  const planner = new EnvironmentRunPlanner(project, provider, now);
  const environmentQueue = new DeterministicExecutionQueue();
  const governanceQueue = new DeterministicExecutionQueue();
  const nextId = (kind: string) => `${kind}:${randomUUID()}`;
  const worktrees = new VNextWorkspaceManager(options.context.root, path.join(stateRoot, "worktrees"), nextId);
  const environment = new EnvironmentRuntimeService(database, environmentQueue, provider, worktrees, nextId, now);
  const feedback = new FeedbackBoxService(database);
  const scheduler = new CriticSchedulerService(database, { now }, nextId);
  const governance = new GovernanceExecutionService(
    database, governanceQueue, nextId, now, worktrees, isAllowedVNextRefinementPath
  );
  const reviews = new ReviewStore(database);
  const refinementRoot = path.join(stateRoot, "refinement-worktrees");
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
      const worktreeProject = new VNextProjectService(
        worktreePath,
        new VNextProjectRepository(path.join(worktreePath, ".ballet", "vnext", "project.json"), database),
        new VNextMarkdownRepository(path.join(worktreePath, ".ballet", "vnext"), database)
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
    }, now, isAllowedVNextRefinementPath
  );
  const invalidations = new VNextInvalidationBroadcaster();
  const controller = new VNextApiController({ connection: database, project, planner, runtime: environment,
    workspace: worktrees, feedback, scheduler, governance, refinementApply, invalidations, nextId, now });
  const router = createVNextRouter({ controller, actor: localActor });

  environment.reconcile();
  governance.reconcile();
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
  projects: VNextProjectRepository, scheduler: CriticSchedulerService,
  governance: GovernanceExecutionService, connection: () => Database.Database
): Promise<void> => {
  let loaded: ReturnType<VNextProjectRepository["loadOptional"]>;
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
      ".ballet/vnext/instructions"], { cwd: worktreePath });
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
    await new Promise<void>((resolve, reject) => execFile(process.execPath, [vitest, "run", "backend/vnext"],
      { cwd: worktreePath, maxBuffer: 8 * 1024 * 1024 }, (error) => error ? reject(error) : resolve()));
  } finally {
    if (createdLink) await rm(nodeModules);
  }
};
const localActor = () => ({ id: `local-operator:${process.getuid?.() ?? "unknown"}`, source: "local_operator" as const });
const now = (): string => new Date().toISOString();
const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
