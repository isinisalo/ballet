import type { Agent } from "../domain/agents.js";
import type {
  ProjectAction,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectHumanGateResponse,
  ProjectOutputRoute,
  ProjectLoop,
  Policy
} from "../domain/automation.js";
import type {
  Adr,
  Goal,
  MarkdownDocument,
  Project,
  ProjectDocumentTreeNode,
  Skill
} from "../domain/documents.js";
import type { EventDefinition, EventRecord } from "../domain/events.js";
import type { AgentRun, ProjectRuntime, Runtime } from "../domain/runtime.js";

export type EventIntakeRequest = Omit<Partial<EventRecord>, "id" | "createdAt" | "status"> & Pick<EventRecord, "projectId" | "eventType">;
export type ProjectDocumentCreateRequest = { directoryPath: string; title: string };
export type ProjectDocumentSaveRequest = Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;

export interface WorkspaceDataDto {
  projects: Project[];
  goals: Goal[];
  adrs: Adr[];
  agents: Agent[];
  skills: Skill[];
  runtimes: Runtime[];
  policies: Policy[];
  eventDefinitions: EventDefinition[];
  events: EventRecord[];
  agentRuns: AgentRun[];
  automation: ProjectAutomationConfig;
  automationIssues: ProjectAutomationIssue[];
  projectDocumentTree?: ProjectDocumentTreeNode[];
  documents?: {
    project: MarkdownDocument[];
    goals: MarkdownDocument[];
    adr: MarkdownDocument[];
    agents: MarkdownDocument[];
    skills: MarkdownDocument[];
    runtimes: MarkdownDocument[];
    events: MarkdownDocument[];
    policies: MarkdownDocument[];
  };
  projectRoot?: string;
}

export type WorkspaceCollectionName = "projects" | "goals" | "adrs" | "agents" | "skills" | "runtimes" | "policies" | "events";

export type WorkspaceAutomationResponseDto = {
  config: ProjectAutomationConfig;
  issues: ProjectAutomationIssue[];
};

export type WorkspaceSaveRequestByCollection = {
  [K in WorkspaceCollectionName]: Partial<WorkspaceDataDto[K][number]>;
};

export type WorkspaceSaveResponseByCollection = {
  [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number];
};

export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

export { defaultProjectAutomationConfig } from "../domain/automation.js";

export type {
  Agent,
  Adr,
  EventDefinition,
  EventRecord,
  Goal,
  MarkdownDocument,
  Policy,
  Project,
  ProjectAction,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectDocumentTreeNode,
  ProjectHumanGateResponse,
  ProjectOutputRoute,
  ProjectRuntime,
  ProjectLoop,
  Runtime,
  Skill
};
