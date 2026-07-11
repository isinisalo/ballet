export interface DaemonServerContract {
  heartbeat: string;
  diagnostics: string;
  claim: string;
  websocket: string;
  taskLease(taskId: string): string;
  taskState(taskId: string): string;
  taskEvents(taskId: string): string;
  taskComplete(taskId: string): string;
  taskCancel(taskId: string): string;
  taskFail(taskId: string): string;
  rootFinalize(rootRunId: string): string;
}

export const defaultDaemonServerContract: DaemonServerContract = {
  heartbeat: "/api/daemon/heartbeat",
  diagnostics: "/api/daemon/diagnostics",
  claim: "/api/daemon/tasks/claim",
  websocket: "/api/daemon/ws",
  taskLease: (taskId) => `/api/daemon/tasks/${encodeURIComponent(taskId)}/lease`,
  taskState: (taskId) => `/api/daemon/tasks/${encodeURIComponent(taskId)}/state`,
  taskEvents: (taskId) => `/api/daemon/tasks/${encodeURIComponent(taskId)}/events`,
  taskComplete: (taskId) => `/api/daemon/tasks/${encodeURIComponent(taskId)}/complete`,
  taskCancel: (taskId) => `/api/daemon/tasks/${encodeURIComponent(taskId)}/cancel`,
  taskFail: (taskId) => `/api/daemon/tasks/${encodeURIComponent(taskId)}/fail`,
  rootFinalize: (rootRunId) => `/api/daemon/root-runs/${encodeURIComponent(rootRunId)}/finalize`
};
