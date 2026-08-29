import { v4 as uuid } from "uuid";
import type { RunEvidenceSeed } from "../../../shared/orchestration/persistence.js";
import type { StoredEnvironmentRun } from "../../../shared/orchestration/persistenceRecords.js";
import type { RootFinalizationReport } from "../../../shared/domain/runtime.js";
import type { ControlPlaneService } from "../../control-plane/ControlPlaneService.js";
import { runGit } from "../../execution/git/gitProcess.js";
import type { OrchestrationWorkspacePort } from "../http/ApiController.js";
import type { RunEvidenceFinalizationPort } from "./EnvironmentRuntimeService.js";
import { daemonRootRunId } from "./DaemonOrchestrationProvider.js";

const ROOT_FINALIZATION_TIMEOUT_MS = 5 * 60_000;

export class DaemonEnvironmentWorkspace implements OrchestrationWorkspacePort, RunEvidenceFinalizationPort {
  constructor(
    private readonly root: string,
    private readonly projectId: string,
    private readonly controlPlane: ControlPlaneService
  ) {}

  async prepare(runId: string, expectedBaseCommit?: string): Promise<{ worktreePath: string; branch: string }> {
    const status = (await runGit(["status", "--porcelain=v1"], { cwd: this.root })).stdout.trim();
    if (status) throw new Error("Commit or stash project changes before starting an immutable Environment Run.");
    const head = (await runGit(["rev-parse", "HEAD"], { cwd: this.root })).stdout.trim();
    if (expectedBaseCommit && expectedBaseCommit !== head) throw new Error("Project HEAD changed after immutable Environment planning.");
    const rootRunId = daemonRootRunId(runId);
    return { worktreePath: `/ballet-managed/${rootRunId}`, branch: `ballet/run/${rootRunId.slice(0, 12)}` };
  }

  async discard(): Promise<void> { /* Failed roots remain daemon-managed for diagnosis. */ }

  async finalize(run: StoredEnvironmentRun, at: string): Promise<RunEvidenceSeed> {
    const rootRunId = daemonRootRunId(run.environmentRunId);
    const deviceId = run.executionSnapshot.runtimeCapabilities[0]?.deviceId;
    const agentId = run.executionSnapshot.runtimeCapabilities[0]?.agentId;
    if (!deviceId || !agentId) throw new Error("Environment Run lacks a daemon runtime snapshot.");
    const preflight = this.controlPlane.preflightAgent(agentId);
    if (!preflight.project) throw new Error("Daemon project snapshot is unavailable during finalization.");
    this.controlPlane.requestRootFinalization({
      projectId: this.projectId, deviceId, rootRunId, success: true, snapshotHash: preflight.project.snapshotHash
    });
    const report = await waitForReport(this.controlPlane, rootRunId);
    if (!report.success || report.retained || !report.commitSha) throw new Error("Daemon did not complete successful worktree finalization.");
    return {
      runEvidenceId: `run-evidence:${uuid()}`, environmentRunId: run.environmentRunId,
      branch: report.branch, worktreePath: report.worktreePath, baseCommit: run.baseCommit,
      resultCommit: report.commitSha, changedFiles: [...report.changedFiles].sort(), artifactRefs: [],
      resourceHashes: Object.fromEntries(run.executionSnapshot.resources.map(({ id, sourceSha256 }) => [id, sourceSha256])),
      definitionHashes: Object.fromEntries([[run.executionSnapshot.environment.id, run.executionSnapshot.environmentSha256]]),
      validationSummary: { completedActions: run.executionSnapshot.environment.states.reduce((total, state) => total + state.actions.length, 0) },
      createdAt: at
    };
  }

  async cleanup(): Promise<void> { /* Successful cleanup is completed and attested by the daemon. */ }
}

const waitForReport = (service: ControlPlaneService, rootRunId: string): Promise<RootFinalizationReport> => new Promise((resolve, reject) => {
  let settled = false;
  const cleanup = (): void => { clearTimeout(timer); unsubscribe(); };
  const settle = (): boolean => {
    const report = service.rootFinalizationReport(rootRunId);
    if (!report) return false;
    settled = true; cleanup(); resolve(report); return true;
  };
  const unsubscribe = service.onChange((type, payload) => { if (type === "root_finalized" && payload.rootRunId === rootRunId) settle(); });
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true; cleanup(); reject(new Error(`Daemon did not finalize root Run ${rootRunId} within five minutes.`));
  }, ROOT_FINALIZATION_TIMEOUT_MS);
  settle();
});
