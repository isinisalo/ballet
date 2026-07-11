import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppData } from "../shared/api/workspaceData.js";
import type { Agent } from "../shared/domain/agents.js";
import type { ProjectAutomationConfig } from "../shared/domain/automation.js";
import type { LoopRunDetails, StepRun } from "../shared/domain/runtime.js";
import { runCodexAgent } from "./codex-adapter.js";
import { notifyRuntimeChanged } from "./runtime-events.js";
import { store } from "./store.js";

const workerId = process.env.BALLET_AGENTD_WORKER_ID ?? `agentd-${process.pid}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findAgent = (data: AppData, agentId: string): Agent | undefined =>
  data.agents.find((agent) => agent.id === agentId);

const buildRunPrompt = (stepRun: StepRun, run: LoopRunDetails, agent: Agent): string => [
  "Käsittele seuraava Ballet automation v2 -step run.",
  "",
  "Toimi vain oman roolisi mukaisesti. Älä käynnistä toista loopia tai step-runia, älä julkaise eventtejä, äläkä käynnistä Codex native subagentteja.",
  "Palauta lopuksi vain JSON, joka täyttää annetun outputSchema-rakenteen.",
  "",
  `agent_id: ${stepRun.agentId}`,
  `agent_name: ${agent.name}`,
  `root_run_id: ${run.rootRunId}`,
  `loop_run_id: ${run.runId}`,
  `step_run_id: ${stepRun.stepRunId}`,
  `loop_id: ${run.loopId}`,
  `step_id: ${stepRun.stepId}`,
  `attempt: ${stepRun.attempt}`,
  "",
  "Loop input:",
  stepRun.input ?? run.input ?? "(none)",
  "",
  "Loop snapshot:",
  JSON.stringify(run.snapshot, null, 2),
  "",
  "Prior step run history:",
  JSON.stringify(run.stepRuns
    .filter((candidate) => candidate.stepRunId !== stepRun.stepRunId)
    .map((candidate) => ({
      stepRunId: candidate.stepRunId,
      stepId: candidate.stepId,
      type: candidate.type,
      status: candidate.status,
      result: candidate.result,
      outcome: candidate.outcome?.outcome,
      summary: candidate.outcome?.summary,
      error: candidate.error,
      responseInput: candidate.responseInput
    })), null, 2),
  "",
  "Outcome-ohje:",
  "- Käytä outcome=ready vain, kun työ on valmis ja olet validoinut olennaiset tarkistukset.",
  "- Käytä outcome=blocked, kun eteneminen ei ole mahdollista ilman ulkoista muutosta.",
  "- Käytä outcome=needs_input, kun tarvitset käyttäjältä tai ylläpidolta päätöksen.",
  "- Review-roolit käyttävät outcome=approved tai outcome=changes-requested varsinaiseen review-päätökseen.",
  "- checks-listassa pitää näkyä ajamasi tai perustellusti skippaamasi tarkistukset."
].join("\n");

const fallbackConfig = (run: LoopRunDetails): ProjectAutomationConfig => ({
  version: 2,
  loops: [run.snapshot],
  runtimes: []
});

const completeFailed = (stepRun: StepRun, run: LoopRunDetails, error: unknown, data?: AppData) => {
  const message = error instanceof Error ? error.message : String(error);
  store.runtimeDatabase().appendStepRunLog(stepRun.stepRunId, "error", message);
  store.runtimeDatabase().completeAgentStep(data?.automation ?? fallbackConfig(run), {
    stepRunId: stepRun.stepRunId,
    error: message
  });
  notifyRuntimeChanged("loop-runs");
};

export const runAgentWorkerOnce = async (): Promise<boolean> => {
  const runtime = store.runtimeDatabase();
  const stepRun = runtime.leaseNextStepRun({ owner: workerId, leaseSeconds: 30 * 60 });
  if (!stepRun) return false;
  notifyRuntimeChanged("loop-runs");
  runtime.appendStepRunLog(stepRun.stepRunId, "info", "Step run leased by agentd.", { worker_id: workerId });
  let run: LoopRunDetails | undefined;
  let data: AppData | undefined;

  try {
    run = runtime.getLoopRun(stepRun.runId);
    if (!run) throw new Error(`Loop run ${stepRun.runId} was not found.`);
    data = await store.read();
    if (!stepRun.agentId) throw new Error(`Agent step ${stepRun.stepId} has no agentId.`);
    const agent = findAgent(data, stepRun.agentId);
    if (!agent) throw new Error(`Agent ${stepRun.agentId} was not found in .codex/agents.`);
    if (!agent.enabled) throw new Error(`Agent ${stepRun.agentId} is disabled.`);
    const resumeThreadId = runtime.getThreadBinding(run.rootRunId, stepRun.agentId) ?? stepRun.threadId;
    const abortController = new AbortController();
    const cancellationPoll = setInterval(() => {
      if (runtime.getStepRun(stepRun.stepRunId)?.status === "cancelled") abortController.abort();
    }, 250);
    const result = await runCodexAgent({
      runId: stepRun.stepRunId,
      workItemId: run.rootRunId,
      agentRole: stepRun.agentId,
      agent,
      prompt: buildRunPrompt(stepRun, run, agent),
      projectRoot: store.root,
      resumeThreadId,
      timeoutMs: Number(process.env.BALLET_AGENTD_CODEX_TIMEOUT_MS ?? 30 * 60 * 1000),
      signal: abortController.signal,
      onThread: (threadId, turnId) => {
        runtime.saveStepRunThread(stepRun.stepRunId, threadId, turnId);
        notifyRuntimeChanged("loop-runs");
      },
      onLog: (level, message, details) => runtime.appendStepRunLog(stepRun.stepRunId, level, message, details),
      onConsole: (event) => runtime.appendStepRunConsole(stepRun.stepRunId, event)
    }).finally(() => clearInterval(cancellationPoll));

    runtime.appendStepRunConsole(stepRun.stepRunId, {
      source: "codex",
      kind: "agent",
      level: "info",
      phase: "completed",
      itemId: "final-agent-outcome",
      message: JSON.stringify(result.outcome, null, 2),
      data: { outcome: result.outcome.outcome },
      terminal: true
    });

    runtime.completeAgentStep(data.automation, {
      stepRunId: stepRun.stepRunId,
      outcome: result.outcome,
      threadId: result.threadId,
      turnId: result.turnId
    });
    notifyRuntimeChanged("loop-runs");
  } catch (error) {
    if (run) completeFailed(stepRun, run, error, data);
    else runtime.appendStepRunLog(stepRun.stepRunId, "error", error instanceof Error ? error.message : String(error));
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
