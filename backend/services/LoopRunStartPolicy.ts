import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AppData } from "../../shared/api/workspaceData.js";
import { resolveEffectiveStartStep } from "../../shared/domain/automation.js";
import { LoopRunStateError } from "../runtime/LoopRunErrors.js";

const LOOP_ENGINEERING_AGENTS = {
  "ui-design": "ui-design-agent",
  implementation: "implementation-agent",
  "dev-deployment": "dev-deploy-agent"
} as const;
const TASK_SCOPED_LOOPS = new Set(["ui-design", "implementation"]);
const GATED_CHILD_LOOPS = new Set(["dev-deployment"]);
const TASK_DECLARATION = /^[\t ]*task_id:[\t ]*(task-\d{3})[\t ]*$/gm;
const TASK_FIELD = /^[\t ]*task_id[\t ]*:/gm;
const TASK_HEADING = /^##[\t ]+(task-\d{3})(?:[\t ]+(?:[-–—:]|$).*)?$/gm;

/**
 * Enforces the built-in minimal loop-engineering start contract without
 * extending the public automation schema. Cross-loop children are created by
 * LoopRunEngine and therefore do not pass through this root-start policy.
 */
export const validateLoopRunStart = async (data: AppData, loopId: string, input?: string): Promise<void> => {
  const loop = data.automation.loops.find((candidate) => candidate.id === loopId);
  if (!loop) return;
  const expectedAgent = LOOP_ENGINEERING_AGENTS[loopId as keyof typeof LOOP_ENGINEERING_AGENTS];
  const start = resolveEffectiveStartStep(loop);
  if (!expectedAgent || start?.type !== "agent" || start.agentId !== expectedAgent) return;
  if (GATED_CHILD_LOOPS.has(loopId)) {
    throw new LoopRunStateError(`${loopId} can only start from its approved human-gate transition.`);
  }
  if (!TASK_SCOPED_LOOPS.has(loopId)) return;

  const declarations = [...(input ?? "").matchAll(TASK_DECLARATION)];
  const fields = [...(input ?? "").matchAll(TASK_FIELD)];
  if (fields.length !== 1 || declarations.length !== 1) {
    throw new LoopRunStateError(`${loopId} input must contain exactly one line in the form task_id: task-NNN.`);
  }

  const projectRoot = data.projectRoot;
  if (!projectRoot) throw new LoopRunStateError(`Cannot validate ${loopId} task_id because the project root is unavailable.`);
  let tasks: string;
  try {
    tasks = await readFile(path.join(projectRoot, ".ballet", "outputs", "TASKS.md"), "utf8");
  } catch {
    throw new LoopRunStateError(`Cannot validate ${loopId} task_id because .ballet/outputs/TASKS.md is unavailable.`);
  }

  const taskId = declarations[0]![1]!;
  const taskDeclarations = [...tasks.matchAll(TASK_HEADING)].map((match) => match[1]);
  const declarationCount = taskDeclarations.filter((candidate) => candidate === taskId).length;
  if (declarationCount !== 1) {
    throw new LoopRunStateError(`${loopId} task_id ${taskId} must have exactly one ## ${taskId} declaration in .ballet/outputs/TASKS.md.`);
  }
};
