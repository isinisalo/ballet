import type { Agent } from "../domain/agents.js";
import type {
  ProjectAction,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectPolicy,
  ProjectTrigger,
  ProjectWorkflow,
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

export type AgentDto = Agent;
export type AdrDto = Adr;
export type EventDefinitionDto = EventDefinition;
export type EventIntakeRequest = Omit<Partial<EventRecord>, "id" | "createdAt" | "status"> & Pick<EventRecord, "projectId" | "eventType">;
export type EventRecordDto = EventRecord;
export type GoalDto = Goal;
export type MarkdownDocumentDto = MarkdownDocument;
export type PolicyDto = Policy;
export type ProjectActionDto = ProjectAction;
export type ProjectAutomationConfigDto = ProjectAutomationConfig;
export type ProjectAutomationIssueDto = ProjectAutomationIssue;
export type ProjectDocumentCreateRequest = { directoryPath: string; title: string };
export type ProjectDocumentSaveRequest = Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;
export type ProjectDocumentTreeNodeDto = ProjectDocumentTreeNode;
export type ProjectDto = Project;
export type ProjectPolicyDto = ProjectPolicy;
export type ProjectRuntimeDto = ProjectRuntime;
export type ProjectTriggerDto = ProjectTrigger;
export type ProjectWorkflowDto = ProjectWorkflow;
export type RuntimeDto = Runtime;
export type RunDto = AgentRun;
export type SkillDto = Skill;

export interface WorkspaceDataDto {
  projects: ProjectDto[];
  goals: GoalDto[];
  adrs: AdrDto[];
  agents: AgentDto[];
  skills: SkillDto[];
  runtimes: RuntimeDto[];
  policies: PolicyDto[];
  eventDefinitions: EventDefinitionDto[];
  events: EventRecordDto[];
  agentRuns: RunDto[];
  automation: ProjectAutomationConfigDto;
  automationIssues: ProjectAutomationIssueDto[];
  projectDocumentTree?: ProjectDocumentTreeNodeDto[];
  documents?: {
    project: MarkdownDocumentDto[];
    goals: MarkdownDocumentDto[];
    adr: MarkdownDocumentDto[];
    agents: MarkdownDocumentDto[];
    skills: MarkdownDocumentDto[];
    runtimes: MarkdownDocumentDto[];
    events: MarkdownDocumentDto[];
    policies: MarkdownDocumentDto[];
  };
  projectRoot?: string;
}

export type WorkspaceCollectionName = "projects" | "goals" | "adrs" | "agents" | "skills" | "runtimes" | "policies" | "events";

export type WorkspaceAutomationResponseDto = {
  config: ProjectAutomationConfigDto;
  issues: ProjectAutomationIssueDto[];
};

export type WorkspaceSaveRequestByCollection = {
  [K in WorkspaceCollectionName]: Partial<WorkspaceDataDto[K][number]>;
};

export type WorkspaceSaveResponseByCollection = {
  [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number];
};

export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

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
  ProjectPolicy,
  ProjectRuntime,
  ProjectTrigger,
  ProjectWorkflow,
  Runtime,
  Skill
};
