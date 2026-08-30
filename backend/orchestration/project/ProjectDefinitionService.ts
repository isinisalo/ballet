import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { Constraint, DirectionReference, UseCase } from "../../../shared/orchestration/direction.js";
import { approveUseCase, invalidateUseCaseApproval, useCaseApprovalHash } from "../../../shared/orchestration/direction.js";
import type { AgentDefinition, ProjectConfigurationV22 } from "../../../shared/orchestration/environment.js";
import type { TrustedHumanActor } from "../../../shared/orchestration/persistence.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";
import type { ProjectDefinition, ProjectDefinitionPort } from "../runtime/EnvironmentRunPlanner.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { ProjectConfigurationRepository } from "./ProjectConfigurationRepository.js";
import { ProjectReferenceIndex, type ProjectDocumentKind } from "./ProjectReferenceIndex.js";

const runFile = promisify(execFile);
export type DirectionValue = DirectionReference | Constraint | UseCase;

export class ProjectDefinitionService implements ProjectDefinitionPort {
  constructor(
    readonly root: string,
    readonly projects: ProjectConfigurationRepository,
    readonly documents: ProjectDocumentRepository
  ) {}

  putDirection(input: {
    kind: Exclude<ProjectDocumentKind, "instruction" | "skill">;
    id: string;
    value: DirectionValue;
    markdown: string;
    expectedConfigHash: string;
    expectedDocumentHash: string | "absent";
  }): { configHash: string; documentHash: string } {
    if (input.id !== input.value.id) throw new ConflictError("Direction path id differs from document value id.");
    const loaded = this.projects.load();
    if (loaded.configHash !== input.expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    const config = replaceDirectionValue(loaded.config, input.kind, input.value);
    const saved = this.projects.save(config, input.expectedConfigHash);
    try {
      const document = this.documents.put(input.kind, input.id, input.markdown, input.expectedDocumentHash);
      return { configHash: saved.configHash, documentHash: document.contentHash };
    } catch (error) {
      this.projects.save(loaded.config, saved.configHash);
      throw error;
    }
  }

  putAgent(input: {
    id: string; value: AgentDefinition; markdown: string;
    expectedConfigHash: string; expectedDocumentHash: string | "absent";
  }): { configHash: string; documentHash: string } {
    if (input.id !== input.value.id) throw new ConflictError("Agent path id differs from Markdown value id.");
    const loaded = this.projects.load();
    if (loaded.configHash !== input.expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    const config = { ...loaded.config, agents: replace(loaded.config.agents, input.value) };
    const saved = this.projects.save(config, input.expectedConfigHash);
    try {
      const document = this.documents.put("agent", input.id, input.markdown, input.expectedDocumentHash);
      return { configHash: saved.configHash, documentHash: document.contentHash };
    } catch (error) { this.projects.save(loaded.config, saved.configHash); throw error; }
  }

  removeAgent(input: { id: string; expectedConfigHash: string; expectedDocumentHash: string }): string {
    const loaded = this.projects.load();
    if (loaded.configHash !== input.expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    const blockers = new ProjectReferenceIndex(loaded.config).for("agent", input.id);
    if (blockers.length > 0) throw new ConflictError(`Agent ${input.id} has reference blockers.`);
    const saved = this.projects.save({ ...loaded.config, agents: loaded.config.agents.filter(({ id }) => id !== input.id) }, input.expectedConfigHash);
    try { this.documents.remove("agent", input.id, input.expectedDocumentHash, []); }
    catch (error) { this.projects.save(loaded.config, saved.configHash); throw error; }
    return saved.configHash;
  }

  removeDirection(input: {
    kind: Exclude<ProjectDocumentKind, "instruction" | "skill">;
    id: string; expectedConfigHash: string; expectedDocumentHash: string;
  }): string {
    const loaded = this.projects.load();
    if (loaded.configHash !== input.expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    const references = new ProjectReferenceIndex(loaded.config).for(input.kind, input.id);
    const blockers = [
      ...references.map(({ ownerType, ownerId, field }) => `${ownerType}:${ownerId}.${field}`),
      ...this.documents.runReferences(input.kind, input.id).map((runId) => `environment-run:${runId}.snapshot`)
    ];
    if (blockers.length > 0) throw new ConflictError(`${input.kind} ${input.id} has reference blockers: ${blockers.join(", ")}.`);
    const config = removeDirectionValue(loaded.config, input.kind, input.id);
    const saved = this.projects.save(config, input.expectedConfigHash);
    try { this.documents.remove(input.kind, input.id, input.expectedDocumentHash, []); }
    catch (error) { this.projects.save(loaded.config, saved.configHash); throw error; }
    return saved.configHash;
  }

  approveUseCase(id: string, expectedConfigHash: string, expectedContentHash: string, actor: TrustedHumanActor, at: string): string {
    const loaded = this.projects.load();
    if (loaded.configHash !== expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    const useCase = loaded.config.direction.useCases.find((candidate) => candidate.id === id);
    if (!useCase) throw new NotFoundError(`Use Case ${id} was not found.`);
    if (useCase.status === "approved") throw new ConflictError(`Use Case ${id} is already approved.`);
    if (useCaseApprovalHash(useCase) !== expectedContentHash) throw new ConflictError(`Use Case ${id} approval content is stale.`);
    const approved = approveUseCase(useCase, {
      approvedBy: actor.id, approvedAt: at, revision: (useCase.approvalRevision ?? useCase.approval?.revision ?? 0) + 1
    });
    return this.projects.save(replaceUseCase(loaded.config, approved), expectedConfigHash).configHash;
  }

  revokeUseCase(id: string, expectedConfigHash: string): string {
    const loaded = this.projects.load();
    if (loaded.configHash !== expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    const useCase = loaded.config.direction.useCases.find((candidate) => candidate.id === id);
    if (!useCase) throw new NotFoundError(`Use Case ${id} was not found.`);
    if (useCase.status !== "approved") throw new ConflictError(`Use Case ${id} is not approved.`);
    const draft = { ...useCase, status: "draft" as const,
      approvalRevision: useCase.approval?.revision ?? useCase.approvalRevision ?? 0, approval: undefined };
    return this.projects.save(replaceUseCase(loaded.config, draft), expectedConfigHash).configHash;
  }

  async load(): Promise<ProjectDefinition> {
    const loaded = this.projects.load();
    const resources = (["instruction", "skill"] as const).flatMap((kind) =>
      this.documents.list(kind).map(({ id, content }) => ({
        kind, id, content, relativePath: kind === "instruction"
          ? path.join(".ballet", "instructions", `${id}.md`)
          : path.join(".agents", "skills", id, "SKILL.md")
      }))
    );
    const hashes = (kind: "goal" | "adr" | "constraint") => Object.fromEntries(
      this.documents.list(kind).map(({ id, contentHash }) => [id, contentHash])
    );
    const result = await runFile("git", ["rev-parse", "HEAD"], { cwd: this.root, encoding: "utf8" });
    return {
      config: loaded.config, configSha256: loaded.configHash,
      baseCommit: result.stdout.trim(), checkoutRoot: this.root, resources,
      directionDocumentHashes: { goals: hashes("goal"), adrs: hashes("adr"), constraints: hashes("constraint") },
      agentDocumentHashes: Object.fromEntries(this.documents.list("agent").map(({ id, contentHash }) => [id, contentHash]))
    };
  }
}

const replaceDirectionValue = (
  config: ProjectConfigurationV22,
  kind: Exclude<ProjectDocumentKind, "instruction" | "skill">,
  input: DirectionValue
): ProjectConfigurationV22 => {
  const direction = structuredClone(config.direction);
  if (kind === "goal") direction.goals = replace(direction.goals, input as DirectionReference);
  else if (kind === "adr") direction.adrs = replace(direction.adrs, input as DirectionReference);
  else if (kind === "constraint") direction.constraints = replace(direction.constraints, input as Constraint);
  else {
    const existing = direction.useCases.find((candidate) => candidate.id === input.id);
    const next = input as UseCase;
    if ((!existing && next.status !== "draft") || (existing && next.status !== existing.status)) {
      throw new ConflictError("Use Case approval status changes require the dedicated human command.");
    }
    if ((!existing || existing.status === "draft") && next.approval) {
      throw new ConflictError("Draft Use Case cannot carry approval metadata.");
    }
    if (existing?.status === "approved" && JSON.stringify(next.approval) !== JSON.stringify(existing.approval)) {
      throw new ConflictError("Use Case approval metadata is owned by the dedicated human command.");
    }
    direction.useCases = replace(direction.useCases, existing ? invalidateUseCaseApproval(existing, next) : next);
  }
  return { ...config, direction };
};
const removeDirectionValue = (
  config: ProjectConfigurationV22,
  kind: Exclude<ProjectDocumentKind, "instruction" | "skill">,
  id: string
): ProjectConfigurationV22 => {
  const direction = structuredClone(config.direction);
  if (kind === "goal") direction.goals = direction.goals.filter((value) => value.id !== id);
  else if (kind === "adr") direction.adrs = direction.adrs.filter((value) => value.id !== id);
  else if (kind === "constraint") direction.constraints = direction.constraints.filter((value) => value.id !== id);
  else direction.useCases = direction.useCases.filter((value) => value.id !== id);
  return { ...config, direction };
};
const replace = <T extends { id: string }>(values: T[], value: T): T[] =>
  [...values.filter((candidate) => candidate.id !== value.id), value].sort((left, right) => left.id.localeCompare(right.id));
const replaceUseCase = (config: ProjectConfigurationV22, useCase: UseCase): ProjectConfigurationV22 => ({
  ...config, direction: { ...config.direction, useCases: replace(config.direction.useCases, useCase) }
});
