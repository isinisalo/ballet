export type ProjectConfigChangeStatus = "added" | "modified" | "deleted" | "renamed" | "untracked";

export interface ProjectConfigChange {
  path: string;
  status: ProjectConfigChangeStatus;
}

export interface ProjectConfigStatus {
  clean: boolean;
  changes: ProjectConfigChange[];
}
