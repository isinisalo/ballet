import type { AgentRun, AgentRunLog, EventRecord } from "./shared/domain.js";
import type { TraceEntry, TraceScope, TraceViewModel } from "./shared/flow.js";
import type { RuntimeDatabase } from "./runtime-db.js";

const byTime = (left: TraceEntry, right: TraceEntry): number =>
  left.at.localeCompare(right.at) || left.id.localeCompare(right.id);

const eventIdFor = (event: EventRecord): string => event.eventId ?? event.id;
const eventDecisionKey = (eventType: unknown, dedupeKey: unknown): string | undefined =>
  typeof eventType === "string" && typeof dedupeKey === "string" ? `${eventType}:${dedupeKey}` : undefined;

const runTerminalKind = (run: AgentRun): TraceEntry["kind"] | undefined => {
  if (run.status === "completed") return "agent_completed";
  if (run.status === "blocked") return "agent_blocked";
  if (run.status === "needs_input") return "agent_needs_input";
  if (run.status === "failed" || run.status === "cancelled") return "agent_failed";
  return undefined;
};

const runTerminalTitle = (run: AgentRun): string => {
  if (run.status === "completed") return "Agent completed";
  if (run.status === "blocked") return "Agent blocked";
  if (run.status === "needs_input") return "Agent needs input";
  if (run.status === "cancelled") return "Agent cancelled";
  return "Agent failed";
};

export class TraceService {
  constructor(private readonly db: RuntimeDatabase) {}

  byCorrelation(correlationId: string): TraceViewModel {
    const events = this.db.listEventRecords(2000).filter((event) => event.correlationId === correlationId);
    const runs = this.db.listRuns(2000).filter((run) => run.correlationId === correlationId);
    return this.build("correlation", correlationId, events, runs);
  }

  byLoop(loopInstanceId: string): TraceViewModel {
    const runs = this.db.listRuns(2000).filter((run) => run.loopInstanceId === loopInstanceId);
    const triggerEventIds = new Set(runs.map((run) => run.triggerEventId));
    const events = this.db.listEventRecords(2000).filter((event) =>
      event.loopInstanceId === loopInstanceId || triggerEventIds.has(event.eventId ?? event.id)
    );
    return this.build("loop", loopInstanceId, events, runs);
  }

  byRun(runId: string): TraceViewModel {
    const run = this.db.getRun(runId);
    if (!run) return this.build("run", runId, [], []);
    const allEvents = this.db.listEventRecords(2000);
    const allRuns = this.db.listRuns(2000);
    const eventIds = new Set<string>([run.triggerEventId]);
    const runIds = new Set<string>([run.runId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const event of allEvents) {
        const eventId = eventIdFor(event);
        if (event.causationId && eventIds.has(event.causationId) && !eventIds.has(eventId)) {
          eventIds.add(eventId);
          changed = true;
        }
      }
      for (const candidate of allRuns) {
        if (eventIds.has(candidate.triggerEventId) && !runIds.has(candidate.runId)) {
          runIds.add(candidate.runId);
          changed = true;
        }
      }
    }
    const events = allEvents.filter((event) => eventIds.has(eventIdFor(event)));
    const runs = allRuns.filter((candidate) => runIds.has(candidate.runId));
    return this.build("run", runId, events, runs);
  }

  private build(scope: TraceScope, id: string, events: EventRecord[], runs: AgentRun[]): TraceViewModel {
    const entries: TraceEntry[] = [];
    const visibleEmittedEventKeys = new Set(
      events.map((event) => eventDecisionKey(event.eventType, event.dedupeKey)).filter((key): key is string => Boolean(key))
    );
    const runIds = new Set(runs.map((run) => run.runId));
    const logs = runIds.size > 0
      ? runs.flatMap((run) => this.db.listRunLogs(run.runId, 200).map((log) => ({ run, log })))
      : [];
    const runsWithExplicitStartLogs = new Set(
      logs
        .filter(({ log }) => log.message === "Run leased by agentd.")
        .map(({ run }) => run.runId)
    );

    for (const event of events) {
      const eventId = event.eventId ?? event.id;
      entries.push({
        id: `event:${eventId}`,
        at: event.createdAt,
        scope,
        kind: event.causationId ? "event_emitted" : "event_received",
        title: event.causationId ? "Event emitted" : "Event received",
        summary: `${event.eventType}${event.subject ? ` for ${event.subject}` : ""}`,
        status: event.status,
        eventId,
        loopInstanceId: event.loopInstanceId ?? runs.find((run) => run.triggerEventId === eventId)?.loopInstanceId,
        technicalDetails: {
          eventType: event.eventType,
          correlationId: event.correlationId,
          causationId: event.causationId,
          loopInstanceId: event.loopInstanceId,
          loopDefinitionId: event.loopDefinitionId,
          loopDefinitionVersion: event.loopDefinitionVersion,
          routing: event.routing
        }
      });
      for (const decision of event.routing?.decisions ?? []) {
        const technicalDecision = decision as unknown as Record<string, unknown>;
        entries.push({
          id: `routing:${eventId}:${decision.policyId}`,
          at: event.createdAt,
          scope,
          kind: decision.status === "routed" ? "routing_matched" : "routing_skipped",
          title: decision.status === "routed" ? "Routing matched" : "Routing skipped",
          summary: decision.reason,
          status: decision.status,
          eventId,
          runId: decision.runId,
          technicalDetails: technicalDecision
        });
        if (decision.status === "routed") {
          entries.push({
            id: `input:${eventId}:${decision.policyId}`,
            at: event.createdAt,
            scope,
            kind: "input_mapped",
            title: "Input mapped",
            summary: `Prepared input for ${decision.operationId}@${decision.operationVersion}.`,
            status: "valid",
            eventId,
            runId: decision.runId,
            technicalDetails: { input: technicalDecision.input, inputContractHash: decision.inputContractHash }
          });
          entries.push({
            id: `input-validation:${eventId}:${decision.policyId}`,
            at: event.createdAt,
            scope,
            kind: "input_validated",
            title: "Input validated",
            summary: `Operation input satisfied ${decision.inputContractId}@${decision.inputContractVersion}.`,
            status: "valid",
            eventId,
            runId: decision.runId,
            technicalDetails: {
              inputContractId: decision.inputContractId,
              inputContractVersion: decision.inputContractVersion,
              inputContractHash: decision.inputContractHash
            }
          });
        }
      }
    }

    for (const run of runs) {
      entries.push({
        id: `run:${run.runId}:queued`,
        at: run.createdAt,
        scope,
        kind: "agent_queued",
        title: run.runId === id ? "Agent queued" : "Downstream run queued",
        summary: `${run.operationId ?? run.agentRole} was queued for ${run.agentRole}.`,
        status: "queued",
        runId: run.runId,
        loopInstanceId: run.loopInstanceId,
        technicalDetails: {
          policyId: run.policyId,
          policyVersion: run.policyVersion,
          operationId: run.operationId,
          operationVersion: run.operationVersion,
          attempt: run.attempt,
          error: run.error
        }
      });
      if (run.status === "running" || (run.attempt > 0 && !runsWithExplicitStartLogs.has(run.runId))) {
        entries.push({
          id: `run:${run.runId}:agent-started`,
          at: run.updatedAt,
          scope,
          kind: "agent_started",
          title: "Agent started",
          summary: run.status === "running"
            ? `${run.operationId ?? run.agentRole} is running.`
            : `${run.operationId ?? run.agentRole} was picked up by an agent.`,
          status: run.status === "running" ? run.status : "started",
          runId: run.runId,
          loopInstanceId: run.loopInstanceId,
          technicalDetails: { attempt: run.attempt, leaseOwner: run.leaseOwner, leaseUntil: run.leaseUntil }
        });
      }
      const terminalKind = runTerminalKind(run);
      if (terminalKind) {
        entries.push({
          id: `run:${run.runId}:${run.status}`,
          at: run.completedAt ?? run.updatedAt,
          scope,
          kind: terminalKind,
          title: runTerminalTitle(run),
          summary: run.error ? `${run.operationId ?? run.agentRole} ended with ${run.error}.` : `${run.operationId ?? run.agentRole} is ${run.status}.`,
          status: run.status,
          runId: run.runId,
          loopInstanceId: run.loopInstanceId,
          technicalDetails: {
            outputContractId: run.outputContractId,
            outputContractVersion: run.outputContractVersion,
            outputContractHash: run.outputContractHash,
            outputValidationErrors: run.outputValidationErrorsJson,
            error: run.error
          }
        });
      }
      for (const decision of run.emissionDecisionsJson ?? []) {
        entries.push({
          id: `emission:${run.runId}:${String(decision.emissionPolicyId ?? decision.policyId ?? entries.length)}`,
          at: run.completedAt ?? run.updatedAt,
          scope,
          kind: "emission_evaluated",
          title: "Emission evaluated",
          summary: typeof decision.reason === "string" ? decision.reason : "Result branch was evaluated.",
          status: typeof decision.status === "string" ? decision.status : undefined,
          runId: run.runId,
          loopInstanceId: run.loopInstanceId,
          technicalDetails: decision
        });
        const gateDecisions = Array.isArray(decision.gateDecisions) ? decision.gateDecisions : [];
        for (const [index, gate] of gateDecisions.entries()) {
          const gateRecord = gate as Record<string, unknown>;
          const passed = gateRecord.passed === true;
          entries.push({
            id: `gate:${run.runId}:${String(decision.emissionPolicyId ?? decision.policyId ?? entries.length)}:${index}`,
            at: run.completedAt ?? run.updatedAt,
            scope,
            kind: passed ? "gate_passed" : "gate_failed",
            title: passed ? "Gate passed" : "Gate failed",
            summary: `${String(gateRecord.type ?? "Gate")} ${String(gateRecord.reason ?? (passed ? "passed" : "failed"))}.`,
            status: passed ? "passed" : "failed",
            runId: run.runId,
            loopInstanceId: run.loopInstanceId,
            technicalDetails: {
              emissionPolicyId: decision.emissionPolicyId,
              emissionPolicyVersion: decision.emissionPolicyVersion,
              gate: gateRecord
            }
          });
        }
        const emittedEvents = Array.isArray(decision.emittedEvents) ? decision.emittedEvents : [];
        for (const [index, emittedEvent] of emittedEvents.entries()) {
          const emittedRecord = emittedEvent as Record<string, unknown>;
          const eventType = typeof emittedRecord.eventType === "string" ? emittedRecord.eventType : "event";
          const dedupeKey = typeof emittedRecord.dedupeKey === "string" ? emittedRecord.dedupeKey : undefined;
          const key = eventDecisionKey(eventType, dedupeKey);
          if (key && visibleEmittedEventKeys.has(key)) continue;
          const slot = typeof emittedRecord.slot === "string" ? emittedRecord.slot : undefined;
          entries.push({
            id: `emitted-event:${run.runId}:${String(decision.emissionPolicyId ?? decision.policyId ?? entries.length)}:${index}`,
            at: run.completedAt ?? run.updatedAt,
            scope,
            kind: "event_emitted",
            title: "Event emitted",
            summary: slot ? `Published ${eventType} from ${slot}.` : `Published ${eventType}.`,
            status: "emitted",
            runId: run.runId,
            loopInstanceId: run.loopInstanceId,
            technicalDetails: {
              emissionPolicyId: decision.emissionPolicyId,
              emissionPolicyVersion: decision.emissionPolicyVersion,
              emittedEvent: emittedRecord
            }
          });
        }
      }
    }

    for (const { run, log } of logs) {
      entries.push(this.logEntry(scope, run, log));
    }

    const visibleLoopInstanceIds = new Set([
      ...runs.map((run) => run.loopInstanceId).filter((loopInstanceId): loopInstanceId is string => Boolean(loopInstanceId)),
      ...events.map((event) => event.loopInstanceId).filter((loopInstanceId): loopInstanceId is string => Boolean(loopInstanceId))
    ]);
    for (const loop of this.db.listLoopInstances(2000)) {
      if ((scope === "loop" && loop.loopInstanceId !== id) || (scope !== "loop" && !visibleLoopInstanceIds.has(loop.loopInstanceId))) continue;
      if (loop.status !== "completed" && loop.status !== "exhausted") continue;
      entries.push({
        id: `loop:${loop.loopInstanceId}:${loop.status}`,
        at: loop.completedAt ?? loop.updatedAt,
        scope,
        kind: loop.status === "completed" ? "loop_completed" : "loop_exhausted",
        title: loop.status === "completed" ? "Flow completed" : "Flow exhausted",
        summary: loop.failureReason ?? `Flow ${loop.status}.`,
        status: loop.status,
        loopInstanceId: loop.loopInstanceId,
        technicalDetails: loop as unknown as Record<string, unknown>
      });
    }

    return { scope, id, entries: entries.sort(byTime) };
  }

  private logEntry(scope: TraceScope, run: AgentRun, log: AgentRunLog): TraceEntry {
    if (log.message === "Run leased by agentd.") {
      return {
        id: `log:${log.id}`,
        at: log.createdAt,
        scope,
        kind: "agent_started",
        title: "Agent started",
        summary: "Agent picked up this task.",
        status: "running",
        runId: run.runId,
        loopInstanceId: run.loopInstanceId,
        technicalDetails: log.data
      };
    }
    return {
      id: `log:${log.id}`,
      at: log.createdAt,
      scope,
      kind: "log",
      title: log.level === "error" ? "Run error" : log.level === "warn" ? "Run warning" : "Run note",
      summary: log.message,
      status: log.level,
      runId: run.runId,
      loopInstanceId: run.loopInstanceId,
      technicalDetails: log.data
    };
  }
}
