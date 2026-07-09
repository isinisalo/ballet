import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppData } from "../shared/api/workspaceData.js";
import type { Agent } from "../shared/domain/agents.js";
import type { RuntimeEvent } from "../shared/domain/events.js";
import type { AgentOutcome, AgentRun } from "../shared/domain/runtime.js";
import { runCodexAgent } from "./codex-adapter.js";
import { notifyRuntimeChanged } from "./runtime-events.js";
import { outcomeToRunStatus } from "./runtime-policy.js";
import { store } from "./store.js";
export { outcomeToOutputEventStatus } from "./automation/actionOutputAggregator.js";

const workerId = process.env.BALLET_AGENTD_WORKER_ID ?? `agentd-${process.pid}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findAgent = (data: AppData, role: string): Agent | undefined => data.agents.find((agent) => agent.id === role);

const buildRunPrompt = (run: AgentRun, inputEvent: RuntimeEvent, agent: Agent): string => {
  return [
    "Käsittele seuraava Ballet runtime -agent_run.",
    "",
    "Toimi vain oman roolisi mukaisesti. Älä julkaise eventtejä itse, älä muokkaa event streamia, älä käynnistä Codex native subagentteja, äläkä valitse domain event typeä.",
    "Palauta lopuksi vain JSON, joka täyttää annetun outputSchema-rakenteen.",
    "",
    `agent_role: ${run.agentRole}`,
    `agent_name: ${agent.name}`,
    `run_id: ${run.runId}`,
    `attempt: ${run.attempt}`,
    `loop_id: ${run.loopId}`,
    `action_id: ${run.actionId}`,
    `action_version: ${run.actionVersion}`,
    "",
    "Input event:",
    JSON.stringify(inputEvent, null, 2),
    "",
    "Outcome-ohje:",
    "- Käytä outcome=ready vain, kun työ on valmis ja olet validoinut olennaiset tarkistukset.",
    "- Käytä outcome=blocked, kun eteneminen ei ole mahdollista ilman ulkoista muutosta.",
    "- Käytä outcome=needs_input, kun tarvitset käyttäjältä tai ylläpidolta päätöksen.",
    "- Review-roolit käyttävät outcome=approved tai outcome=changes-requested varsinaiseen review-päätökseen.",
    "- checks-listassa pitää näkyä ajamasi tai perustellusti skippaamasi tarkistukset."
  ].join("\n");
};

const completeFailed = (run: AgentRun, error: unknown, data?: AppData) => {
  const message = error instanceof Error ? error.message : String(error);
  const action = data?.automation.actions.find((candidate) => candidate.id === run.actionId);
  store.runtimeDatabase().appendRunLog(run.runId, "error", message);
  const result = store.runtimeDatabase().completeRun({
    runId: run.runId,
    status: "failed",
    error: message,
    projectAction: action,
    projectActions: data?.automation.actions,
    actions: data?.automation.actions,
    outputRoutes: data?.automation.outputRoutes ?? [],
    loops: data?.automation.loops,
    automation: data?.automation,
    agents: data?.agents
  });
  notifyRuntimeChanged("agent-runs");
  if (result.event) notifyRuntimeChanged("events");
};

const completeWithOutcome = (
  run: AgentRun,
  inputEvent: RuntimeEvent,
  outcome: AgentOutcome,
  data: AppData,
  threadId?: string,
  turnId?: string
) => {
  let status = outcomeToRunStatus(outcome);
  let error: string | undefined;
  const action = data.automation.actions.find((candidate) => candidate.id === run.actionId);

  try {
    if (!action) throw new Error(`Automation action ${run.loopId}/${run.actionId} was not found.`);
  } catch (mappingError) {
    status = "failed";
    error = mappingError instanceof Error ? mappingError.message : "Agent output could not be mapped to an event.";
  }

  const result = store.runtimeDatabase().completeRun({
    runId: run.runId,
    status,
    outcome,
    error,
    threadId,
    turnId,
    projectAction: error ? undefined : action,
    projectActions: data.automation.actions,
    actions: data.automation.actions,
    outputRoutes: data.automation.outputRoutes,
    loops: data.automation.loops,
    automation: data.automation,
    agents: data.agents
  });

  if (threadId) {
    store.runtimeDatabase().upsertThreadBinding(inputEvent.subject, run.agentRole, threadId);
  }
  store.runtimeDatabase().appendRunLog(run.runId, error ? "error" : "info", error ?? `Run completed with outcome ${outcome.outcome}.`, {
    domain_event_type: result.event?.type
  });
  notifyRuntimeChanged("agent-runs");
  if (result.event) notifyRuntimeChanged("events");
};

export const runAgentWorkerOnce = async (): Promise<boolean> => {
  const runtime = store.runtimeDatabase();
  const run = runtime.leaseNextRun({ owner: workerId, leaseSeconds: 30 * 60 });
  if (!run) return false;
  notifyRuntimeChanged("agent-runs");
  runtime.appendRunLog(run.runId, "info", "Run leased by agentd.", { worker_id: workerId });
  let data: AppData | undefined;

  try {
    data = await store.read();
    const agent = findAgent(data, run.agentRole);
    if (!agent) throw new Error(`Agent role ${run.agentRole} was not found in .codex/agents.`);
    if (!agent.enabled) throw new Error(`Agent role ${run.agentRole} is disabled.`);
    const inputEvent = runtime.getInputEvent(run);
    if (!inputEvent) throw new Error(`Input event ${run.inputEventId} was not found.`);
    const resumeThreadId = runtime.getThreadBinding(inputEvent.subject, run.agentRole) ?? run.threadId;
    const prompt = buildRunPrompt(run, inputEvent, agent);

    const result = await runCodexAgent({
      runId: run.runId,
      workItemId: inputEvent.subject,
      agentRole: run.agentRole,
      agent,
      prompt,
      projectRoot: store.root,
      resumeThreadId,
      timeoutMs: Number(process.env.BALLET_AGENTD_CODEX_TIMEOUT_MS ?? 30 * 60 * 1000),
      onThread: (threadId, turnId) => {
        runtime.saveRunThread(run.runId, threadId, turnId);
        notifyRuntimeChanged("agent-runs");
      },
      onLog: (level, message, details) => runtime.appendRunLog(run.runId, level, message, details)
    });

    completeWithOutcome(run, inputEvent, result.outcome, data, result.threadId, result.turnId);
  } catch (error) {
    completeFailed(run, error, data);
  }

  return true;
};

export const runAgentDaemon = async (): Promise<void> => {
  const pollMs = Number(process.env.BALLET_AGENTD_POLL_MS ?? 2000);
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });

  console.log(`Ballet agentd running as ${workerId}`);
  while (!stopping) {
    const worked = await runAgentWorkerOnce();
    if (!worked) await sleep(pollMs);
  }
  console.log("Ballet agentd stopped.");
};

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runAgentDaemon().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
