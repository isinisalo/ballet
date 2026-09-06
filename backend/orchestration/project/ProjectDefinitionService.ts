import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { GovernanceAgentId } from "../../../shared/orchestration/environment.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import type { ProjectDefinition, ProjectDefinitionPort } from "../runtime/EnvironmentRunPlanner.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { ProjectConfigurationRepository } from "./ProjectConfigurationRepository.js";
import { EventStormingService } from "./EventStormingService.js";
import { UserStoryService } from "./UserStoryService.js";
import { CodexAgentRepository } from "./CodexAgentRepository.js";
import { ActionAgentMutationService } from "./ActionAgentMutationService.js";

const runFile = promisify(execFile);

export class ProjectDefinitionService implements ProjectDefinitionPort {
  readonly agents: CodexAgentRepository;
  readonly actions: ActionAgentMutationService;
  readonly userStories: UserStoryService;
  readonly eventStorming: EventStormingService;

  constructor(
    readonly root: string,
    readonly projects: ProjectConfigurationRepository,
    readonly documents: ProjectDocumentRepository
  ) {
    this.agents = new CodexAgentRepository(root);
    this.actions = new ActionAgentMutationService(projects, this.agents);
    this.userStories = new UserStoryService(documents, () => projects.assertUnlocked());
    this.eventStorming = new EventStormingService(documents, () => projects.assertUnlocked());
  }

  putAgent(input: {
    id: GovernanceAgentId;
    developerInstructions: string;
    model: string;
    reasoningEffort: string;
    skillResources: string[];
    expectedConfigHash: string;
    expectedDocumentHash: string;
  }): { configHash: string; documentHash: string } {
    this.projects.assertUnlocked();
    const loaded = this.projects.load();
    if (loaded.configHash !== input.expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    const current = this.agents.require(input.id);
    if (current.contentHash !== input.expectedDocumentHash) throw new ConflictError(`Agent ${input.id} optimistic hash is stale.`);
    const config = input.id === "ballet-critic-agent"
      ? { ...loaded.config, critic: { ...loaded.config.critic, agent: { agentId: input.id, skillResources: input.skillResources } } }
      : { ...loaded.config, refinement: { ...loaded.config.refinement, agent: { agentId: input.id, skillResources: input.skillResources } } };
    const saved = this.projects.save(config, input.expectedConfigHash);
    try {
      const agent = this.agents.put(input.id, { developerInstructions: input.developerInstructions,
        model: input.model, reasoningEffort: input.reasoningEffort, expectedHash: input.expectedDocumentHash });
      return { configHash: saved.configHash, documentHash: agent.contentHash };
    } catch (error) {
      this.projects.save(loaded.config, saved.configHash);
      throw error;
    }
  }

  async load(): Promise<ProjectDefinition> {
    const loaded = this.projects.load();
    const agents = this.agents.list().map((slot) => {
      if (slot.status !== "ready" || !slot.agent || !slot.contentHash) {
        throw new ConflictError(slot.error ?? `Governance Agent ${slot.id} is not ready.`);
      }
      return { ...slot.agent, contentSha256: slot.contentHash };
    });
    const actionAgentIds = loaded.config.environment.states.flatMap((state) => state.actions.flatMap((action) => [
      action.validation.agentId, action.work.agentId
    ]));
    const actionAgents = this.agents.requireActionSet(actionAgentIds).map((slot) => ({
      ...slot.agent, contentSha256: slot.contentHash
    }));
    const resources = (["instruction", "skill"] as const).flatMap((kind) =>
      this.documents.list(kind).map(({ id, content }) => ({
        kind, id, content, relativePath: kind === "instruction"
          ? path.join(".ballet", "instructions", `${id}.md`)
          : path.join(".agents", "skills", id, "SKILL.md")
      }))
    );
    const result = await runFile("git", ["rev-parse", "HEAD"], { cwd: this.root, encoding: "utf8" });
    return {
      config: loaded.config, configSha256: loaded.configHash,
      baseCommit: result.stdout.trim(), checkoutRoot: this.root, resources,
      agents, actionAgents,
      agentDocumentHashes: Object.fromEntries([...agents, ...actionAgents].map(({ id, contentSha256 }) => [id, contentSha256]))
    };
  }
}
