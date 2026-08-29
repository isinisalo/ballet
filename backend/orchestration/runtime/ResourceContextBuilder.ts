import type { AgentComposition, ProjectConfigurationV20 } from "../../../shared/orchestration/environment.js";
import { validateActionInstruction } from "../../../shared/orchestration/instructionContract.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import type { RuntimeResourceSnapshot } from "../../../shared/orchestration/runtime.js";

export interface ProjectResourceInput {
  kind: "instruction" | "skill";
  id: string;
  relativePath: string;
  content: string;
}

export class ResourceContextError extends Error {}

export const resolveOrchestrationResources = (
  config: ProjectConfigurationV20,
  catalog: readonly ProjectResourceInput[]
): RuntimeResourceSnapshot[] => {
  const indexed = new Map(catalog.map((resource) => [`${resource.kind}:${resource.id}`, resource]));
  if (indexed.size !== catalog.length) throw new ResourceContextError("Resource catalog contains duplicate identities.");
  const selected = new Map<string, RuntimeResourceSnapshot>();
  for (const composition of allCompositions(config)) {
    addResource(indexed, selected, "instruction", composition.instructionResource, true);
    for (const skillId of [...composition.skillResources].sort(compareUtf8)) {
      addResource(indexed, selected, "skill", skillId, false);
    }
  }
  return [...selected.values()].sort((left, right) => compareUtf8(`${left.kind}:${left.id}`, `${right.kind}:${right.id}`));
};

const addResource = (
  catalog: Map<string, ProjectResourceInput>,
  selected: Map<string, RuntimeResourceSnapshot>,
  kind: ProjectResourceInput["kind"],
  id: string,
  validateInstruction: boolean
): void => {
  const key = `${kind}:${id}`;
  const source = catalog.get(key);
  if (!source) throw new ResourceContextError(`Missing ${kind} resource ${id}.`);
  if (Buffer.byteLength(source.content, "utf8") > 128 * 1024) {
    throw new ResourceContextError(`${kind} resource ${id} exceeds 128 KiB.`);
  }
  if (validateInstruction) {
    const issues = validateActionInstruction(source.content);
    if (issues.length) throw new ResourceContextError(`${id}: ${issues[0]!.message}.`);
  }
  selected.set(key, { ...source, sourceSha256: sha256(source.content) });
};

const allCompositions = (config: ProjectConfigurationV20): AgentComposition[] => [
  config.critic.agent,
  config.refinement.agent,
  ...config.environment.states.flatMap((state) => state.actions.flatMap((action) => [action.validation, action.work]))
];

const compareUtf8 = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
