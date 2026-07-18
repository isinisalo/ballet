import {
  defaultAgentStepTransitions,
  defaultHumanStepTransitions,
  defaultTerminalNodes,
  gotoTransition,
  terminateTransition,
  type ProjectAgentStepTransitions,
  type ProjectAutomationConfig,
  type ProjectHumanStepTransitions
} from "../../../shared/domain/automation.js";

const agentActions = (
  overrides: Partial<ProjectAgentStepTransitions>
): ProjectAgentStepTransitions => ({ ...defaultAgentStepTransitions(), ...overrides });

const humanActions = (
  overrides: Partial<ProjectHumanStepTransitions>
): ProjectHumanStepTransitions => ({ ...defaultHumanStepTransitions(), ...overrides });

export const documentReviewFixture = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "document-review",
    start: "inspect-draft",
    nodes: [{
      id: "inspect-draft", type: "agent", agentId: "document-inspector", description: "Inspect a draft.", nodeStyle: "sol", nodeSize: "large",
      on: agentActions({
        ready: gotoTransition("editor-decision"),
        approved: terminateTransition("completed"),
        "changes-requested": {
          action: "retry", target: "revise-draft",
          policy: { maxAttempts: 2, stallDetection: "same-evidence", onExhausted: terminateTransition("blocked") }
        },
        needs_input: { action: "wait", resume: "same-step", input: "append-signal" },
        blocked: gotoTransition("editor-decision"),
        failed: terminateTransition("failed")
      })
    }, {
      id: "editor-decision", type: "human", description: "Decide whether the draft is publishable.", nodeStyle: "luna", nodeSize: "tiny",
      on: humanActions({
        approved: terminateTransition("completed"),
        rejected: gotoTransition("revise-draft", "append-signal")
      })
    }, {
      id: "revise-draft", type: "agent", agentId: "document-editor", description: "Revise the draft.", nodeStyle: "terra", nodeSize: "medium",
      on: agentActions({ ready: gotoTransition("inspect-draft"), approved: gotoTransition("inspect-draft") })
    }, ...defaultTerminalNodes()]
  }]
});

export const dataImportFixture = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "data-import",
    start: "ingest-batch",
    nodes: [{
      id: "ingest-batch", type: "scheduled", agentId: "batch-ingestor", description: "Ingest a data batch.", nodeStyle: "luna", nodeSize: "small",
      schedule: { kind: "recurring", cadence: "daily", startsOn: "2026-07-18", time: "02:00", timeZone: "Europe/Helsinki" },
      on: agentActions({
        ready: gotoTransition("normalize-records"),
        approved: terminateTransition("completed"),
        "changes-requested": gotoTransition("discard-batch"),
        needs_input: { action: "wait", resume: { target: "normalize-records" }, input: "append-signal" },
        blocked: gotoTransition({ loop: "mapping-assistance" }),
        failed: {
          action: "retry",
          policy: { maxAttempts: 4, onExhausted: gotoTransition("discard-batch") }
        }
      })
    }, {
      id: "normalize-records", type: "agent", agentId: "record-normalizer", description: "Normalize records.", nodeStyle: "flat", nodeSize: "medium",
      on: agentActions({ ready: terminateTransition("completed"), approved: terminateTransition("completed") })
    }, {
      id: "discard-batch", type: "agent", agentId: "batch-ingestor", description: "Discard an invalid batch.", nodeStyle: "mars", nodeSize: "small",
      on: agentActions({ ready: terminateTransition("failed"), approved: terminateTransition("failed") })
    }, ...defaultTerminalNodes()]
  }, {
    id: "mapping-assistance",
    start: "mapping-decision",
    nodes: [{
      id: "mapping-decision", type: "human", description: "Provide a missing mapping.", nodeStyle: "luna", nodeSize: "tiny",
      on: humanActions({
        approved: gotoTransition({ loop: "data-import" }, "append-signal"),
        rejected: terminateTransition("blocked")
      })
    }, ...defaultTerminalNodes()]
  }]
});

export const incidentEscalationFixture = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "incident-triage",
    start: "triage-incident",
    nodes: [{
      id: "triage-incident", type: "agent", agentId: "incident-triager", description: "Triage an incident.", nodeStyle: "mars", nodeSize: "large",
      on: agentActions({
        ready: terminateTransition("blocked"),
        approved: gotoTransition("contain-incident"),
        "changes-requested": gotoTransition({ loop: "incident-escalation" }),
        needs_input: gotoTransition("context-decision", "signal"),
        blocked: {
          action: "retry", target: "collect-diagnostics",
          policy: { maxAttempts: 1, onExhausted: gotoTransition({ loop: "incident-escalation" }) }
        },
        failed: gotoTransition("cleanup-incident")
      })
    }, {
      id: "context-decision", type: "human", description: "Supply incident context.", nodeStyle: "luna", nodeSize: "tiny",
      on: humanActions({
        approved: { action: "wait", resume: { target: "triage-incident" }, input: "append-signal" },
        rejected: terminateTransition("failed")
      })
    }, {
      id: "collect-diagnostics", type: "agent", agentId: "diagnostics-agent", description: "Collect diagnostics.", nodeStyle: "flat", nodeSize: "medium",
      on: agentActions({ ready: gotoTransition("triage-incident"), approved: gotoTransition("triage-incident") })
    }, {
      id: "contain-incident", type: "agent", agentId: "incident-responder", description: "Contain the incident.", nodeStyle: "terra", nodeSize: "medium",
      on: agentActions({ ready: terminateTransition("completed"), approved: terminateTransition("completed") })
    }, {
      id: "cleanup-incident", type: "agent", agentId: "incident-responder", description: "Clean up after failure.", nodeStyle: "flat", nodeSize: "small",
      on: agentActions({ ready: terminateTransition("failed"), approved: terminateTransition("failed") })
    }, ...defaultTerminalNodes()]
  }, {
    id: "incident-escalation",
    start: "commander-decision",
    nodes: [{
      id: "commander-decision", type: "human", description: "Command the escalation.", nodeStyle: "luna", nodeSize: "tiny",
      on: humanActions({
        approved: gotoTransition("mitigate-incident", "append-signal"),
        rejected: terminateTransition("completed")
      })
    }, {
      id: "mitigate-incident", type: "agent", agentId: "incident-responder", description: "Mitigate the incident.", nodeStyle: "terra", nodeSize: "large",
      on: agentActions({
        ready: terminateTransition("completed"),
        approved: terminateTransition("completed"),
        failed: gotoTransition({ loop: "incident-triage" })
      })
    }, ...defaultTerminalNodes()]
  }]
});

export const platformTransitionWorkflows = [
  ["document review", documentReviewFixture],
  ["data import", dataImportFixture],
  ["incident escalation", incidentEscalationFixture]
] as const;
