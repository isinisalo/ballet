import type { AgentOutcome, AgentOutcomeStatus, AgentRunStatus, EventDefinition, EventProducerDefinition, RunCheck } from "./shared/domain.js";

export const agentOutcomeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["outcome", "summary", "checks"],
  properties: {
    outcome: {
      type: "string",
      enum: ["ready", "blocked", "needs_input", "approved", "changes_requested", "failed"]
    },
    summary: { type: "string", minLength: 1 },
    artifacts: {
      type: "object",
      additionalProperties: true,
      properties: {
        git_sha: { type: "string" },
        changed_files: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "status"],
        properties: {
          name: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["passed", "failed", "skipped"] },
          details: { type: "string" }
        }
      }
    }
  }
} as const;

const outcomeStatuses = new Set(["ready", "blocked", "needs_input", "approved", "changes_requested", "failed"]);
const checkStatuses = new Set(["passed", "failed", "skipped"]);

export interface OutcomeValidation {
  gitCommitExists: boolean;
  requiredChecksPassed: boolean;
}

export interface DomainEventMapping {
  type: string;
  payload: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isRunCheck = (value: unknown): value is RunCheck =>
  isRecord(value) &&
  typeof value.name === "string" &&
  value.name.trim().length > 0 &&
  typeof value.status === "string" &&
  checkStatuses.has(value.status) &&
  (value.details === undefined || typeof value.details === "string");

export const isAgentOutcome = (value: unknown): value is AgentOutcome => {
  if (!isRecord(value)) return false;
  if (typeof value.outcome !== "string" || !outcomeStatuses.has(value.outcome)) return false;
  if (typeof value.summary !== "string" || value.summary.trim().length === 0) return false;
  if (!Array.isArray(value.checks) || !value.checks.every(isRunCheck)) return false;
  if (value.artifacts !== undefined && !isRecord(value.artifacts)) return false;
  if (isRecord(value.artifacts)) {
    const gitSha = value.artifacts.git_sha;
    const changedFiles = value.artifacts.changed_files;
    if (gitSha !== undefined && typeof gitSha !== "string") return false;
    if (changedFiles !== undefined && (!Array.isArray(changedFiles) || !changedFiles.every((item) => typeof item === "string"))) return false;
  }
  return true;
};

export const parseAgentOutcomeText = (text: string): AgentOutcome => {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Agent outcome was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isAgentOutcome(parsed)) {
    throw new Error("Agent outcome did not match the required schema.");
  }
  return parsed;
};

export const outcomeToRunStatus = (outcome: AgentOutcome): AgentRunStatus => {
  if (outcome.outcome === "blocked") return "blocked";
  if (outcome.outcome === "needs_input") return "needs_input";
  if (outcome.outcome === "failed") return "failed";
  return "completed";
};

export const checksPassRequiredGate = (checks: RunCheck[]): boolean =>
  checks.length > 0 && checks.every((check) => check.status !== "failed");

const textMatches = (ruleValue: string, actualValue: string): boolean => {
  if (!ruleValue || ruleValue === "*") return true;
  return ruleValue.trim().toLowerCase() === actualValue.trim().toLowerCase();
};

const producerAllowsOutcome = (producer: EventProducerDefinition, outcome: AgentOutcomeStatus): boolean =>
  producer.outcomes.includes(outcome);

const producerRequirementsPass = (producer: EventProducerDefinition, validation: OutcomeValidation): boolean => {
  const requires = producer.requires;
  if (!requires) return true;
  if (requires.gitCommitExists !== undefined && requires.gitCommitExists !== validation.gitCommitExists) return false;
  if (requires.requiredChecksPassed !== undefined && requires.requiredChecksPassed !== validation.requiredChecksPassed) return false;
  return true;
};

const matchingDefinition = (
  agentRole: string,
  outcome: AgentOutcome,
  validation: OutcomeValidation,
  eventDefinitions: EventDefinition[],
  source: string
): EventDefinition | undefined =>
  eventDefinitions.find((definition) =>
    definition.active &&
    textMatches(definition.source ?? "*", source) &&
    (definition.producers ?? []).some((producer) =>
      producer.agentRole === agentRole &&
      producerAllowsOutcome(producer, outcome.outcome) &&
      producerRequirementsPass(producer, validation)
    )
  );

export const mapOutcomeToDomainEvent = (
  agentRole: string,
  outcome: AgentOutcome,
  validation: OutcomeValidation,
  eventDefinitions: EventDefinition[],
  source = "agentd"
): DomainEventMapping | undefined => {
  const definition = matchingDefinition(agentRole, outcome, validation, eventDefinitions, source);
  if (!definition) return undefined;

  const basePayload = {
    agent_role: agentRole,
    outcome: outcome.outcome,
    summary: outcome.summary,
    artifacts: outcome.artifacts ?? {},
    checks: outcome.checks
  };

  return { type: definition.eventType, payload: basePayload };
};
