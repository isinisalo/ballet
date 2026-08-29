/* eslint-disable max-lines -- Validation, Work waiting/resume, and postwork transitions stay in one transactional coordinator. */
import type Database from "better-sqlite3";
import type {
  ApplyPostworkInput, ApplyPrecheckInput, ApplyWorkInput, CreateAgentRunInput,
  FeedbackSeed, StoredActionExecution, StoredAgentRun, WorkOutcome
} from "../../../shared/orchestration/index.js";
import { ControlFlowStore } from "./ControlFlowStore.js";
import { EnvironmentRunStore } from "./EnvironmentRunStore.js";
import { FeedbackStore } from "./FeedbackStore.js";
import { ConflictError, StaleStateError } from "./PersistenceErrors.js";
import { AgentExecutionStore } from "./AgentExecutionStore.js";

export class ActionOutcomeCoordinator {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly runs = new EnvironmentRunStore(connection),
    private readonly execution = new AgentExecutionStore(connection),
    private readonly feedback = new FeedbackStore(connection),
    private readonly events = new ControlFlowStore(connection)
  ) {}

  createPrecheck(actionExecutionId: string, expectedRevision: number, input: CreateAgentRunInput): StoredAgentRun {
    return this.connection().transaction(() => {
      const action = this.requireAction(actionExecutionId, expectedRevision, "prechecking");
      assertAgentInput(input, action, "validation", "precheck", action.workAttempt + 1);
      if (input.parentAgentRunId) throw new ConflictError("Precheck Validation cannot have a parent Agent Run.");
      const agent = this.execution.createAgent(input);
      this.updateActiveAgent(action, agent, "prechecking", input.createdAt, false);
      this.events.append(action.environmentRunId, "validation_precheck_dispatched", {
        stateExecutionId: action.stateExecutionId, actionExecutionId, targetAgentRunId: agent.agentRunId
      }, input.createdAt);
      return agent;
    })();
  }

  applyPrecheck(input: ApplyPrecheckInput): StoredActionExecution {
    return this.connection().transaction(() => {
      const existingAgent = this.execution.requireAgent(input.agentRunId);
      const completed = this.execution.completeAgent(input.agentRunId, input.providerOutcomeKey, input.outcome, input.completedAt);
      if (!completed.applied) return this.runs.requireAction(existingAgent.actionExecutionId!);
      const action = this.requireAction(existingAgent.actionExecutionId!, input.expectedActionRevision, "prechecking");
      if (existingAgent.phase !== "precheck" || input.outcome.result.phase !== "precheck") {
        throw new ConflictError("Precheck application requires a precheck Validation outcome.");
      }
      this.events.append(action.environmentRunId, "validation_precheck_done", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: input.agentRunId
      }, input.completedAt);
      const decision = input.outcome.result;
      if (decision.decision === "done") return this.finishAction(action, "done", input.completedAt, input.agentRunId);
      if (decision.decision === "blocked") {
        return this.blockAction(action, input.feedback, input.completedAt, input.agentRunId, "validation_blocked");
      }
      if (!input.nextWork) throw new ConflictError("Delegated precheck requires a Work Agent Run.");
      assertAgentInput(input.nextWork, action, "work", "work", action.workAttempt + 1);
      if (input.nextWork.parentAgentRunId !== input.agentRunId) {
        throw new ConflictError("Work Agent Run must reference its delegating Validation Agent Run.");
      }
      if (input.nextWork.taskEnvelope.role !== "work" || input.nextWork.taskEnvelope.dynamicPrompt !== decision.workPrompt) {
        throw new ConflictError("Delegated Work prompt differs from Validation output.");
      }
      const work = this.execution.createAgent(input.nextWork);
      this.updateActiveAgent(action, work, "working", input.completedAt, false);
      this.events.append(action.environmentRunId, "work_dispatched", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: input.agentRunId, targetAgentRunId: work.agentRunId
      }, input.completedAt);
      return this.runs.requireAction(action.actionExecutionId);
    })();
  }

  applyWork(input: ApplyWorkInput): StoredActionExecution {
    return this.connection().transaction(() => {
      const existingAgent = this.execution.requireAgent(input.agentRunId);
      const completed = this.execution.completeAgent(input.agentRunId, input.providerOutcomeKey, input.outcome, input.completedAt);
      if (!completed.applied) return this.runs.requireAction(existingAgent.actionExecutionId!);
      const action = this.requireAction(existingAgent.actionExecutionId!, input.expectedActionRevision, "working");
      if (existingAgent.phase !== "work") throw new ConflictError("Work application requires a Work Agent Run.");
      assertAgentInput(input.nextValidation, action, "validation", "postwork", action.workAttempt + 1);
      if (input.nextValidation.parentAgentRunId !== input.agentRunId) {
        throw new ConflictError("Postwork Validation must reference its Work Agent Run.");
      }
      const validation = this.execution.createAgent(input.nextValidation);
      this.updateActiveAgent(action, validation, "postchecking", input.completedAt, true);
      this.events.append(action.environmentRunId, "work_completed", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: input.agentRunId
      }, input.completedAt);
      this.events.append(action.environmentRunId, "validation_postwork_dispatched", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: input.agentRunId, targetAgentRunId: validation.agentRunId
      }, input.completedAt);
      return this.runs.requireAction(action.actionExecutionId);
    })();
  }

  waitForWorkInput(input: {
    taskId: string; agentRunId: string; providerOutcomeKey: string; expectedActionRevision: number;
    outcome: Extract<WorkOutcome, { state: "needs_input" }>;
    completedAt: string;
  }): StoredActionExecution {
    return this.connection().transaction(() => {
      const agent = this.execution.requireAgent(input.agentRunId);
      const action = this.requireAction(agent.actionExecutionId!, input.expectedActionRevision, "working");
      if (agent.role !== "work" || agent.phase !== "work" || action.activeAgentRunId !== agent.agentRunId) {
        throw new ConflictError("Only the active Work Agent can wait for human input.");
      }
      const applied = this.execution.waitForInput(input.taskId, input.providerOutcomeKey, input.outcome, input.completedAt);
      if (applied) this.events.append(action.environmentRunId, "work_waiting_for_input", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: agent.agentRunId, data: { question: input.outcome.question }
      }, input.completedAt);
      return this.runs.requireAction(action.actionExecutionId);
    })();
  }

  resumeWorkInput(input: {
    agentRunId: string; expectedAgentRevision: number; expectedActionRevision: number;
    nextWork: CreateAgentRunInput; actorId: string; resumedAt: string;
  }): StoredActionExecution {
    return this.connection().transaction(() => {
      const waiting = this.execution.requireAgent(input.agentRunId);
      const action = this.requireAction(waiting.actionExecutionId!, input.expectedActionRevision, "working");
      if (waiting.status !== "waiting_for_input" || waiting.role !== "work" || waiting.phase !== "work"
        || action.activeAgentRunId !== waiting.agentRunId) {
        throw new ConflictError("Work input response does not match the active waiting Agent.");
      }
      assertAgentInput(input.nextWork, action, "work", "work", action.workAttempt + 1);
      if (input.nextWork.parentAgentRunId !== waiting.agentRunId) {
        throw new ConflictError("Resumed Work must reference the waiting Work Agent.");
      }
      this.execution.resumeWaitingAgent(waiting.agentRunId, input.expectedAgentRevision, input.resumedAt);
      const resumed = this.execution.createAgent(input.nextWork);
      this.updateActiveAgent(action, resumed, "working", input.resumedAt, false);
      this.events.append(action.environmentRunId, "work_resumed", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: waiting.agentRunId, targetAgentRunId: resumed.agentRunId,
        data: { actorId: input.actorId }
      }, input.resumedAt);
      this.events.append(action.environmentRunId, "work_dispatched", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: waiting.agentRunId, targetAgentRunId: resumed.agentRunId
      }, input.resumedAt);
      return this.runs.requireAction(action.actionExecutionId);
    })();
  }

  applyPostwork(input: ApplyPostworkInput): StoredActionExecution {
    return this.connection().transaction(() => {
      const existingAgent = this.execution.requireAgent(input.agentRunId);
      const completed = this.execution.completeAgent(input.agentRunId, input.providerOutcomeKey, input.outcome, input.completedAt);
      if (!completed.applied) return this.runs.requireAction(existingAgent.actionExecutionId!);
      const action = this.requireAction(existingAgent.actionExecutionId!, input.expectedActionRevision, "postchecking");
      if (existingAgent.phase !== "postwork" || input.outcome.result.phase !== "postwork") {
        throw new ConflictError("Postwork application requires a postwork Validation outcome.");
      }
      const decision = input.outcome.result;
      if (decision.decision === "done") return this.finishAction(action, "done", input.completedAt, input.agentRunId);
      if (decision.decision === "blocked") {
        return this.blockAction(action, input.feedback, input.completedAt, input.agentRunId, "validation_blocked");
      }
      if (action.workAttempt >= action.maxRetries + 1) {
        return this.blockAction(action, input.feedback, input.completedAt, input.agentRunId, "retry_exhaustion");
      }
      if (!input.nextWork) throw new ConflictError("Validation retry requires another Work Agent Run.");
      assertAgentInput(input.nextWork, action, "work", "work", action.workAttempt + 1);
      if (input.nextWork.parentAgentRunId !== input.agentRunId) {
        throw new ConflictError("Retry Work must reference its postwork Validation Agent Run.");
      }
      if (input.nextWork.taskEnvelope.role !== "work" || input.nextWork.taskEnvelope.dynamicPrompt !== decision.workPrompt) {
        throw new ConflictError("Retry Work prompt differs from Validation output.");
      }
      const work = this.execution.createAgent(input.nextWork);
      this.updateActiveAgent(action, work, "working", input.completedAt, false);
      this.events.append(action.environmentRunId, "validation_retry", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: input.agentRunId, targetAgentRunId: work.agentRunId
      }, input.completedAt);
      this.events.append(action.environmentRunId, "work_dispatched", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        targetAgentRunId: work.agentRunId
      }, input.completedAt);
      return this.runs.requireAction(action.actionExecutionId);
    })();
  }

  applyWorkFailure(input: {
    agentRunId: string; providerOutcomeKey: string; errorMessage: string;
    expectedActionRevision: number; feedback: FeedbackSeed; completedAt: string;
  }): StoredActionExecution {
    return this.connection().transaction(() => {
      const agent = this.execution.requireAgent(input.agentRunId);
      const applied = this.execution.failAgent(input.agentRunId, input.providerOutcomeKey, "provider_failure", input.errorMessage, input.completedAt);
      if (!applied) return this.runs.requireAction(agent.actionExecutionId!);
      const action = this.requireAction(agent.actionExecutionId!, input.expectedActionRevision, "working");
      if (agent.role !== "work" || agent.phase !== "work") throw new ConflictError("Only Work provider failures use this transition.");
      this.events.append(action.environmentRunId, "work_completed", {
        stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
        sourceAgentRunId: input.agentRunId, data: { providerFailure: true }
      }, input.completedAt);
      return this.blockAction(action, input.feedback, input.completedAt, input.agentRunId, "provider_failure");
    })();
  }

  blockInvalidOutput(input: {
    agentRunId: string; providerOutcomeKey: string; expectedActionRevision: number;
    errorMessage: string; feedback: FeedbackSeed; completedAt: string;
  }): StoredActionExecution {
    return this.connection().transaction(() => {
      const agent = this.execution.requireAgent(input.agentRunId);
      const applied = this.execution.failAgent(input.agentRunId, input.providerOutcomeKey, "invalid_structured_output", input.errorMessage, input.completedAt);
      if (!applied) return this.runs.requireAction(agent.actionExecutionId!);
      const action = this.runs.requireAction(agent.actionExecutionId!);
      if (action.revision !== input.expectedActionRevision) throw new StaleStateError(`Action ${action.actionExecutionId} revision is stale.`);
      return this.blockAction(action, input.feedback, input.completedAt, input.agentRunId, "system_invalid_output");
    })();
  }

  private requireAction(id: string, revision: number, status: StoredActionExecution["status"]): StoredActionExecution {
    const action = this.runs.requireAction(id);
    if (action.revision !== revision) throw new StaleStateError(`Action ${id} revision is stale.`);
    if (action.status !== status) throw new ConflictError(`Action ${id} is ${action.status}, expected ${status}.`);
    return action;
  }

  private updateActiveAgent(
    action: StoredActionExecution,
    agent: StoredAgentRun,
    status: "prechecking" | "working" | "postchecking",
    at: string,
    incrementAttempt: boolean
  ): void {
    const updated = this.connection().prepare(`
      UPDATE action_executions SET status = ?, active_agent_run_id = ?,
        work_attempt = work_attempt + ?, revision = revision + 1, updated_at = ?
      WHERE action_execution_id = ? AND revision = ?
    `).run(status, agent.agentRunId, incrementAttempt ? 1 : 0, at, action.actionExecutionId, action.revision);
    if (updated.changes !== 1) throw new StaleStateError(`Action ${action.actionExecutionId} changed during dispatch.`);
    this.connection().prepare(`
      UPDATE environment_runs SET active_agent_run_id = ?, revision = revision + 1, updated_at = ?
      WHERE environment_run_id = ? AND status = 'running'
    `).run(agent.agentRunId, at, action.environmentRunId);
  }

  private finishAction(
    action: StoredActionExecution,
    status: "done",
    at: string,
    agentRunId: string
  ): StoredActionExecution {
    this.connection().prepare(`
      UPDATE action_executions SET status = ?, active_agent_run_id = NULL, revision = revision + 1,
        completed_at = ?, updated_at = ? WHERE action_execution_id = ? AND revision = ?
    `).run(status, at, at, action.actionExecutionId, action.revision);
    this.connection().prepare(`
      UPDATE environment_runs SET active_action_execution_id = NULL, active_agent_run_id = NULL,
        revision = revision + 1, updated_at = ? WHERE environment_run_id = ?
    `).run(at, action.environmentRunId);
    this.events.append(action.environmentRunId, "validation_done", {
      stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
      sourceAgentRunId: agentRunId
    }, at);
    return this.runs.requireAction(action.actionExecutionId);
  }

  private blockAction(
    action: StoredActionExecution,
    feedback: ApplyPrecheckInput["feedback"],
    at: string,
    agentRunId: string,
    expectedSource: "validation_blocked" | "retry_exhaustion" | "provider_failure" | "system_invalid_output"
  ): StoredActionExecution {
    if (!feedback || feedback.source !== expectedSource || feedback.actionExecutionId !== action.actionExecutionId) {
      throw new ConflictError(`Blocked Action requires ${expectedSource} Feedback bound to the Action.`);
    }
    if (feedback.environmentRunId !== action.environmentRunId
      || feedback.stateExecutionId !== action.stateExecutionId || feedback.agentRunId !== agentRunId) {
      throw new ConflictError("Blocked Feedback lineage differs from its Action and Validation Agent.");
    }
    this.feedback.create(feedback);
    this.connection().prepare(`
      UPDATE action_executions SET status = 'blocked', active_agent_run_id = NULL,
        revision = revision + 1, completed_at = ?, updated_at = ?
      WHERE action_execution_id = ? AND revision = ?
    `).run(at, at, action.actionExecutionId, action.revision);
    this.connection().prepare(`
      UPDATE state_executions SET status = 'blocked', revision = revision + 1, completed_at = ?, updated_at = ?
      WHERE state_execution_id = ? AND status = 'running'
    `).run(at, at, action.stateExecutionId);
    this.connection().prepare(`
      UPDATE environment_runs SET status = 'blocked', active_action_execution_id = NULL,
        active_agent_run_id = NULL, revision = revision + 1, completed_at = ?, updated_at = ?
      WHERE environment_run_id = ? AND status = 'running'
    `).run(at, at, action.environmentRunId);
    this.events.append(action.environmentRunId, "action_blocked", {
      stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId,
      sourceAgentRunId: agentRunId
    }, at);
    this.events.append(action.environmentRunId, "feedback_created", {
      stateExecutionId: action.stateExecutionId, actionExecutionId: action.actionExecutionId
    }, at);
    this.events.append(action.environmentRunId, "environment_blocked", {}, at);
    return this.runs.requireAction(action.actionExecutionId);
  }
}

const assertAgentInput = (
  input: CreateAgentRunInput,
  action: StoredActionExecution,
  role: CreateAgentRunInput["role"],
  phase: CreateAgentRunInput["phase"],
  attempt: number
): void => {
  if (input.environmentRunId !== action.environmentRunId || input.actionExecutionId !== action.actionExecutionId
    || input.role !== role || input.phase !== phase || input.attempt !== attempt) {
    throw new ConflictError(`Agent Run does not match Action ${action.actionExecutionId} dispatch.`);
  }
  const envelope = input.taskEnvelope;
  if (!("actionExecutionId" in envelope) || envelope.actionExecutionId !== action.actionExecutionId) {
    throw new ConflictError(`Task Envelope does not match Action ${action.actionExecutionId}.`);
  }
  if (envelope.phase === "precheck"
    && (envelope.workAttempts !== action.workAttempt || envelope.maxRetries !== action.maxRetries)) {
    throw new ConflictError("Precheck retry snapshot differs from the Action.");
  }
  if ((envelope.phase === "work" || envelope.phase === "postwork") && envelope.workAttempt !== attempt) {
    throw new ConflictError("Task Envelope Work attempt differs from its Agent Run.");
  }
};
