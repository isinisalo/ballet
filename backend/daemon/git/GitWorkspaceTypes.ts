export interface PrepareGitWorkspaceRequest {
  executionId: string;
  rootRunId: string;
  projectId: string;
  repositoryUrl: string;
  headSha: string;
  expectedSnapshotHash: string;
}

export interface PreparedGitWorkspace {
  executionId: string;
  rootRunId: string;
  projectId: string;
  repositoryUrl: string;
  mode: "managed-worktree";
  path: string;
  headSha: string;
  treeSha: string;
  snapshotHash: string;
  branch: string;
  repositoryPath: string;
  lockPath: string;
}

export interface FinalizedGitWorkspace {
  success: boolean;
  retained: boolean;
  branch: string;
  worktreePath: string;
  commitSha?: string;
  changedFiles: string[];
  snapshotHash: string;
}

export interface ManagedRunState {
  version: 1;
  rootRunId: string;
  projectId: string;
  repositoryUrl: string;
  branch: string;
  worktreePath: string;
  baseHeadSha: string;
  treeSha: string;
  snapshotHash: string;
}

export interface GitCheckoutStatus {
  root: string;
  headSha: string;
  branch?: string;
  dirtyPaths: string[];
  ignoredRuntimePaths: string[];
  codeDirty: boolean;
}
