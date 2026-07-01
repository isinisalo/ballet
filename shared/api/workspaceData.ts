import type { Agent } from "../domain/agents.js";
import type { ProjectAutomationConfig, ProjectAutomationIssue, Policy } from "../domain/automation.js";
import type { Adr, Goal, MarkdownDocument, Project, ProjectDocumentTreeNode, Skill } from "../domain/documents.js";
import type { EventDefinition, EventRecord } from "../domain/events.js";
import type { AgentRun, Runtime } from "../domain/runtime.js";

export interface AppData {
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

export type CollectionName = "projects" | "goals" | "adrs" | "agents" | "skills" | "runtimes" | "policies" | "events";
