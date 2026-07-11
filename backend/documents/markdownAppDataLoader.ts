import type { AppData } from "../../shared/api/workspaceData.js";
import { defaultProjectAutomationConfig } from "../../shared/domain/automation.js";
import { loadAdr, loadAgents, loadBalletProject, loadBalletProjectTree, loadGoals, loadSkills } from "../markdown.js";
import { adrFromDocument, agentFromDocument, goalFromDocument, projectFromDocument, skillDocumentFromDocument } from "./documentMappers.js";
import { buildSkillLookup } from "./skillLookup.js";

export const loadMarkdownAppData = async (root: string): Promise<AppData> => {
  const [projectDocs, projectDocumentTree, agentDocs, skillDocs, adrDocs, goalDocs] = await Promise.all([
    loadBalletProject(root),
    loadBalletProjectTree(root),
    loadAgents(root),
    loadSkills(root),
    loadAdr(root),
    loadGoals(root)
  ]);

  const projects = projectDocs.map(projectFromDocument);
  const defaultProjectId = projects[0]?.id ?? "project";
  const skills = skillDocs.map(skillDocumentFromDocument);
  const skillLookup = buildSkillLookup(skills);
  const agents = agentDocs.map((doc) => agentFromDocument(doc, skillLookup));

  return {
    projectRoot: root,
    projects,
    goals: goalDocs.map((doc) => goalFromDocument(doc, defaultProjectId)),
    adrs: adrDocs.map((doc) => adrFromDocument(doc, defaultProjectId)),
    agents,
    skills,
    policies: [],
    eventDefinitions: [],
    events: [],
    loopRuns: [],
    automation: defaultProjectAutomationConfig(),
    automationIssues: [],
    projectDocumentTree,
    documents: {
      project: projectDocs,
      agents: agentDocs,
      skills: skillDocs,
      adr: adrDocs,
      goals: goalDocs,
      events: [],
      policies: []
    }
  };
};
